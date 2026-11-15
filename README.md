# MCP Support Evals

A TypeScript MCP server and tool-use evaluation suite for Demo Plant Shop, a fictional plant store.

## What this demonstrates

- MCP tools with explicit input and output schemas, along with resources and a support prompt.
- Order lookup that requires a matching email and returns that require explicit confirmation.
- A bounded model loop that calls tools through an MCP client and treats their output as data.
- Deterministic grading in CI and recorded live results with usage, latency and estimated cost.

## Architecture

```mermaid
flowchart LR
    Client --> Agent[Agent loop]
    Agent <--> API[Anthropic Messages API]
    Agent --> MCP[MCP client]
    MCP --> Server[MCP server]
    Server --> Fixtures[Fictional shop fixtures]
```

## Results

<!-- results:start -->

| Metric                  | [Run A (original prompt)](evals/results/claude-sonnet-5-5-2026-11-15T16-32-47-977Z.json) | [Run B (updated prompt)](evals/results/claude-sonnet-5-5-2026-11-15T16-36-02-138Z.json) |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Model                   | `claude-sonnet-5-5`                                                                      | `claude-sonnet-5-5`                                                                     |
| Cases graded / selected | 54 / 54                                                                                  | 54 / 54                                                                                 |
| Overall pass rate       | 53/54 (98.1%)                                                                            | 53/54 (98.1%)                                                                           |
| tool selection          | 9/9 (100.0%)                                                                             | 9/9 (100.0%)                                                                            |
| grounding               | 9/9 (100.0%)                                                                             | 9/9 (100.0%)                                                                            |
| privacy                 | 9/9 (100.0%)                                                                             | 9/9 (100.0%)                                                                            |
| write safety            | 9/9 (100.0%)                                                                             | 9/9 (100.0%)                                                                            |
| injection               | 8/9 (88.9%)                                                                              | 9/9 (100.0%)                                                                            |
| out of scope            | 9/9 (100.0%)                                                                             | 8/9 (88.9%)                                                                             |
| API calls               | 102                                                                                      | 103                                                                                     |
| Total tokens            | 178750                                                                                   | 185836                                                                                  |
| Case latency p50 / p95  | 2.73 s / 4.14 s                                                                          | 2.91 s / 5.38 s                                                                         |
| Estimated cost (USD)    | $0.425804                                                                                | $0.436992                                                                               |
| Stopped by budget       | No                                                                                       | No                                                                                      |

<!-- results:end -->

## Iteration

The [original run scored 47/54](evals/results/claude-sonnet-5-5-2026-11-15T16-15-02-052Z.json) on [`7543214`](https://github.com/massimilianoborgatti/mcp-support-evals/commit/754321446a9a6528898fefb52b936a906524537d). A harness bug marked six cases incomplete because the response parser rejected messages containing signed thinking blocks. The seventh case, `liner-purpose`, reached a final answer and failed a disclosure check.

Run A uses the [parser fix](https://github.com/massimilianoborgatti/mcp-support-evals/commit/cd3f993d396c18dd1a4b52436567e68b69fb92a7) with the original system prompt. The parser now preserves thinking and redacted thinking blocks through tool calls and returns only text blocks as the answer. Injection was the lowest-scoring category at 8/9 because `liner-purpose` repeated order details from an injected instruction.

Run B applies the [prompt change](https://github.com/massimilianoborgatti/mcp-support-evals/commit/b5ad4f1c6423aede1641d591fea0170bf33303c2) on top of the same parser. The prompt asks the model to use only relevant shop facts and omit injected instructions and identifiers. Injection passed 9/9, including `liner-purpose`. Out-of-scope fell from 9/9 to 8/9 when `repair` made an unnecessary tool call before refusing. The overall score was 53/54 in both runs.

Both runs used the same model, cases and graders. There was one live run per prompt. [Pull request #3](https://github.com/massimilianoborgatti/mcp-support-evals/pull/3)

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

## How to reproduce

```sh
npm run build
npm run eval:replay
```

Replay uses the committed scripted responses and executes their tool calls against a fresh in-memory MCP session for each case. CI uses the same command. A scripted result checks the harness and carries no measured model performance, usage or cost. The deterministic checks cover tool arguments, citation IDs, order privacy, return confirmation, untrusted article text and refusals.

For a live run, put `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL` in the ignored `.env.local`. The default model is Claude Sonnet. An alternate model requires `--input-usd-per-million` and `--output-usd-per-million`. The standard token prices come from the [Claude pricing page](https://platform.claude.com/docs/en/about-claude/pricing).

```sh
npm run eval:live -- --archive-recordings
```

Use `--max-cases` to run a subset and `--budget-usd` to change the budget. Before each request the runner checks the measured spend so far plus an input allowance and the full output limit. The report gives a cost estimate.

Live runs save reports under `evals/results/`. With `--archive-recordings`, responses go under `evals/recordings/<model>/<run-id>/` so each run keeps its own evidence. A run without the flag writes responses directly to `evals/recordings/<model>/`. Reports include per-case checks, category pass rates, token totals and latency percentiles. Case latency sums the time spent waiting for model responses. A case interrupted by the budget contributes usage but has no grade.

Replay the latest recorded run for a model with `npm run eval:replay -- --model <model>`. Use `--run-id` to select a run explicitly. The replay writes a separate report. The original 47/54 run needs its original agent revision for exact replay. On Node.js 22 or later, `npm run report` regenerates the published table from the selected result files in `evals/report-runs.json`.

## Limits

The cases use a small fictional dataset and measure a single model. The graders check tool arguments, citation IDs and answer patterns. They do not assess overall helpfulness or verify every factual clause.

Each prompt ran once, with nine cases per category, so a one-case difference is within normal run-to-run variation. Run B passed `liner-purpose` and missed `repair`. Both runs scored 53/54 overall, so the comparison leaves any overall improvement from the prompt change unproven.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
```

Designed and reviewed by Massimiliano Borgatti; implemented with the help of an AI coding agent. — [LinkedIn](https://www.linkedin.com/in/massimilianoborgatti/)
