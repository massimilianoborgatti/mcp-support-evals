# Milestones

## Repository setup — complete

Set up strict TypeScript, formatting, linting and a credential-free CI workflow. CI uses Node.js 22 and a committed npm lockfile.

## MCP server — complete

The Demo Plant Shop tools, help resources and support prompt run over stdio and local Streamable HTTP with `@modelcontextprotocol/sdk`. MCP client tests cover tool results, validation, order lookup and return confirmation. The compiled stdio entry point is documented for local clients.

## Tool use and evaluation — complete

The Anthropic Messages API loop and the deterministic graders use the same MCP client in live and replay modes. The committed scripted recordings cover tool selection, grounding, privacy, write safety, injection and out-of-scope questions.

## Results and documentation — in progress

The README table is generated from the committed live baseline. The weakest category was injection. Record the effect of the response parsing and prompt changes in a separate live run under the same suite and budget.
