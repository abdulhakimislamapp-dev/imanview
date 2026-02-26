import http from 'http';
import app from './src/app.js';
import { configureSocket } from './src/sockets/index.js';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Attach Socket.io
configureSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
