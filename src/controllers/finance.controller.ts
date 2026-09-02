import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../config/db.js';
import { createRazorpayOrder, verifyRazorpayPayment } from '../services/razorpay.service.js';
import { getIO } from '../config/socket.js';

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const invoices = await prisma.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        client: true,
        deal: true
      }
    });

    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { clientId, dealId, amount, dueDate, tax } = req.body;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let clientName = 'Unknown Client';
    if (clientId) {
      const client = await prisma.user.findUnique({ where: { id: clientId } });
      if (client) clientName = `${client.firstName} ${client.lastName}`;
    }

    const total = Number(amount) + Number(tax || 0);

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        clientId: clientId || null,
        dealId: dealId || null,
        invoiceNo: `INV-${Date.now()}`,
        clientName,
        amount: Number(amount),
        tax: Number(tax || 0),
        total,
        dueDate: new Date(dueDate),
        status: 'UNPAID'
      }
    });

    getIO().emit('new-invoice', invoice);
    getIO().emit('metrics-updated');

    res.status(201).json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const createPaymentOrder = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const order = await createRazorpayOrder(invoice.total, invoice.id);
    
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { razorpayOrderId: order.id }
    });

    res.json({ order, invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId } = req.body;

    const isValid = verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    
    if (!isValid) {
      res.status(400).json({ error: 'Invalid payment signature' });
      return;
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { 
        status: 'PAID',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      }
    });

    getIO().emit('update-invoice', invoice);
    getIO().emit('metrics-updated');

    res.json({ message: 'Payment successful', invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};
