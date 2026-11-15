import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { runAgent } from '../agent/run.js';
import { turnSchema } from '../agent/types.js';
import { loadCases, safeNameSchema } from './cases.js';
import { createBudget, sonnetRates, type Rates } from './cost.js';
import { type Recording, saveRecording, saveResults } from './recordings.js';
import { caseResult, type CaseResult, summarize } from './results.js';
import { withShop } from './shop.js';

const defaultModel = 'claude-sonnet-5-5';

function parseRates(model: string, input?: string, output?: string): Rates {
  if (model === defaultModel && input === undefined && output === undefined)
    return sonnetRates;
  if (input === undefined || output === undefined)
    throw new Error('Supply both per-million token prices for this model.');
  const price = z.coerce.number().positive();
  return {
    input_per_million: price.parse(input),
    output_per_million: price.parse(output),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'max-cases': { type: 'string' },
      'budget-usd': { type: 'string', default: '2' },
      'input-usd-per-million': { type: 'string' },
      'output-usd-per-million': { type: 'string' },
    },
  });
  const model = safeNameSchema.parse(
    process.env.ANTHROPIC_MODEL ?? defaultModel,
  );
  if (model === 'scripted')
    throw new Error(
      'The scripted identifier is reserved for offline fixtures.',
    );
  const rates = parseRates(
    model,
    values['input-usd-per-million'],
    values['output-usd-per-million'],
  );
  const budgetUsd = z.coerce.number().positive().parse(values['budget-usd']);
  const maxCases =
    values['max-cases'] === undefined
      ? undefined
      : z.coerce.number().int().positive().parse(values['max-cases']);
  const cases = (await loadCases()).slice(0, maxCases);
  const runId = new Date().toISOString().replace(/[.:]/g, '-');
  const budget = createBudget(budgetUsd, rates);
  const provider = new Anthropic({ logLevel: 'off', maxRetries: 0 });
  const results: CaseResult[] = [];
  const servedModels = new Set<string>();
  let budgetStopped = false;

  for (const scenario of cases) {
    const recording: Recording = {
      source: 'live',
      model,
      run_id: runId,
      case_id: scenario.id,
      budget_usd: budgetUsd,
      rates,
      state: 'running',
      turns: [],
    };
    const result = await withShop(scenario, (client) =>
      runAgent(
        client,
        async (request) => {
          if (!budget.permits(request)) return undefined;
          const started = performance.now();
          const response = await provider.messages.create(request);
          const turn = turnSchema.parse({
            response,
            latency_ms: performance.now() - started,
          });
          budget.charge(turn);
          servedModels.add(turn.response.model);
          recording.turns.push(turn);
          await saveRecording(recording);
          return turn;
        },
        model,
        scenario.question,
        scenario.confirmed_return,
      ),
    );

    budgetStopped = result.stop === 'budget';
    recording.state = budgetStopped ? 'budget' : 'complete';
    await saveRecording(recording);
    results.push(caseResult(scenario, result, recording));
    const summary = summarize(results, rates);
    await saveResults(model, runId, false, {
      source: 'live',
      model,
      served_models: [...servedModels],
      run_id: runId,
      budget_usd: budgetUsd,
      budget_stopped: budgetStopped,
      cases_selected: cases.length,
      rates,
      summary,
      cases: results,
    });
    if (budgetStopped) break;
  }

  console.log(
    JSON.stringify(
      {
        model,
        run_id: runId,
        budget_stopped: budgetStopped,
        ...summarize(results, rates),
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    const status =
      error.status === undefined
        ? 'connection error'
        : `HTTP ${String(error.status)}`;
    console.error(
      `The model request failed (${status}). Completed turns remain in the recordings.`,
    );
  } else {
    console.error(
      'Live evaluation stopped. Check the local configuration, options and output directory.',
    );
  }
  process.exitCode = 1;
}
