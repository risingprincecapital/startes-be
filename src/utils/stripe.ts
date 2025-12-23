import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
    typescript: true,
});

export interface CreateCheckoutSessionParams {
    userId: string;
    businessId: string;
    productIds: string[];
    products: Array<{
        productId: string;
        name: string;
        description: string;
        price: number;
    }>;
    successUrl: string;
    cancelUrl: string;
}

export async function createCheckoutSession(
    params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
    const { userId, businessId, productIds, products, successUrl, cancelUrl } = params;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = products.map((product) => ({
        price_data: {
            currency: 'usd',
            product_data: {
                name: product.name,
                description: product.description,
            },
            unit_amount: Math.round(product.price * 100), // Convert to cents
        },
        quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: businessId,
        metadata: {
            userId,
            businessId,
            productIds: JSON.stringify(productIds),
        },
    });

    return session;
}

export async function retrievePaymentIntent(
    paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function retrieveCheckoutSession(
    sessionId: string
): Promise<Stripe.Checkout.Session> {
    return await stripe.checkout.sessions.retrieve(sessionId);
}

export async function createRefund(
    paymentIntentId: string,
    amount?: number
): Promise<Stripe.Refund> {
    const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
    };

    if (amount) {
        refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    return await stripe.refunds.create(refundParams);
}

export async function constructWebhookEvent(
    payload: string | Buffer,
    signature: string
): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
