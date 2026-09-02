import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'secret';

export const setupMobileStudioSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    
    // Join Project Room
    socket.on('mobile-studio:join-project', async (payload: { projectId: string; token: string }) => {
      try {
        const { projectId, token } = payload;
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        
        // Very basic auth/access check
        const project = await prisma.mobileProject.findUnique({
          where: { id: projectId },
          include: { collaborators: true }
        });
        
        if (!project) {
          socket.emit('mobile-studio:error', { message: 'Project not found' });
          return;
        }
        
        if (project.isDisabled) {
          socket.emit('mobile-studio:error', { message: 'Project is disabled' });
          return;
        }

        const roomName = `mobile-studio:project:${projectId}`;
        socket.join(roomName);
        
        // Track presence
        (socket as any).mobileStudioData = {
          projectId,
          userId,
          role: project.ownerId === userId ? 'OWNER' : 'COLLABORATOR' // Simplified for now
        };

        const clients = io.sockets.adapter.rooms.get(roomName);
        io.to(roomName).emit('mobile-studio:user-presence', {
          userId,
          action: 'joined',
          clientsCount: clients ? clients.size : 1
        });
      } catch (error) {
         socket.emit('mobile-studio:error', { message: 'Authentication failed or access denied' });
      }
    });

    // Leave Project Room
    socket.on('mobile-studio:leave-project', (payload: { projectId: string }) => {
       const roomName = `mobile-studio:project:${payload.projectId}`;
       socket.leave(roomName);
       const clients = io.sockets.adapter.rooms.get(roomName);
       if ((socket as any).mobileStudioData) {
         io.to(roomName).emit('mobile-studio:user-presence', {
           userId: (socket as any).mobileStudioData.userId,
           action: 'left',
           clientsCount: clients ? clients.size : 0
         });
       }
    });

    // Code editing updates
    socket.on('mobile-studio:file-content-change', (payload: { projectId: string; fileId: string; content: string }) => {
      const roomName = `mobile-studio:project:${payload.projectId}`;
      // Broadcast to everyone else in the room
      socket.to(roomName).emit('mobile-studio:file-content-change', payload);
    });

    // Visual Widget updating (Design Mode)
    socket.on('mobile-studio:widget-updated', (payload: { projectId: string; screenId: string; uiSchema: string }) => {
      const roomName = `mobile-studio:project:${payload.projectId}`;
      // In a real app we'd validate permissions here before broadcasting
      socket.to(roomName).emit('mobile-studio:widget-updated', payload);
    });

    socket.on('disconnect', () => {
      const data = (socket as any).mobileStudioData;
      if (data) {
        const roomName = `mobile-studio:project:${data.projectId}`;
        const clients = io.sockets.adapter.rooms.get(roomName);
        io.to(roomName).emit('mobile-studio:user-presence', {
          userId: data.userId,
          action: 'left',
          clientsCount: clients ? clients.size : 0
        });
      }
    });
  });
};
