import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';

const start = '<!-- results:start -->';
const end = '<!-- results:end -->';
const root = new URL('../', import.meta.url);
const readme = new URL('README.md', root);
const fileName = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]+\.json$/);
const selectionSchema = z.object({
  baseline: fileName,
  follow_up: fileName.optional(),
});
const count = z.number().int().nonnegative();
const rate = z.object({
  evaluated: count,
  passed: count,
  pass_rate: z.number().min(0).max(1).nullable(),
});
const resultSchema = z.object({
  source: z.literal('live'),
  model: z.string(),
  served_models: z.array(z.string()).min(1),
  budget_stopped: z.boolean(),
  cases_selected: count,
  summary: z.object({
    cases_evaluated: count,
    cases_passed: count,
    by_category: z.record(z.string(), rate),
    model_turns: count,
    total_tokens: z.object({ total: count }),
    latency_ms: z.object({
      p50: z.number().nonnegative().nullable(),
      p95: z.number().nonnegative().nullable(),
    }),
    estimated_cost_usd: z.number().nonnegative(),
  }),
});

type Result = z.infer<typeof resultSchema>;

async function readJson(url: URL): Promise<unknown> {
  const value: unknown = JSON.parse(await readFile(url, 'utf8'));
  return value;
}

function percent(passed: number, evaluated: number) {
  if (!evaluated) return '—';
  return `${String(passed)}/${String(evaluated)} (${((100 * passed) / evaluated).toFixed(1)}%)`;
}

function latency(value: number | null) {
  return value === null ? '—' : `${(value / 1000).toFixed(2)} s`;
}

function render(runs: { label: string; file: string; data: Result }[]) {
  const rows = [
    [
      'Metric',
      ...runs.map(({ label, file }) => `[${label}](evals/results/${file})`),
    ],
    ['---', ...runs.map(() => '---')],
    [
      'Model',
      ...runs.map(({ data }) =>
        data.served_models.map((name) => `\`${name}\``).join(', '),
      ),
    ],
    [
      'Cases graded / selected',
      ...runs.map(
        ({ data }) =>
          `${String(data.summary.cases_evaluated)} / ${String(data.cases_selected)}`,
      ),
    ],
    [
      'Overall pass rate',
      ...runs.map(({ data }) =>
        percent(data.summary.cases_passed, data.summary.cases_evaluated),
      ),
    ],
  ];
  const categories = new Set(
    runs.flatMap(({ data }) => Object.keys(data.summary.by_category)),
  );
  for (const category of categories) {
    rows.push([
      category.replaceAll('_', ' '),
      ...runs.map(({ data }) => {
        const item = Object.entries(data.summary.by_category).find(
          ([key]) => key === category,
        )?.[1];
        return item ? percent(item.passed, item.evaluated) : '—';
      }),
    ]);
  }
  rows.push(
    ['API calls', ...runs.map(({ data }) => String(data.summary.model_turns))],
    [
      'Total tokens',
      ...runs.map(({ data }) => String(data.summary.total_tokens.total)),
    ],
    [
      'Case latency p50 / p95',
      ...runs.map(
        ({ data }) =>
          `${latency(data.summary.latency_ms.p50)} / ${latency(data.summary.latency_ms.p95)}`,
      ),
    ],
    [
      'Estimated cost (USD)',
      ...runs.map(
        ({ data }) => `$${data.summary.estimated_cost_usd.toFixed(6)}`,
      ),
    ],
    [
      'Stopped by budget',
      ...runs.map(({ data }) => (data.budget_stopped ? 'Yes' : 'No')),
    ],
  );
  return rows.map((columns) => `| ${columns.join(' | ')} |`).join('\n');
}

const { values } = parseArgs({ options: { check: { type: 'boolean' } } });
const selection = selectionSchema.parse(
  await readJson(new URL('evals/report-runs.json', root)),
);
const runs = [];
for (const [label, file] of [
  ['Baseline', selection.baseline],
  ['Follow-up', selection.follow_up],
] as const) {
  if (!file) continue;
  const data = resultSchema.parse(
    await readJson(new URL(`evals/results/${file}`, root)),
  );
  runs.push({ label, file, data });
}

const original = await readFile(readme, 'utf8');
const from = original.indexOf(start);
const to = original.indexOf(end);
if (
  from < 0 ||
  to <= from ||
  from !== original.lastIndexOf(start) ||
  to !== original.lastIndexOf(end)
) {
  throw new Error('Expected a single pair of results markers in README.md.');
}

const updated = `${original.slice(0, from + start.length)}\n\n${render(runs)}\n\n${original.slice(to)}`;
const config = await resolveConfig(readme);
const formatted = await format(updated, { ...config, parser: 'markdown' });
if (values.check) {
  if (formatted !== original)
    throw new Error('README is out of date. Run npm run report.');
} else if (formatted !== original) {
  await writeFile(readme, formatted, 'utf8');
}
