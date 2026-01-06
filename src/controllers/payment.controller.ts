import { Request, Response, NextFunction } from 'express';
import { Payment } from '../models/payment.model';
import { BusinessProduct } from '../models/businessProduct.model';
import { Product } from '../models/product.model';
import { Business } from '../models/business.model';
import { User } from '../models/user.model';
import { createCheckoutSession, constructWebhookEvent, createRefund, retrieveCheckoutSession } from '../utils/stripe';
import { emailService } from '../services/email.service';

export class PaymentController {
    /**
     * Create Stripe Checkout Session
     * POST /api/payments/create-checkout
     */
    async createCheckout(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;
            const { businessId, productIds } = req.body;

            if (!businessId || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Business ID and product IDs are required',
                });
            }

            // Verify business belongs to user
            const business = await Business.findOne({ _id: businessId, userId });
            if (!business) {
                return res.status(404).json({
                    success: false,
                    error: 'Business not found',
                });
            }

            // Fetch products
            const products = await Product.find({ _id: { $in: productIds }, isActive: true });
            if (products.length !== productIds.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Some products not found or inactive',
                });
            }

            // Prepare product data for Stripe
            const stripeProducts = products.map((product) => ({
                productId: product._id.toString(),
                name: product.productName,
                description: product.description,
                price: product.price,
            }));

            // Create Stripe checkout session
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const session = await createCheckoutSession({
                userId,
                businessId,
                productIds,
                products: stripeProducts,
                successUrl: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${frontendUrl}/payment/cancel`,
            });

            // Create payment record
            // Note: stripePaymentIntentId is not available at checkout session creation
            // It will be added later in the webhook when payment_intent is created
            await Payment.create({
                userId,
                businessId,
                stripeCheckoutSessionId: session.id,
                amount: session.amount_total! / 100, // Convert from cents
                currency: session.currency!,
                status: 'pending',
                description: `Payment for ${products.length} product(s)`,
                metadata: {
                    productIds: productIds,
                },
            });

            res.status(200).json({
                success: true,
                message: 'Checkout session created',
                sessionId: session.id,
                url: session.url,
            });
        } catch (error: any) {
            console.error('Create checkout error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create checkout session',
            });
        }
    }

    /**
     * Stripe Webhook Handler
     * POST /api/payments/webhook
     */
    async handleWebhook(req: Request, res: Response, next: NextFunction) {
        try {
            const signature = req.headers['stripe-signature'] as string;

            if (!signature) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing stripe-signature header',
                });
            }

            // Construct and verify webhook event
            const event = await constructWebhookEvent(req.body, signature);

            // Handle different event types
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutSessionCompleted(event.data.object as any);
                    break;

                case 'payment_intent.succeeded':
                    await this.handlePaymentIntentSucceeded(event.data.object as any);
                    break;

                case 'payment_intent.payment_failed':
                    await this.handlePaymentIntentFailed(event.data.object as any);
                    break;

                case 'charge.refunded':
                    await this.handleChargeRefunded(event.data.object as any);
                    break;

                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }

            res.status(200).json({ received: true });
        } catch (error: any) {
            console.error('Webhook error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Webhook handler failed',
            });
        }
    }

    private async handleCheckoutSessionCompleted(session: any) {
        try {
            const { client_reference_id, metadata, payment_intent } = session;

            // Update payment record
            const payment = await Payment.findOneAndUpdate(
                { stripeCheckoutSessionId: session.id },
                {
                    status: 'succeeded',
                    paymentMethod: session.payment_method_types?.[0],
                    stripePaymentIntentId: payment_intent,
                },
                { new: true }
            ).populate('businessId userId');

            if (!payment) {
                console.error('Payment record not found for session:', session.id);
                return;
            }

            // Create and configure BusinessProduct instances
            if (metadata?.productIds) {
                const productIds = JSON.parse(metadata.productIds);
                const businessProductIds: string[] = [];

                // Get products to check if they have required documents
                const products = await Product.find({ _id: { $in: productIds } });

                // Create BusinessProduct for each product
                for (const product of products) {
                    const hasRequiredDocs = product.requiredDocs && product.requiredDocs.some((doc: any) => doc.isRequired);

                    let businessProductData: any = {
                        businessId: payment.businessId,
                        productId: product._id,
                        userId: payment.userId,
                        purchasePrice: product.price,
                        startDate: new Date(),
                    };

                    if (hasRequiredDocs) {
                        // Has required documents - set to 50% progress
                        businessProductData.status = 'active';
                        businessProductData.progress = 50;
                        businessProductData.completedSteps = ['start', 'payment'];
                    } else {
                        // No required documents - set to 75% and documentation complete
                        businessProductData.status = 'active';
                        businessProductData.progress = 75;
                        businessProductData.completedSteps = ['start', 'payment', 'documentation'];
                    }

                    const businessProduct = await BusinessProduct.create(businessProductData);
                    businessProductIds.push(businessProduct._id.toString());
                }

                // Update payment metadata with created businessProductIds
                await Payment.updateOne(
                    { _id: payment._id },
                    { 'metadata.businessProductIds': businessProductIds }
                );

                // Send payment success email
                const user = payment.userId as any;
                const businessProducts = await BusinessProduct.find({ _id: { $in: businessProductIds } }).populate('productId');
                const business = await Business.findById(payment.businessId);

                if (business) {
                    // Activate the business on first successful payment
                    if (!business.isActive) {
                        business.isActive = true;
                    }

                    // Remove purchased products from recommendations
                    const purchasedProductIds = products.map(p => p._id);
                    business.recommendedProduct = business.recommendedProduct.filter(
                        rp => !purchasedProductIds.some(pid => pid.toString() === rp.productId.toString())
                    );

                    await business.save();
                }

                emailService.sendPaymentSuccessEmail(
                    user.email,
                    {
                        userName: user.name || user.email,
                        businessName: business?.businessName,
                        amount: payment.amount,
                        paymentMethod: payment.paymentMethod || 'Card',
                        transactionId: payment.stripePaymentIntentId,
                        paymentDate: new Date(),
                        services: businessProducts.map((bp: any) => ({
                            name: bp.productId.productName,
                            price: bp.purchasePrice,
                        })),
                        actionUrl: `${process.env.FRONTEND_URL}`,
                    },
                    user._id.toString()
                );
            }

            console.log(`Checkout session completed: ${session.id}`);
        } catch (error) {
            console.error('Error handling checkout session completed:', error);
        }
    }

    /**
     * Handle payment intent succeeded
     */
    private async handlePaymentIntentSucceeded(paymentIntent: any) {
        try {
            await Payment.findOneAndUpdate(
                { stripePaymentIntentId: paymentIntent.id },
                {
                    status: 'succeeded',
                    paymentMethod: paymentIntent.payment_method,
                }
            );

            console.log(`Payment intent succeeded: ${paymentIntent.id}`);
        } catch (error) {
            console.error('Error handling payment intent succeeded:', error);
        }
    }

    /**
     * Handle payment intent failed
     */
    private async handlePaymentIntentFailed(paymentIntent: any) {
        try {
            const payment = await Payment.findOneAndUpdate(
                { stripePaymentIntentId: paymentIntent.id },
                { status: 'failed' },
                { new: true }
            ).populate('businessId userId');

            // Update BusinessProduct instances to cancelled
            if (payment?.metadata?.businessProductIds) {
                await BusinessProduct.updateMany(
                    { _id: { $in: payment.metadata.businessProductIds } },
                    { status: 'cancelled' }
                );

                // Send payment failed email
                const user = payment.userId as any;
                const business = payment.businessId as any;

                emailService.sendPaymentFailedEmail(
                    user.email,
                    {
                        userName: user.name || user.email,
                        businessName: business.businessName,
                        amount: payment.amount,
                        attemptDate: new Date(),
                        failureReason: paymentIntent.last_payment_error?.message || 'Payment was declined',
                        actionUrl: `${process.env.FRONTEND_URL}`,
                    },
                    user._id.toString()
                );
            }

            console.log(`Payment intent failed: ${paymentIntent.id}`);
        } catch (error) {
            console.error('Error handling payment intent failed:', error);
        }
    }

    /**
     * Handle charge refunded
     */
    private async handleChargeRefunded(charge: any) {
        try {
            const refundAmount = charge.amount_refunded / 100; // Convert from cents

            await Payment.findOneAndUpdate(
                { stripePaymentIntentId: charge.payment_intent },
                {
                    status: 'refunded',
                    refundedAmount: refundAmount,
                    refundedAt: new Date(),
                }
            );

            console.log(`Charge refunded: ${charge.id}, amount: $${refundAmount}`);
        } catch (error) {
            console.error('Error handling charge refunded:', error);
        }
    }

    /**
     * Get all payments for user
     * GET /api/payments
     */
    async getAllPayments(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;
            const { page = 1, limit = 50, status } = req.query;

            const query: any = { userId };
            if (status) {
                query.status = status;
            }

            const skip = (Number(page) - 1) * Number(limit);

            const payments = await Payment.find(query)
                .populate('businessId', 'businessName')
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 });

            const total = await Payment.countDocuments(query);

            res.status(200).json({
                success: true,
                payments,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit)),
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch payments',
            });
        }
    }

    /**
     * Get payment by ID
     * GET /api/payments/:id
     */
    async getPaymentById(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;
            const { id } = req.params;

            const payment = await Payment.findOne({ _id: id, userId })
                .populate('businessId', 'businessName entityType')
                .populate('businessProductId', 'productId status progress');

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found',
                });
            }

            res.status(200).json({
                success: true,
                payment,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch payment',
            });
        }
    }

    /**
     * Request refund
     * POST /api/payments/:id/refund
     */
    async requestRefund(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;
            const { id } = req.params;
            const { amount } = req.body; // Optional partial refund amount

            const payment = await Payment.findOne({ _id: id, userId });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found',
                });
            }

            if (payment.status !== 'succeeded') {
                return res.status(400).json({
                    success: false,
                    error: 'Only succeeded payments can be refunded',
                });
            }

            // Create refund in Stripe
            const refund = await createRefund(payment.stripePaymentIntentId, amount);

            // Update payment record
            payment.status = 'refunded';
            payment.refundedAmount = refund.amount / 100; // Convert from cents
            payment.refundedAt = new Date();
            await payment.save();

            // Update BusinessProduct instances to cancelled
            if (payment.metadata?.businessProductIds) {
                await BusinessProduct.updateMany(
                    { _id: { $in: payment.metadata.businessProductIds } },
                    { status: 'cancelled' }
                );
            }

            res.status(200).json({
                success: true,
                message: 'Refund processed successfully',
                refund: {
                    id: refund.id,
                    amount: refund.amount / 100,
                    status: refund.status,
                },
            });
        } catch (error: any) {
            console.error('Refund error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process refund',
            });
        }
    }

    /**
     * Verify checkout session
     * POST /api/payments/verify-session
     */
    async verifySession(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;
            const { id } = req.params;
            const { sessionId } = id ? { sessionId: id } : req.body;


            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID is required',
                });
            }

            // Retrieve session from Stripe
            const session = await retrieveCheckoutSession(sessionId);
            let payment;
            // Check if payment is successful
            if (session.payment_status === 'paid') {
                // Ensure local payment record is updated
                // This handles the race condition where webhook might be delayed
                payment = await Payment.findOne({ stripeCheckoutSessionId: sessionId });

                if (payment && payment.status !== 'succeeded') {
                    await this.handleCheckoutSessionCompleted(session);
                }
            }

            res.status(200).json({
                success: true,
                status: session.payment_status,
                customer_email: session.customer_details?.email,
                businessId: payment?.businessId,
                productIds: session.metadata?.productIds ? JSON.parse(session.metadata.productIds) : [],
            });
        } catch (error: any) {
            console.error('Verify session error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to verify session',
            });
        }
    }
}
