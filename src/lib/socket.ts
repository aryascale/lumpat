import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: SocketServer | null = null;
let connectedCount = 0;

export const initSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    connectedCount += 1;
    console.log(`Socket connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      connectedCount = Math.max(0, connectedCount - 1);
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getSocketCount = () => connectedCount;

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
