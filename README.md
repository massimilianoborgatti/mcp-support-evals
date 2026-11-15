# MCP Support Evals

A TypeScript MCP server for Demo Plant Shop, a fictional plant store.

## Run locally

```sh
npm ci
npm run build
npm start
```

The stdio process exchanges MCP messages through stdin and stdout. Use `npm run start:http` for Streamable HTTP at `http://127.0.0.1:3210/mcp`.

### MCP Inspector

From the project root, launch the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) against the built stdio entry point. Use a current Node.js LTS release.

```sh
npx @modelcontextprotocol/inspector node dist/stdio.js
```

For HTTP, start the HTTP server first, then choose Streamable HTTP in the Inspector and connect to `http://127.0.0.1:3210/mcp`.

### Claude Desktop

Add this entry to `claude_desktop_config.json`. Replace the path with the absolute path to `dist/stdio.js` in the local checkout. Use the absolute path to the Node executable as `command` if Claude Desktop cannot find `node`.

```json
{
  "mcpServers": {
    "demo-plant-shop": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-support-evals/dist/stdio.js"]
    }
  }
}
```

### Claude Code

Register the same built entry point from the project directory. `claude mcp get demo-plant-shop` shows the connection details.

```sh
claude mcp add --transport stdio demo-plant-shop -- node "/absolute/path/to/mcp-support-evals/dist/stdio.js"
```

## Tools and resources

- `search_help_articles` ranks keyword matches with BM25 and returns article IDs, titles and snippets. The result limit is optional. `get_help_article` returns the complete article.
- `get_order_status` returns only the status when the order reference and email match. Both an unknown order and an email mismatch return `not_found`.
- `find_plants` filters by light level, optional pet safety and optional maximum price in demo credits.
- `create_return_request` previews a request for a delivered order. Only `confirm: true` records a pending request. Repeated confirmations return the existing request and its original reason with `already_exists: true`. The store is held in memory for the lifetime of the server process.

Clients can read help articles as MCP resources and use the `answer_customer_question` prompt to guide grounded answers. The server uses fictional fixture data and needs no API key.

## Run the evaluations

```sh
npm run build
npm run eval:replay
```

Replay uses the committed scripted responses and executes their tool calls against a fresh in-memory MCP session for each case. CI uses the same command. A scripted result checks the harness and carries no measured model performance, usage or cost. The deterministic checks cover tool arguments, citation IDs, order privacy, return confirmation, untrusted article text and refusals.

For a live run, put `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL` in the ignored `.env.local`. The default model is Claude Sonnet. An alternate model requires `--input-usd-per-million` and `--output-usd-per-million`. The standard token prices come from the [Claude pricing page](https://platform.claude.com/docs/en/about-claude/pricing).

```sh
npm run eval:live
```

Use `--max-cases` to run a subset and `--budget-usd` to change the budget. Before each request the runner checks the measured spend so far plus an input allowance and the full output limit. The report gives a cost estimate.

Live runs save responses under `evals/recordings/<model>/` and reports under `evals/results/`. Reports include per-case checks, category pass rates, token totals and latency percentiles. Case latency sums the time spent waiting for model responses. A case interrupted by the budget contributes usage but has no grade.

Replay the latest recorded run for a model with `npm run eval:replay -- --model <model>`. The replay writes a separate report. Keep an earlier run in Git before repeating the same model so its recordings are available for comparison. The [plan](docs/PLAN.md) tracks the published results milestone.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
```

Designed and reviewed by Massimiliano Borgatti; implemented with the help of an AI coding agent. — [LinkedIn](https://www.linkedin.com/in/massimilianoborgatti/)
