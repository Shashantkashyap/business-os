import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { Schema } from '@google/generative-ai';
import prisma from '../config/db.js';
import { getIO } from '../config/socket.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

// Helper to format messages from generic role (user/assistant) to Gemini role (user/model)
const formatMessages = (messages: any[]) => {
  return messages.map((m: any) => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content || '' }]
  }));
};

export const handleChat = async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = req.body;
    const userId = req?.user?.id;
    const companyId = req?.user?.companyId;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
      // Simulate an AI response if key is missing
      setTimeout(() => {
        res.json({
          message: "I am the BusinessOS AI Assistant. Your Gemini API key is missing from the .env file, so I'm running in offline simulated mode. How can I help you manage your business today?",
        });
      }, 1000);
      return;
    }

    // Fetch User Context
    let projectContextStr = "No active projects found for this user.";
    if (userId && companyId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true }
      });
      
      const isAdminOrManager = user?.role?.name === 'ADMIN' || user?.role?.name === 'MANAGER';
      
      const projects = await prisma.project.findMany({
        where: isAdminOrManager ? { companyId } : { clientId: userId },
        select: { 
          title: true, 
          status: true, 
          value: true, 
          description: true, 
          client: { select: { firstName: true, lastName: true } }
        }
      });
      
      if (projects.length > 0) {
        projectContextStr = projects.map(p => 
          `- Project: ${p.title}\n  Status: ${p.status}\n  Value: ₹${p.value}\n  Client: ${p.client.firstName} ${p.client.lastName}\n  Description: ${p.description || 'N/A'}`
        ).join('\n\n');
      }
    }

    const systemInstruction = `You are the BusinessOS AI Assistant. You help users manage their HR, CRM, Marketing, Finance, and AI Automation through the platform. Be concise, professional, and helpful.
    
Here is the real-time context of the user's projects from the database:
${projectContextStr}

Use this context to accurately answer any questions the user has about their projects. If they ask about something not in this context, answer to the best of your ability or ask for more clarification.`;

    // Determine the AI model to use
    // Using gemini-1.5-flash as the fast, default model
    const modelName = process.env.AI_MODEL && process.env.AI_MODEL.includes('gemini') 
      ? process.env.AI_MODEL 
      : 'gemini-1.5-flash-latest';

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction,
    });

    let formattedHistory = formatMessages(messages.slice(0, -1));
    if (formattedHistory.length > 0 && formattedHistory[0]?.role === 'model') {
      formattedHistory = formattedHistory.slice(1);
    }
    const latestMessage = messages[messages.length - 1]?.content || '';

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(latestMessage);
    const response = await result.response;

    res.json({
      message: response.text(),
    });
  } catch (error: any) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: error?.message || 'Failed to communicate with AI Assistant' });
  }
};

export const draftAssistant = async (req: AuthRequest, res: Response) => {
  try {
    const { messages, projectContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
      setTimeout(() => {
        res.json({
          message: "Let's update the budget to ₹5,000 as you suggested.",
          updates: { budget: 5000, notes: 'Updated notes from mock AI.' }
        });
      }, 1000);
      return;
    }

    const systemPrompt = `You are an AI Project Copilot. Your job is to help a client refine a service request/project draft.
Current Draft Details:
Budget: ₹${projectContext?.budget || 0}
Timeline: ${projectContext?.timeline || 'Unknown'}
Notes/Description: ${projectContext?.notes || 'None'}
Service Type: ${projectContext?.serviceType || 'Unknown'}

Discuss the project with the user. Ask clarifying questions if necessary (like budget, timeline).
You MUST respond with a JSON object exactly matching this schema:
{
  "message": "Your text response to the user",
  "updates": {
    "budget": <number or null>,
    "timeline": "<string or null>",
    "notes": "<string or null>"
  }
}
Only output the JSON object, nothing else.`;

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        message: { type: SchemaType.STRING },
        updates: {
          type: SchemaType.OBJECT,
          properties: {
            budget: { type: SchemaType.NUMBER, nullable: true },
            timeline: { type: SchemaType.STRING, nullable: true },
            notes: { type: SchemaType.STRING, nullable: true }
          }
        }
      },
      required: ["message", "updates"]
    };

    const modelName = process.env.AI_MODEL && process.env.AI_MODEL.includes('gemini') 
      ? process.env.AI_MODEL 
      : 'gemini-1.5-flash-latest';

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    let formattedHistory = formatMessages(messages.slice(0, -1));
    if (formattedHistory.length > 0 && formattedHistory[0]?.role === 'model') {
      formattedHistory = formattedHistory.slice(1);
    }
    const latestMessage = messages[messages.length - 1]?.content || '';

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(latestMessage);
    const response = await result.response;
    
    let aiResponse = { message: 'I have updated the project.', updates: {} };
    try {
      aiResponse = JSON.parse(response.text());
    } catch (e) {
      console.error('Failed to parse Gemini JSON output', e);
    }

    res.json({
      message: aiResponse.message || 'I have updated the project.',
      updates: aiResponse.updates || {}
    });
  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: 'Failed to communicate with AI Assistant' });
  }
};

export const getAutomations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    const isAdmin = user?.role?.name === 'ADMIN';

    const automations = await prisma.automation.findMany({
      where: isAdmin ? { companyId } : { clientId: userId },
      include: {
        client: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(automations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch automations' });
  }
};

export const createAutomation = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { clientId, name, type, usage, latency } = req.body;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const automation = await prisma.automation.create({
      data: {
        companyId,
        clientId: clientId || null,
        name,
        type: type || 'Agent',
        usage: usage || 'Medium',
        latency: latency || '-',
        status: 'ONLINE'
      },
      include: {
        client: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }
      }
    });

    try {
      getIO().emit('new-activity', {
        action: 'AGENT_DEPLOYED',
        entityType: 'AUTOMATION',
        details: `Deployed new AI Agent: ${name}`
      });
      getIO().emit('metrics-updated');
    } catch (e) {
      console.error('Socket error:', e);
    }

    res.status(201).json(automation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create automation' });
  }
};

export const updateAutomationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const automation = await prisma.automation.update({
      where: { id },
      data: { status },
      include: {
        client: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }
      }
    });

    try {
      getIO().emit('metrics-updated');
    } catch (e) {
      console.error('Socket error:', e);
    }

    res.json(automation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update automation status' });
  }
};
