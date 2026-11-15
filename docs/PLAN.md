# Milestones

## Repository setup — complete

Set up strict TypeScript, formatting, linting and a credential-free CI workflow. CI uses Node.js 22 and a committed npm lockfile.

## MCP server — complete

The Demo Plant Shop tools, help resources and support prompt run over stdio and local Streamable HTTP with `@modelcontextprotocol/sdk`. MCP client tests cover tool results, validation, order lookup and return confirmation. The compiled stdio entry point is documented for local clients.

## Tool use and evaluation — planned

Connect the Anthropic Messages API to the MCP client. Add a labeled dataset and deterministic graders for tool selection, grounding, privacy, write safety, injection and out-of-scope questions. Replay recorded tool use in CI and run live evaluations separately when approved.

## Results and documentation — planned

Generate the README results from committed measurements. Document reproduction, limitations and a before-and-after change based on the weakest measured category.
