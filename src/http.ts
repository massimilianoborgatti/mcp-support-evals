import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createReturnStore } from './returns.js';
import { createShopServer } from './server.js';

export function createShopHttpServer() {
  const returns = createReturnStore();

  return createServer((request, response) => {
    const port = request.socket.localPort;
    const hosts = [`127.0.0.1:${String(port)}`, `localhost:${String(port)}`];
    const origins = hosts.map((host) => `http://${host}`);
    const { host, origin } = request.headers;

    if (
      !host ||
      !hosts.includes(host) ||
      (origin !== undefined && !origins.includes(origin))
    ) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    if (request.url !== '/mcp') {
      response.writeHead(404).end('Not found');
      return;
    }

    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' }).end('Method not allowed');
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 16 * 1024,
    });
    const server = createShopServer(returns);

    response.once('close', () => {
      server.close().catch(() => {
        console.error('Could not close the MCP transport.');
      });
    });

    server
      .connect(transport)
      .then(() => transport.handleRequest(request, response))
      .catch(() => {
        if (!response.headersSent) response.writeHead(500);
        response.end();
      });
  });
}
