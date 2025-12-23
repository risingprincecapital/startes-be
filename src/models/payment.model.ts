import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
    userId: mongoose.Types.ObjectId;
    businessId: mongoose.Types.ObjectId;
    businessProductId?: mongoose.Types.ObjectId;
    stripePaymentIntentId: string;
    stripeCheckoutSessionId?: string;
    amount: number;
    currency: string;
    status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
    paymentMethod?: string;
    description?: string;
    metadata?: Record<string, any>;
    refundedAmount?: number;
    refundedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        businessId: {
            type: Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
            index: true,
        },
        businessProductId: {
            type: Schema.Types.ObjectId,
            ref: 'BusinessProduct',
            index: true,
        },
        stripePaymentIntentId: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
        },
        stripeCheckoutSessionId: {
            type: String,
            unique: true,
            sparse: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            required: true,
            default: 'usd',
            uppercase: true,
        },
        status: {
            type: String,
            enum: ['pending', 'succeeded', 'failed', 'canceled', 'refunded'],
            default: 'pending',
            required: true,
            index: true,
        },
        paymentMethod: {
            type: String,
        },
        description: {
            type: String,
        },
        metadata: {
            type: Schema.Types.Mixed,
        },
        refundedAmount: {
            type: Number,
            min: 0,
        },
        refundedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ businessId: 1, status: 1 });
paymentSchema.index({ stripePaymentIntentId: 1, status: 1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
