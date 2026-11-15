import { parseArgs } from 'node:util';
import { runAgent } from '../agent/run.js';
import { loadCases, safeNameSchema } from './cases.js';
import { readRecordings, saveResults } from './recordings.js';
import { caseResult, type CaseResult, summarize } from './results.js';
import { withShop } from './shop.js';

async function main() {
  const { values } = parseArgs({
    options: {
      model: { type: 'string', default: 'scripted' },
      'run-id': { type: 'string' },
    },
  });
  const model = safeNameSchema.parse(values.model);
  const [cases, recordings] = await Promise.all([
    loadCases(),
    readRecordings(model, values['run-id']),
  ]);
  const first = recordings[0];
  const byId = new Map(
    recordings.map((recording) => [recording.case_id, recording]),
  );
  const results: CaseResult[] = [];

  for (const scenario of cases) {
    const recording = byId.get(scenario.id);
    if (!recording) {
      if (first.source === 'scripted')
        throw new Error(`Missing scripted recording for ${scenario.id}.`);
      continue;
    }

    let consumed = 0;
    const result = await withShop(scenario, (client) =>
      runAgent(
        client,
        () => {
          const turn = recording.turns.at(consumed);
          if (!turn && recording.state !== 'budget')
            throw new Error(`Recording ended early for ${scenario.id}.`);
          if (turn) consumed++;
          return Promise.resolve(turn);
        },
        model,
        scenario.question,
        scenario.confirmed_return,
      ),
    );
    if (
      consumed !== recording.turns.length ||
      (result.stop === 'budget') !== (recording.state === 'budget')
    ) {
      throw new Error(
        `Recording does not match the agent loop for ${scenario.id}.`,
      );
    }
    results.push(caseResult(scenario, result, recording));
    byId.delete(scenario.id);
  }
  if (byId.size) throw new Error('A recording refers to an unknown case.');

  const summary = summarize(results, first.rates);
  await saveResults(model, first.run_id, true, {
    source: first.source,
    model,
    run_id: first.run_id,
    summary,
    cases: results,
  });
  console.log(
    JSON.stringify({ source: first.source, model, ...summary }, null, 2),
  );
  const failures = results.filter(({ passed }) => passed === false);
  for (const row of failures) {
    const failedChecks = row.checks
      .filter(({ passed }) => !passed)
      .map(({ check }) => check);
    console.error(`${row.id} failed ${failedChecks.join(', ')}`);
  }
  if (first.source === 'scripted' && failures.length) process.exitCode = 1;
}

await main();
