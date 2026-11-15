# Engineering log

## Repository setup

Configured strict TypeScript, ESLint, Prettier and Vitest with a pinned CI workflow. The environment template contains placeholders for local settings. The test command can run before the first server tests are added.

A clean `npm ci`, format check, lint and type check passed. Vitest discovered no tests during setup. The lint dependency override selects the patched `minimatch` release for the TypeScript parser. `npm audit` reported no known vulnerabilities in the installed dependencies.

## MCP server

Implemented BM25 article search, article resources, order status lookup, catalog filters and return requests over stdio and local Streamable HTTP. Unknown orders and email mismatches share the same response. Return previews do not write, and repeated confirmations reuse the stored request.

Enabled the strict and stylistic type-checked ESLint presets through project service. Added a separate TypeScript build configuration and executable entry points for the two transports.

Formatting, lint, type checking, the build and all 22 tests passed. The MCP client suite covers schemas, validation, order privacy, return confirmation, resources and the support prompt. Both built entry points connected from outside the checkout. `npm audit` reported no known vulnerabilities.

## Tool use and evaluation

Added a bounded Anthropic Messages API tool loop and shared deterministic grading for live and replay modes. Each case uses a fresh in-memory MCP session. Confirmed returns require exact case authorization, and attempted writes remain visible to the grader when they are blocked. Adversarial articles are loaded only in injection cases.

Made the search limit optional, marked repeated return submissions with `already_exists` and replaced local paths in the client examples. MCP application errors retain their typed JSON in error content so clients can validate successful structured results against their advertised schemas.

The committed scripted recordings passed all 54 cases across six categories in 105 model turns. This verifies the harness with scripted inputs. Live model performance, latency, token usage and costs remain unmeasured pending the first run.

Formatting, type-aware lint, type checking, the build and all 28 tests passed. Replay produced the same report with `fetch` disabled. The dependency audit reported no known vulnerabilities.

## Results and documentation

On 2026-11-15, the Claude Sonnet 5.5 smoke run passed all three selected cases. The first full live run graded 54 cases and passed 47. It used 99 model calls at an estimated $0.413340 and finished within the $2 budget. Replay on the original agent matched the saved per-case results and aggregate metrics. Six cases were marked incomplete when the parser rejected thinking blocks.

Run A isolated the parser repair and kept the original prompt. It passed 53/54 in 102 calls at an estimated $0.425804. Injection was the only category with a failure. The answer to `liner-purpose` still repeated identifiers from the article.

Run B applied the prompt change and passed 53/54 in 103 calls at an estimated $0.436992. Injection passed 9/9. The remaining failure was a tool call on the out-of-scope `repair` case. Both live runs used the same 54 cases and finished within their separate $2 budgets.

The original results are linked from the write-up. The README table is generated from Run A and Run B. Offline replay reproduced both result sets exactly. The archived recordings and results passed the credential and header checks.
