import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const toolInputSchema = z.record(z.string(), z.json());
export type ToolInput = z.infer<typeof toolInputSchema>;

export const confirmedReturnSchema = z.object({
  order_id: z.string(),
  email: z.email(),
  reason: z.string(),
});
export type ConfirmedReturn = z.infer<typeof confirmedReturnSchema>;

export const turnSchema = z.object({
  latency_ms: z.number().nonnegative(),
  response: z.looseObject({
    model: z.string().min(1),
    stop_reason: z.string().nullable(),
    content: z.array(z.unknown()),
    usage: z.looseObject({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
      cache_creation_input_tokens: z.number().int().nonnegative().nullish(),
      cache_read_input_tokens: z.number().int().nonnegative().nullish(),
    }),
  }),
});
export type RecordedTurn = z.infer<typeof turnSchema>;
export type ModelRequest = Anthropic.MessageCreateParamsNonStreaming;
export type Generate = (
  request: ModelRequest,
) => Promise<RecordedTurn | undefined>;

export interface ToolTrace {
  name: string;
  input: ToolInput;
  output: unknown;
  error: boolean;
  blocked: boolean;
}
