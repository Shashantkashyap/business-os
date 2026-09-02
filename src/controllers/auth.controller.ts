import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { getIO } from '../config/socket.js';
import type { Prisma } from '@prisma/client';

export const register = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, companyName } = req.body;

    if (!firstName || !lastName || !email || !password || !companyName) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let role = await tx.role.findUnique({ where: { name: 'CLIENT' } });
      if (!role) {
        role = await tx.role.create({
          data: { name: 'CLIENT', permissions: 'BASIC' }
        });
      }

      const company = await tx.company.create({
        data: { name: companyName }
      });

      const user = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          companyId: company.id,
          roleId: role.id
        }
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: 'REGISTERED',
          entityType: 'AUTH',
          details: `User ${firstName} ${lastName} registered a new account.`
        }
      });

      return user;
    }, { timeout: 15000 });

    const token = jwt.sign(
      { id: result.id, email: result.email, companyId: result.companyId },
      process.env.JWT_ACCESS_SECRET || 'secret',
      { expiresIn: (process.env.JWT_ACCESS_EXPIRES || '15m') as any }
    );

    try {
      const activity = await prisma.activityLog.findFirst({
        where: { userId: result.id, action: 'REGISTERED' },
        orderBy: { createdAt: 'desc' }
      });
      if (activity) {
        getIO().emit('new-activity', {
          ...activity,
          user: { firstName, lastName }
        });
      }

      const safeUser = {
        id: result.id,
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        isActive: result.isActive,
        createdAt: result.createdAt,
        company: { name: companyName },
        role: { name: 'CLIENT' }
      };
      getIO().emit('new-user', safeUser);
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        companyId: result.companyId,
        company: { name: companyName },
        role: { name: 'CLIENT' }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true, role: true }
    });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const activity = await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGGED_IN',
        entityType: 'AUTH',
        details: `User ${user.firstName} ${user.lastName} logged in.`
      }
    });

    try {
      getIO().emit('new-activity', {
        ...activity,
        user: { firstName: user.firstName, lastName: user.lastName }
      });
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, companyId: user.companyId },
      process.env.JWT_ACCESS_SECRET || 'secret',
      { expiresIn: (process.env.JWT_ACCESS_EXPIRES || '15m') as any }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        company: { name: user.company.name },
        role: { name: user.role?.name || 'CLIENT' }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
};
