import { createShopHttpServer } from './http.js';

const server = createShopHttpServer();
server.on('error', () => {
  console.error('Could not listen on http://127.0.0.1:3210/mcp.');
  process.exitCode = 1;
});
server.listen(3210, '127.0.0.1', () => {
  console.error('Listening on http://127.0.0.1:3210/mcp');
});
