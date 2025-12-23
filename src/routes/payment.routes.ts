import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import express from 'express';

const router = Router();
const paymentController = new PaymentController();

// Webhook route (must be before express.json() middleware)
// This route needs raw body for Stripe signature verification
router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    paymentController.handleWebhook.bind(paymentController)
);

// Protected routes
router.post('/create-checkout', authenticate, paymentController.createCheckout.bind(paymentController));
router.get('/', authenticate, paymentController.getAllPayments.bind(paymentController));
router.get('/:id', authenticate, paymentController.getPaymentById.bind(paymentController));
router.post('/:id/refund', authenticate, paymentController.requestRefund.bind(paymentController));
router.get('/verify-session/:id', authenticate, paymentController.verifySession.bind(paymentController));

export default router;
