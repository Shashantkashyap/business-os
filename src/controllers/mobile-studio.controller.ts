import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getProjects = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.id || user.userId;

    const ownedProjects = await prisma.mobileProject.findMany({
      where: { ownerId: userId, deletedAt: null },
      include: {
        _count: {
          select: { screens: true, files: true, collaborators: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const collabProjects = await prisma.mobileProject.findMany({
      where: {
        collaborators: {
          some: { userId: userId }
        },
        deletedAt: null
      },
      include: {
        _count: {
          select: { screens: true, files: true, collaborators: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Mark roles
    const formattedOwned = ownedProjects.map(p => ({ ...p, role: 'OWNER' }));
    const formattedCollab = collabProjects.map(p => ({ ...p, role: 'COLLABORATOR' })); // role will be refined in UI or by querying collaborator table

    res.json([...formattedOwned, ...formattedCollab]);
  } catch (error) {
    console.error('Error fetching mobile projects:', error);
    res.status(500).json({ error: 'Failed to fetch mobile projects' });
  }
};

export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, description, framework, targetPlatforms, template } = req.body;
    const user = (req as any).user;
    const userId = user.id || user.userId;
    const companyId = user.companyId || null;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await prisma.mobileProject.create({
      data: {
        ownerId: userId,
        companyId: companyId,
        name,
        description,
        framework: framework || 'VISUAL',
        targetPlatforms: targetPlatforms || 'Android',
        template: template || 'Blank',
        status: 'ACTIVE',
        files: {
          create: [
            {
              name: 'pubspec.yaml',
              path: 'pubspec.yaml',
              language: 'yaml',
              content: `name: ${name.toLowerCase().replace(/\\s+/g, '_')}\\ndescription: ${description || 'A new Flutter project.'}\\n\\nenvironment:\\n  sdk: '>=3.0.0 <4.0.0'\\n\\ndependencies:\\n  flutter:\\n    sdk: flutter\\n`,
              createdBy: userId,
              updatedBy: userId
            }
          ]
        },
        screens: {
          create: [
            {
              screenId: 'screen_home',
              name: 'Home',
              route: '/',
              isStartScreen: true,
              uiSchema: JSON.stringify({
                type: 'Scaffold',
                id: 'scaffold_root',
                props: {
                  backgroundColor: '#ffffff'
                },
                children: [
                  {
                    type: 'AppBar',
                    id: 'appbar_root',
                    props: {
                      title: name,
                      backgroundColor: '#3f51b5'
                    },
                    children: []
                  },
                  {
                    type: 'Center',
                    id: 'center_root',
                    props: {},
                    children: [
                      {
                        type: 'Text',
                        id: 'text_root',
                        props: {
                          text: 'Welcome to your new app!'
                        },
                        children: []
                      }
                    ]
                  }
                ]
              }),
              createdBy: userId,
              updatedBy: userId
            }
          ]
        }
      }
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating mobile project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const getProjectDetails = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.mobileProject.findUnique({
      where: { id: projectId as string },
      include: {
        files: true,
        screens: true,
        assets: true,
        collaborators: {
          include: {
             user: {
               select: { id: true, firstName: true, lastName: true, email: true, avatar: true }
             }
          }
        },
        owner: {
           select: { id: true, firstName: true, lastName: true, email: true, avatar: true }
        }
      }
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json({
      ...project,
      role: req.mobileProjectRole // Added by middleware
    });
  } catch (error) {
    console.error('Error fetching mobile project details:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
};

export const updateProjectSettings = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, description, packageId, themeConfig, targetPlatforms } = req.body;

    const project = await prisma.mobileProject.update({
      where: { id: projectId as string },
      data: {
        name,
        description,
        packageId,
        themeConfig,
        targetPlatforms
      }
    });

    res.json(project);
  } catch (error) {
    console.error('Error updating project settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

export const updateFile = async (req: Request, res: Response) => {
  try {
    const { projectId, fileId } = req.params;
    const { content } = req.body;
    const user = (req as any).user;
    const userId = user.id || user.userId;

    const file = await prisma.mobileFile.update({
      where: { id: fileId as string, projectId: projectId as string },
      data: {
        content,
        updatedBy: userId,
        version: { increment: 1 }
      }
    });

    res.json(file);
  } catch (error) {
    console.error('Error updating mobile file:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
};

export const updateScreen = async (req: Request, res: Response) => {
  try {
    const { projectId, screenId } = req.params;
    const { uiSchema } = req.body;
    const user = (req as any).user;
    const userId = user.id || user.userId;

    const screen = await prisma.mobileScreen.update({
      where: { id: screenId as string, projectId: projectId as string },
      data: {
        uiSchema,
        updatedBy: userId,
        version: { increment: 1 }
      }
    });

    res.json(screen);
  } catch (error) {
    console.error('Error updating mobile screen:', error);
    res.status(500).json({ error: 'Failed to update screen' });
  }
};

export const exportProject = async (_req: Request, res: Response) => {
   // This will hook into the FlutterGeneratorService later
   // For now, it returns a 501 Not Implemented or success status if we just want to stub it
   res.status(501).json({ error: 'Export infrastructure not yet configured' });
};
