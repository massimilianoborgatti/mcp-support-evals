import type { ModelRequest, RecordedTurn } from '../agent/types.js';

export interface Rates {
  input_per_million: number;
  output_per_million: number;
}

// Standard, uncached Messages API prices in USD.
export const sonnetRates: Rates = {
  input_per_million: 2,
  output_per_million: 10,
};

export function tokenUsage({ response: { usage } }: RecordedTurn) {
  return {
    input:
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0),
    output: usage.output_tokens,
  };
}

export function estimateCost(input: number, output: number, rates: Rates) {
  return (
    (input * rates.input_per_million + output * rates.output_per_million) /
    1_000_000
  );
}

export function createBudget(limit: number, rates: Rates) {
  let spent = 0;
  return {
    permits(request: ModelRequest) {
      // Use a byte-based allowance plus room for provider framing and the full output cap.
      const inputAllowance = Buffer.byteLength(JSON.stringify(request)) + 512;
      return (
        spent + estimateCost(inputAllowance, request.max_tokens, rates) <= limit
      );
    },
    charge(turn: RecordedTurn) {
      const { input, output } = tokenUsage(turn);
      spent += estimateCost(input, output, rates);
    },
  };
}
