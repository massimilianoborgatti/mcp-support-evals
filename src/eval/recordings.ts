import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { maxSteps } from '../agent/run.js';
import { turnSchema } from '../agent/types.js';
import { safeNameSchema } from './cases.js';

const ratesSchema = z.object({
  input_per_million: z.number().positive(),
  output_per_million: z.number().positive(),
});
const runIdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
const recordingSchema = z.object({
  source: z.enum(['scripted', 'live']),
  model: safeNameSchema,
  run_id: runIdSchema,
  case_id: safeNameSchema,
  budget_usd: z.number().positive().optional(),
  rates: ratesSchema.optional(),
  state: z.enum(['running', 'complete', 'budget']),
  turns: z.array(turnSchema).max(maxSteps),
});

export type Recording = z.infer<typeof recordingSchema>;

const root = new URL('../../evals/', import.meta.url);

export async function writeJson(directory: URL, name: string, data: unknown) {
  await mkdir(directory, { recursive: true });
  const target = new URL(name, directory);
  const temporary = new URL(`${name}.${String(process.pid)}.tmp`, directory);
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
}

export function saveRecording(recording: Recording) {
  const directory = new URL(`recordings/${recording.model}/`, root);
  return writeJson(directory, `${recording.case_id}.json`, recording);
}

export function saveResults(
  model: string,
  runId: string,
  replay: boolean,
  data: unknown,
) {
  return writeJson(
    new URL('results/', root),
    `${model}-${runId}${replay ? '.replay' : ''}.json`,
    data,
  );
}

export async function readRecordings(
  model: string,
  requestedRun?: string,
): Promise<Recording[]> {
  const directory = new URL(`recordings/${model}/`, root);
  const recordings = await Promise.all(
    (await readdir(directory))
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => {
        const data: unknown = JSON.parse(
          await readFile(new URL(name, directory), 'utf8'),
        );
        const recording = recordingSchema.parse(data);
        if (recording.model !== model || name !== `${recording.case_id}.json`)
          throw new Error(`Unexpected recording metadata in ${name}.`);
        return recording;
      }),
  );
  const runId =
    requestedRun ??
    recordings
      .map(({ run_id }) => run_id)
      .sort()
      .at(-1);
  const selected = recordings.filter(({ run_id }) => run_id === runId);
  if (!selected.length) throw new Error('No recordings found for that run.');
  if (selected.some(({ state }) => state === 'running'))
    throw new Error('The run contains an unfinished recording.');
  return selected;
}
