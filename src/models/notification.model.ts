import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
    userId: mongoose.Types.ObjectId;
    type: 'email' | 'push' | 'sms';
    category: 'business' | 'document' | 'payment' | 'system' | 'custom';
    title: string;
    message: string;
    data?: Record<string, any>;
    status: 'pending' | 'sent' | 'failed' | 'read';
    sentAt?: Date;
    readAt?: Date;
    failureReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['email', 'push', 'sms'],
            required: true,
        },
        category: {
            type: String,
            enum: ['business', 'document', 'payment', 'system', 'custom'],
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        data: {
            type: Schema.Types.Mixed,
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed', 'read'],
            default: 'pending',
            index: true,
        },
        sentAt: {
            type: Date,
        },
        readAt: {
            type: Date,
        },
        failureReason: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, category: 1 });
notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
