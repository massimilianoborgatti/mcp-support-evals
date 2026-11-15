import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createShopHttpServer } from '../src/http.js';

const server = createShopHttpServer();
let endpoint: URL;

beforeAll(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing loopback address');
  endpoint = new URL(`http://127.0.0.1:${String(address.port)}/mcp`);
});

afterAll(async () => {
  server.close();
  server.closeAllConnections();
  await once(server, 'close');
});

it('serves the tools over Streamable HTTP and keeps returns across requests', async () => {
  const client = new Client({ name: 'shop-http-test', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint));
    const { tools } = await client.listTools();
    expect(tools.map(({ name }) => name)).toContain('create_return_request');

    const name = 'create_return_request';
    const args = {
      order_id: 'ORD-1001',
      email: 'fern@example.invalid',
      confirm: true,
    };
    const first = await client.callTool({
      name,
      arguments: { ...args, reason: 'Damaged pot' },
    });
    expect(first.structuredContent).toMatchObject({
      status: 'pending',
      reason: 'Damaged pot',
    });
    const retry = await client.callTool({
      name,
      arguments: { ...args, reason: 'Duplicate attempt' },
    });
    expect(retry.structuredContent).toMatchObject({
      request_id: 'RET-0001',
      status: 'pending',
      reason: 'Damaged pot',
      already_exists: true,
    });
  } finally {
    await client.close();
  }
});

it('rejects a request from another origin', async () => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Origin: 'https://example.invalid' },
  });
  expect(response.status).toBe(403);
  expect(await response.text()).toBe('Forbidden');
});
