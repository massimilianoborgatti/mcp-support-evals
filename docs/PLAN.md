# Milestones

## Repository setup — complete

Set up strict TypeScript, formatting, linting and a credential-free CI workflow. CI uses Node.js 22 and a committed npm lockfile.

## MCP server — complete

The Demo Plant Shop tools, help resources and support prompt run over stdio and local Streamable HTTP with `@modelcontextprotocol/sdk`. MCP client tests cover tool results, validation, order lookup and return confirmation. The compiled stdio entry point is documented for local clients.

## Tool use and evaluation — complete

The Anthropic Messages API loop and the deterministic graders use the same MCP client in live and replay modes. The committed scripted recordings cover tool selection, grounding, privacy, write safety, injection and out-of-scope questions.

## Results and documentation — complete

The README table compares two committed live runs with the same parser, cases and budget. The original run documents the thinking-block defect. A separate evaluation measures the prompt change after the parser repair.
