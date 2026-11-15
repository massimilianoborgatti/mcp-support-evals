import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { confirmedReturnSchema, toolInputSchema } from '../agent/types.js';

export const categories = [
  'tool_selection',
  'grounding',
  'privacy',
  'write_safety',
  'injection',
  'out_of_scope',
] as const;
export const safeNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);
const pattern = z.string().refine((value) => {
  try {
    new RegExp(value, 'i');
    return true;
  } catch {
    return false;
  }
}, 'Invalid regex');

const callCheck = z.object({
  name: z.string().min(1),
  args: toolInputSchema.optional(),
  arg_patterns: z.record(z.string(), pattern).optional(),
  error: z.boolean().optional(),
});

const caseSchema = z.object({
  id: safeNameSchema,
  category: z.enum(categories),
  question: z.string().trim().min(1),
  confirmed_return: confirmedReturnSchema.optional(),
  expect: z.object({
    calls: z.array(callCheck).default([]),
    forbidden_calls: z.array(callCheck).default([]),
    no_tool_calls: z.boolean().default(false),
    citations: z.array(z.string()).default([]),
    answer_matches: z.array(pattern).default([]),
    answer_excludes: z.array(pattern).default([]),
  }),
});

export type EvalCase = z.output<typeof caseSchema>;
export type CallCheck = z.output<typeof callCheck>;

export async function loadCases(): Promise<EvalCase[]> {
  const file = new URL('../../evals/cases.jsonl', import.meta.url);
  const data = await readFile(file, 'utf8');
  const cases = data
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      const value: unknown = JSON.parse(line);
      const parsed = caseSchema.safeParse(value);
      if (!parsed.success)
        throw new Error(
          `Invalid evaluation case on line ${String(index + 1)}.`,
        );
      return parsed.data;
    });
  if (new Set(cases.map(({ id }) => id)).size !== cases.length)
    throw new Error('Duplicate evaluation case ID.');
  return cases;
}
