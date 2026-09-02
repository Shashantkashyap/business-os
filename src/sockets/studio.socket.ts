import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const registerStudioHandlers = (_io: Server, socket: Socket) => {
  // Join a project room
  socket.on('studio:join-project', async (payload: { projectId: string, token: string }) => {
    try {
      const decoded = jwt.verify(payload.token, process.env.JWT_ACCESS_SECRET || 'secret') as any;
      const userId = decoded.id;

      // Verify access to project
      const project = await prisma.websiteProject.findUnique({
        where: { id: payload.projectId },
        include: { collaborators: true }
      });

      if (!project) return;

      let hasAccess = false;
      if (project.ownerId === userId) hasAccess = true;
      if (project.collaborators.some(c => c.userId === userId)) hasAccess = true;
      if (project.visibility === 'Team' && decoded.companyId === project.companyId) hasAccess = true;

      if (!hasAccess || project.status === 'DISABLED') {
        socket.emit('studio:error', { message: 'Access denied to this project.' });
        return;
      }

      const roomName = `studio:project:${payload.projectId}`;
      socket.join(roomName);

      // Save socket connection info
      (socket as any).userId = userId;
      (socket as any).projectId = payload.projectId;

      // Broadcast to room that user joined
      socket.to(roomName).emit('studio:user-presence', {
        userId,
        action: 'joined'
      });

    } catch (err) {
      socket.emit('studio:error', { message: 'Authentication failed.' });
    }
  });

  // Leave project room
  socket.on('studio:leave-project', (payload: { projectId: string }) => {
    const roomName = `studio:project:${payload.projectId}`;
    socket.leave(roomName);
    
    const userId = (socket as any).userId;
    if (userId) {
      socket.to(roomName).emit('studio:user-presence', {
        userId,
        action: 'left'
      });
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const userId = (socket as any).userId;
    const projectId = (socket as any).projectId;
    
    if (userId && projectId) {
      socket.to(`studio:project:${projectId}`).emit('studio:user-presence', {
        userId,
        action: 'left'
      });
    }
  });

  // Collaborative editing: broadcast content changes to room
  socket.on('studio:file-content-change', (payload: { projectId: string, fileId: string, content: string }) => {
    const roomName = `studio:project:${payload.projectId}`;
    // Exclude sender
    socket.to(roomName).emit('studio:file-content-change', {
      fileId: payload.fileId,
      content: payload.content,
      userId: (socket as any).userId
    });
  });

  // Collaborative editing: broadcast cursor changes to room
  socket.on('studio:cursor-update', (payload: { projectId: string, fileId: string, position: any }) => {
    const roomName = `studio:project:${payload.projectId}`;
    socket.to(roomName).emit('studio:cursor-update', {
      fileId: payload.fileId,
      position: payload.position,
      userId: (socket as any).userId
    });
  });

  // Broadcast design element selected
  socket.on('studio:design-element-selected', (payload: { projectId: string, elementId: string }) => {
    const roomName = `studio:project:${payload.projectId}`;
    socket.to(roomName).emit('studio:design-element-selected', {
      elementId: payload.elementId,
      userId: (socket as any).userId
    });
  });
};
