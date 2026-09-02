import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

export const createRazorpayOrder = async (amount: number, receiptId: string) => {
  const options = {
    amount: amount * 100, // amount in the smallest currency unit (paise)
    currency: "INR",
    receipt: receiptId
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw new Error('Failed to create payment order');
  }
};

export const verifyRazorpayPayment = (
  razorpayOrderId: string, 
  razorpayPaymentId: string, 
  signature: string
) => {
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  return generatedSignature === signature;
};
