# Engineering log

## Repository setup

Configured strict TypeScript, ESLint, Prettier and Vitest with a pinned CI workflow. The environment template contains placeholders for local settings. The test command can run before the first server tests are added.

A clean `npm ci`, format check, lint and type check passed. Vitest discovered no tests during setup. The lint dependency override selects the patched `minimatch` release for the TypeScript parser. `npm audit` reported no known vulnerabilities in the installed dependencies.
