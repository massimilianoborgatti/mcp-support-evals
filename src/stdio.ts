import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createShopServer } from './server.js';

const transport = new StdioServerTransport(process.stdin, process.stdout, {
  maxBufferSize: 16 * 1024,
});
await createShopServer()
  .connect(transport)
  .catch(() => {
    console.error('Could not start the stdio server.');
    process.exitCode = 1;
  });
