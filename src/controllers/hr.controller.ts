import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../config/db.js';
import { getIO } from '../config/socket.js';

export const getEmployees = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const employees = await prisma.employee.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { firstName, lastName, email, department, designation, salary, status, joiningDate } = req.body;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.create({
      data: {
        companyId,
        firstName,
        lastName,
        email,
        department,
        designation,
        salary: Number(salary) || 0,
        status: status || 'ACTIVE',
        joiningDate: new Date(joiningDate || Date.now())
      }
    });

    getIO().emit('new-employee', employee);
    getIO().emit('metrics-updated');

    res.status(201).json(employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

export const getHrAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [totalEmployees, onLeave, payrollSum] = await Promise.all([
      prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.employee.count({ where: { companyId, status: 'ON_LEAVE' } }),
      prisma.employee.aggregate({
        where: { companyId, status: 'ACTIVE' },
        _sum: { salary: true }
      })
    ]);

    res.json({
      totalEmployees,
      onLeave,
      monthlyPayroll: payrollSum._sum.salary || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch HR analytics' });
  }
};

export const seedHrData = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const count = await prisma.employee.count({ where: { companyId } });
    if (count > 0) {
      res.json({ message: 'HR data already seeded' });
      return;
    }

    const mockEmployees = [
      { firstName: 'Sarah', lastName: 'Connor', email: 'sarah@acme.com', department: 'Engineering', designation: 'Senior Developer', salary: 120000, status: 'ACTIVE' },
      { firstName: 'Michael', lastName: 'Scott', email: 'michael@acme.com', department: 'Management', designation: 'Regional Manager', salary: 85000, status: 'ACTIVE' },
      { firstName: 'Jim', lastName: 'Halpert', email: 'jim@acme.com', department: 'Sales', designation: 'Sales Rep', salary: 65000, status: 'ON_LEAVE' },
      { firstName: 'Pam', lastName: 'Beesly', email: 'pam@acme.com', department: 'Admin', designation: 'Receptionist', salary: 45000, status: 'ACTIVE' },
      { firstName: 'Dwight', lastName: 'Schrute', email: 'dwight@acme.com', department: 'Sales', designation: 'Asst. to Regional Manager', salary: 70000, status: 'ACTIVE' },
    ];

    for (const emp of mockEmployees) {
      await prisma.employee.create({
        data: {
          companyId,
          ...emp,
          joiningDate: new Date()
        }
      });
    }

    getIO().emit('metrics-updated');

    res.json({ message: 'Successfully seeded HR data' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to seed HR data' });
  }
};
