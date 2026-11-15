import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createShopServer } from '../src/server.js';

const delivered = { order_id: 'ORD-1001', email: 'fern@example.invalid' };

describe('Demo Plant Shop MCP server', () => {
  let client: Client;

  beforeEach(async () => {
    client = new Client({ name: 'shop-test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await createShopServer().connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  it('advertises the tools with input and output schemas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(({ name }) => name)).toEqual([
      'search_help_articles',
      'get_help_article',
      'get_order_status',
      'find_plants',
      'create_return_request',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.type).toBe('object');
    }
  });

  it('ranks the relevant article first and respects the result limit', async () => {
    const result = await client.callTool({
      name: 'search_help_articles',
      arguments: { query: 'How long until the refund?', limit: 1 },
    });
    expect(result.structuredContent).toEqual({
      articles: [
        {
          id: 'return-02',
          title: 'Refund timing',
          snippet:
            'Approved refunds are processed within five working days after inspection. The refund goes back to the original payment method.',
        },
      ],
    });
  });

  it('returns no articles for an unrelated query', async () => {
    const result = await client.callTool({
      name: 'search_help_articles',
      arguments: { query: 'lunar eclipse', limit: 5 },
    });
    expect(result.structuredContent).toEqual({ articles: [] });
  });

  it('reads an article by its search ID and exposes the same text as an MCP resource', async () => {
    const { resources } = await client.listResources();
    const resource = resources.find(({ name }) => name === 'care-01');
    if (!resource) throw new Error('Expected a watering resource');
    expect(resource.uri).toBe('plant-shop://help/care-01');
    const { contents } = await client.readResource({ uri: resource.uri });
    expect(contents).toHaveLength(1);
    const content = contents[0];
    if (!('text' in content)) throw new Error('Expected a text resource');
    const body = content.text;
    expect(body).toMatch(/soil/i);

    const result = await client.callTool({
      name: 'get_help_article',
      arguments: { id: 'care-01' },
    });
    expect(result.structuredContent).toEqual({
      article: { id: 'care-01', title: 'Watering indoor plants', body },
    });
  });

  it('returns a typed error for an unknown article', async () => {
    const result = await client.callTool({
      name: 'get_help_article',
      arguments: { id: 'missing' },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: { code: 'not_found', message: 'Not found.' },
    });
  });

  it('reveals only the status when the order and email match', async () => {
    const result = await client.callTool({
      name: 'get_order_status',
      arguments: { order_id: 'ord-1001', email: '  FERN@example.invalid  ' },
    });
    expect(result.structuredContent).toEqual({ status: 'delivered' });
    expect(result.content).toEqual([
      { type: 'text', text: '{"status":"delivered"}' },
    ]);
  });

  it('uses the same error for unknown and unauthorized orders in both tools', async () => {
    for (const name of ['get_order_status', 'create_return_request']) {
      const extras =
        name === 'create_return_request'
          ? { reason: 'Damaged pot', confirm: true }
          : {};
      const wrongEmail = await client.callTool({
        name,
        arguments: { ...delivered, email: 'moss@example.invalid', ...extras },
      });
      const wrongOrder = await client.callTool({
        name,
        arguments: { ...delivered, order_id: 'ORD-9999', ...extras },
      });
      expect(wrongEmail).toEqual(wrongOrder);
      expect(wrongEmail.isError).toBe(true);
      expect(wrongEmail.structuredContent).toEqual({
        error: { code: 'not_found', message: 'Not found.' },
      });
      expect(wrongEmail.content).toEqual([
        {
          type: 'text',
          text: '{"error":{"code":"not_found","message":"Not found."}}',
        },
      ]);
    }
  });

  it.each([
    { pet_safe: true, max_price: 24, name: 'Parlor palm', id: 'parlor-palm' },
    {
      pet_safe: false,
      max_price: 15,
      name: 'Golden pothos',
      id: 'golden-pothos',
    },
  ])(
    'filters for low light, pet safety $pet_safe and an inclusive price',
    async ({ pet_safe, max_price, name, id }) => {
      const result = await client.callTool({
        name: 'find_plants',
        arguments: { light: 'low', pet_safe, max_price },
      });
      expect(result.structuredContent).toEqual({
        plants: [{ id, name, light: 'low', pet_safe, price: max_price }],
      });
    },
  );

  it('allows both plant filters to be omitted', async () => {
    const result = await client.callTool({
      name: 'find_plants',
      arguments: { light: 'low' },
    });
    const { plants } = z
      .object({ plants: z.array(z.object({ id: z.string() })) })
      .parse(result.structuredContent);
    const ids = plants.map(({ id }) => id);
    expect(ids).toContain('parlor-palm');
    expect(ids).toContain('golden-pothos');
  });

  it('previews by default and writes once only after an explicit confirmation', async () => {
    const name = 'create_return_request';
    for (const confirm of [undefined, false]) {
      const preview = await client.callTool({
        name,
        arguments: { ...delivered, reason: 'Preview reason', confirm },
      });
      expect(preview.structuredContent).toEqual({
        order_id: delivered.order_id,
        reason: 'Preview reason',
        status: 'preview',
        request_id: null,
      });
    }

    const confirmed = await client.callTool({
      name,
      arguments: { ...delivered, reason: 'Cracked pot', confirm: true },
    });
    expect(confirmed.structuredContent).toEqual({
      order_id: delivered.order_id,
      reason: 'Cracked pot',
      status: 'pending',
      request_id: 'RET-0001',
    });
    const retry = await client.callTool({
      name,
      arguments: { ...delivered, reason: 'Different reason', confirm: true },
    });
    expect(retry.structuredContent).toEqual(confirmed.structuredContent);
  });

  it('declines a return for an order that has yet to be delivered', async () => {
    const result = await client.callTool({
      name: 'create_return_request',
      arguments: {
        order_id: 'ORD-1002',
        email: 'moss@example.invalid',
        reason: 'Wrong item',
        confirm: true,
      },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        code: 'not_eligible',
        message: 'Returns can be requested for delivered orders only.',
      },
    });
  });

  it.each([
    { name: 'search_help_articles', args: { query: 'refund', limit: 11 } },
    { name: 'get_help_article', args: { id: ' ' } },
    {
      name: 'get_order_status',
      args: { order_id: 'ORD-1001', email: 'invalid' },
    },
    { name: 'find_plants', args: { light: 'ultraviolet' } },
    { name: 'find_plants', args: { light: 'low', max_price: -1 } },
    {
      name: 'create_return_request',
      args: { ...delivered, reason: 'Damaged pot', confirm: 'true' },
    },
    {
      name: 'create_return_request',
      args: { ...delivered, reason: ' ', confirm: true },
    },
  ])(
    'rejects invalid arguments for $name with no stack trace',
    async ({ name, args }) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      const message = JSON.stringify(result.content);
      expect(message).toMatch(/invalid/i);
      expect(message).not.toMatch(/\bstack\b|node_modules|RET-\d/);
    },
  );

  it('lists and renders the customer support prompt', async () => {
    const name = 'answer_customer_question';
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual([name]);
    const { messages } = await client.getPrompt({
      name,
      arguments: { question: 'How can I return my plant?' },
    });
    expect(messages).toHaveLength(1);
    const message = messages[0].content;
    if (message.type !== 'text')
      throw new Error('Expected the prompt to contain text');
    expect(message.text).toContain('How can I return my plant?');
    expect(message.text).toContain('explicitly confirm');
  });
});
