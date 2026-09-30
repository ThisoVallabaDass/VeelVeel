import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT ?? 8787);
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(
    JSON.stringify({ service: 'veel-veel-room-relay', status: 'M3 transport scaffold only' }),
  );
});
const socket = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
server.on('upgrade', (request, stream, head) => {
  if (request.url !== '/room') {
    stream.destroy();
    return;
  }
  socket.handleUpgrade(request, stream, head, (client) => {
    client.send(JSON.stringify({ type: 'room:status', status: 'Room relay is reserved for M3.' }));
    client.close(1000, 'Room mode arrives in M3');
  });
});
server.listen(port, '0.0.0.0', () =>
  console.log(`Veel Veel room relay scaffold listening on ${port}`),
);
