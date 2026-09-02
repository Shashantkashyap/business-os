import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { registerStudioHandlers } from '../sockets/studio.socket.js';
import { setupMobileStudioSockets } from '../sockets/mobile-studio.handler.js';

let io: Server | null = null;

export const initSocket = (server: HTTPServer) => {
  if (process.env.VERCEL) {
    return null; // Don't initialize real sockets on Vercel
  }

  io = new Server(server, {
    cors: {
      origin: '*', // For development, allow all
      methods: ['GET', 'POST']
    }
  });

  setupMobileStudioSockets(io);

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Register Studio specific socket handlers
    registerStudioHandlers(io!, socket);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    // Provide a dummy mock for Vercel to prevent crashes when controllers call emit
    if (process.env.VERCEL) {
      return {
        emit: (..._args: any[]) => {
          // Mock emit, does nothing on Vercel Serverless
        }
      } as unknown as Server;
    }
    throw new Error('Socket.io is not initialized');
  }
  return io;
};
