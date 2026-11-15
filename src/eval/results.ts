import type { AgentResult } from '../agent/run.js';
import type { EvalCase } from './cases.js';
import { categories } from './cases.js';
import { type Rates, estimateCost, tokenUsage } from './cost.js';
import { gradeCase } from './grade.js';
import type { Recording } from './recordings.js';

export function caseResult(
  scenario: EvalCase,
  result: AgentResult,
  recording: Recording,
) {
  const grade = gradeCase(scenario, result);
  const usage = recording.turns.reduce(
    (sum, turn) => {
      const { input, output } = tokenUsage(turn);
      return { input: sum.input + input, output: sum.output + output };
    },
    { input: 0, output: 0 },
  );
  const measured = recording.source === 'live';
  return {
    id: scenario.id,
    category: scenario.category,
    stop: result.stop,
    passed: result.stop === 'budget' ? null : grade.passed,
    checks: result.stop === 'budget' ? [] : grade.checks,
    cited_ids: grade.cited_ids,
    retrieved_ids: grade.retrieved_ids,
    api_turns: recording.turns.length,
    input_tokens: measured ? usage.input : null,
    output_tokens: measured ? usage.output : null,
    latency_ms:
      measured && recording.turns.length
        ? recording.turns.reduce((sum, turn) => sum + turn.latency_ms, 0)
        : null,
  };
}

export type CaseResult = ReturnType<typeof caseResult>;

function percentile(sorted: number[], quantile: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.ceil(sorted.length * quantile) - 1];
}

export function summarize(results: CaseResult[], rates?: Rates) {
  const latency = results
    .flatMap(({ latency_ms }) => (latency_ms === null ? [] : [latency_ms]))
    .sort((a, b) => a - b);
  const input = results.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0);
  const output = results.reduce(
    (sum, row) => sum + (row.output_tokens ?? 0),
    0,
  );
  return {
    cases_evaluated: results.filter(({ passed }) => passed !== null).length,
    cases_passed: results.filter(({ passed }) => passed === true).length,
    by_category: Object.fromEntries(
      categories.map((category) => {
        const evaluated = results.filter(
          (row) => row.category === category && row.passed !== null,
        );
        const passed = evaluated.filter((row) => row.passed).length;
        return [
          category,
          {
            evaluated: evaluated.length,
            passed,
            pass_rate: evaluated.length ? passed / evaluated.length : null,
          },
        ];
      }),
    ),
    model_turns: results.reduce((sum, row) => sum + row.api_turns, 0),
    total_tokens: rates ? { input, output, total: input + output } : null,
    latency_ms: {
      p50: percentile(latency, 0.5),
      p95: percentile(latency, 0.95),
    },
    estimated_cost_usd: rates ? estimateCost(input, output, rates) : null,
  };
}
