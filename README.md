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
      "args": ["C:/Workspace/mcp-support-evals/dist/stdio.js"]
    }
  }
}
```

### Claude Code

Register the same built entry point from the project directory. `claude mcp get demo-plant-shop` shows the connection details.

```sh
claude mcp add --transport stdio demo-plant-shop -- node "C:/Workspace/mcp-support-evals/dist/stdio.js"
```

## Tools and resources

- `search_help_articles` ranks keyword matches with BM25 and returns article IDs, titles and snippets. `get_help_article` returns the complete article.
- `get_order_status` returns only the status when the order reference and email match. Both an unknown order and an email mismatch return `not_found`.
- `find_plants` filters by light level, optional pet safety and optional maximum price in demo credits.
- `create_return_request` previews a request for a delivered order. Only `confirm: true` records a pending request. Repeated confirmations return the existing request. The store is held in memory for the lifetime of the server process.

Clients can read help articles as MCP resources and use the `answer_customer_question` prompt to guide grounded answers. The server uses fictional fixture data and needs no API key. The [plan](docs/PLAN.md) tracks the evaluation milestones.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
```

Designed and reviewed by Massimiliano Borgatti; implemented with the help of an AI coding agent. — [LinkedIn](https://www.linkedin.com/in/massimilianoborgatti/)
