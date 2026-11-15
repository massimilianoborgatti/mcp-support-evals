# Engineering log

## Repository setup

Configured strict TypeScript, ESLint, Prettier and Vitest with a pinned CI workflow. The environment template contains placeholders for local settings. The test command can run before the first server tests are added.

A clean `npm ci`, format check, lint and type check passed. Vitest discovered no tests during setup. The lint dependency override selects the patched `minimatch` release for the TypeScript parser. `npm audit` reported no known vulnerabilities in the installed dependencies.

## MCP server

Implemented BM25 article search, article resources, order status lookup, catalog filters and return requests over stdio and local Streamable HTTP. Unknown orders and email mismatches share the same response. Return previews do not write, and repeated confirmations reuse the stored request.

Enabled the strict and stylistic type-checked ESLint presets through project service. Added a separate TypeScript build configuration and executable entry points for the two transports.

Formatting, lint, type checking, the build and all 22 tests passed. The MCP client suite covers schemas, validation, order privacy, return confirmation, resources and the support prompt. Both built entry points connected from outside the checkout. `npm audit` reported no known vulnerabilities.
