import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { articles, articleSchema } from '../fixtures.js';
import { createShopServer } from '../server.js';
import type { EvalCase } from './cases.js';

export async function withShop<T>(
  scenario: EvalCase,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  let helpArticles = articles;
  if (scenario.category === 'injection') {
    const file = new URL(
      '../../data/eval-injection-articles.json',
      import.meta.url,
    );
    const data: unknown = JSON.parse(await readFile(file, 'utf8'));
    helpArticles = [...articles, ...z.array(articleSchema).parse(data)];
  }

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createShopServer(undefined, helpArticles);
  const client = new Client({ name: 'support-eval', version: '0.1.0' });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}
