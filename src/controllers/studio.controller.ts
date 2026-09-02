import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { StudioAuthRequest } from '../middleware/studio-auth.middleware.js';

const prisma = new PrismaClient();

// Get all projects for the user
export const getProjects = async (req: Request, res: Response) => {
  try {
    // We get AuthRequest so req.user exists
    const userReq = req as any; 
    const userId = userReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projects = await prisma.websiteProject.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } }
        ],
        deletedAt: null
      },
      include: {
        owner: {
          select: { firstName: true, lastName: true, avatar: true }
        },
        _count: {
          select: { collaborators: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new project
export const createProject = async (req: Request, res: Response) => {
  try {
    const userReq = req as any;
    const userId = userReq.user?.id;
    const companyId = userReq.user?.companyId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, projectType, visibility, template } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await prisma.websiteProject.create({
      data: {
        name,
        description,
        projectType: projectType || 'HTML',
        visibility: visibility || 'Private',
        template: template || 'Blank',
        ownerId: userId,
        companyId,
        files: {
          create: [
            {
              name: 'index.html',
              path: '/index.html',
              type: 'file',
              language: 'html',
              content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Website Studio</title>\n  <link rel="stylesheet" href="/style.css">\n</head>\n<body>\n  <h1>Welcome to Website Studio</h1>\n  <script src="/script.js"></script>\n</body>\n</html>',
              createdBy: userId,
              updatedBy: userId
            },
            {
              name: 'style.css',
              path: '/style.css',
              type: 'file',
              language: 'css',
              content: 'body {\n  font-family: sans-serif;\n  margin: 0;\n  padding: 20px;\n}',
              createdBy: userId,
              updatedBy: userId
            },
            {
              name: 'script.js',
              path: '/script.js',
              type: 'file',
              language: 'javascript',
              content: 'console.log("Hello from Website Studio!");',
              createdBy: userId,
              updatedBy: userId
            }
          ]
        }
      },
      include: {
        files: true
      }
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a single project by ID (requires Viewer role)
export const getProjectDetails = async (req: Request, res: Response) => {
  const authReq = req as StudioAuthRequest;
  const project = authReq.project;
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const fullProject = await prisma.websiteProject.findUnique({
      where: { id: project.id },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        files: true,
        collaborators: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatar: true } }
          }
        }
      }
    });

    // Also include the role of the requester so the frontend knows what they can do
    res.json({ ...fullProject, role: authReq.studioRole });
  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update file content (requires Editor role)
export const updateFile = async (req: Request, res: Response) => {
  const authReq = req as StudioAuthRequest;
  const project = authReq.project;
  const fileId = req.params.fileId;
  const { content, version } = req.body;
  const userId = authReq.user?.id!;

  if (!project || !fileId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const file = await prisma.websiteFile.findUnique({ where: { id: fileId as string } });
    
    if (!file || file.projectId !== project.id) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Version conflict check
    if (version !== undefined && version < file.version) {
      return res.status(409).json({ error: 'Conflict: The file has been updated by someone else.', serverVersion: file.version });
    }

    const updatedFile = await prisma.websiteFile.update({
      where: { id: fileId as string },
      data: {
        content,
        version: { increment: 1 },
        updatedBy: userId
      }
    });

    // Also update project updated timestamp
    await prisma.websiteProject.update({
      where: { id: project.id },
      data: { updatedAt: new Date() }
    });

    res.json(updatedFile);
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const publishProject = async (req: Request, res: Response) => {
  const authReq = req as StudioAuthRequest;
  const project = authReq.project;

  if (!project) return res.status(400).json({ error: 'Missing parameters' });

  try {
    // Generate a unique slug if it doesn't exist
    const slug = project.publishedSlug || `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 8)}`;
    
    const updatedProject = await prisma.websiteProject.update({
      where: { id: project.id },
      data: {
        publishStatus: 'PUBLISHED',
        publishedSlug: slug,
        publishedAt: new Date(),
        publishedVersion: { increment: 1 }
      }
    });

    res.json(updatedProject);
  } catch (error) {
    console.error('Error publishing project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProjectSettings = async (req: Request, res: Response) => {
  const authReq = req as StudioAuthRequest;
  const project = authReq.project;

  if (!project) return res.status(400).json({ error: 'Missing parameters' });

  try {
    const { name, description, visibility } = req.body;
    
    if (name && name.trim() === '') {
      return res.status(400).json({ error: 'Project name cannot be empty' });
    }

    const updatedProject = await prisma.websiteProject.update({
      where: { id: project.id },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        visibility: visibility !== undefined ? visibility : undefined,
        updatedAt: new Date()
      }
    });

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
