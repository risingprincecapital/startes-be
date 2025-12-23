import { Notification } from '../models/notification.model';
import mongoose from 'mongoose';

interface CreateNotificationParams {
    userId: mongoose.Types.ObjectId | string;
    category: 'business' | 'document' | 'payment' | 'system' | 'custom';
    title: string;
    message: string;
    data?: Record<string, any>;
}

export class NotificationService {
    /**
     * Create a push notification for a user
     */
    static async createNotification(params: CreateNotificationParams) {
        try {
            const notification = await Notification.create({
                userId: params.userId,
                type: 'push',
                category: params.category,
                title: params.title,
                message: params.message,
                data: params.data || {},
                status: 'sent',
                sentAt: new Date(),
            });

            return notification;
        } catch (error) {
            console.error('Failed to create notification:', error);
            throw error;
        }
    }

    /**
     * Notify user when admin verifies their document
     */
    static async notifyDocumentVerified(
        userId: mongoose.Types.ObjectId | string,
        businessName: string,
        documentName: string,
        businessId: mongoose.Types.ObjectId | string
    ) {
        return this.createNotification({
            userId,
            category: 'document',
            title: 'Document Verified',
            message: `Your document "${documentName}" for ${businessName} has been verified by admin.`,
            data: { action: 'document_verified', businessName, documentName, businessId: businessId.toString() },
        });
    }

    /**
     * Notify user when admin rejects their document
     */
    static async notifyDocumentRejected(
        userId: mongoose.Types.ObjectId | string,
        businessName: string,
        documentName: string,
        reason: string,
        businessId: mongoose.Types.ObjectId | string
    ) {
        return this.createNotification({
            userId,
            category: 'document',
            title: 'Document Rejected',
            message: `Your document "${documentName}" for ${businessName} was rejected. Reason: ${reason}`,
            data: { action: 'document_rejected', businessName, documentName, reason, businessId: businessId.toString() },
        });
    }

    /**
     * Notify user when admin uploads acknowledgement
     */
    static async notifyAcknowledgementUploaded(
        userId: mongoose.Types.ObjectId | string,
        businessName: string,
        productName: string,
        businessId: mongoose.Types.ObjectId | string
    ) {
        return this.createNotification({
            userId,
            category: 'business',
            title: 'Acknowledgement Uploaded',
            message: `Acknowledgement for ${productName} in ${businessName} has been uploaded. Your product is now 100% complete!`,
            data: { action: 'acknowledgement_uploaded', businessName, productName, businessId: businessId.toString() },
        });
    }

    /**
     * Notify user when admin updates their business
     */
    static async notifyBusinessUpdated(
        userId: mongoose.Types.ObjectId | string,
        businessName: string,
        updatedFields: string[],
        businessId: mongoose.Types.ObjectId | string
    ) {
        return this.createNotification({
            userId,
            category: 'business',
            title: 'Business Updated',
            message: `Your business "${businessName}" has been updated by admin. Updated: ${updatedFields.join(', ')}`,
            data: { action: 'business_updated', businessName, updatedFields, businessId: businessId.toString() },
        });
    }

    /**
     * Notify user when admin adds recommended product
     */
    static async notifyRecommendedProductAdded(
        userId: mongoose.Types.ObjectId | string,
        businessName: string,
        productName: string,
        businessId: mongoose.Types.ObjectId | string
    ) {
        return this.createNotification({
            userId,
            category: 'business',
            title: 'New Product Recommendation',
            message: `${productName} has been recommended for your business "${businessName}".`,
            data: { action: 'recommended_product_added', businessName, productName, businessId: businessId.toString() },
        });
    }

    /**
   * Notify admin when user creates/updates business
   */
    static async notifyAdminBusinessAction(
        adminUserIds: (mongoose.Types.ObjectId | string)[],
        action: 'created' | 'updated',
        businessName: string,
        userEmail: string,
        businessId: mongoose.Types.ObjectId | string
    ) {
        const promises = adminUserIds.map(adminId =>
            this.createNotification({
                userId: adminId,
                category: 'business',
                title: `Business ${action === 'created' ? 'Created' : 'Updated'}`,
                message: `User ${userEmail} has ${action} business "${businessName}".`,
                data: { action: `business_${action}`, businessName, userEmail, businessId: businessId.toString() },
            })
        );

        return Promise.all(promises);
    }
    /**
     * Notify admin when user uploads a document
     */
    static async notifyAdminDocumentUploaded(
        adminUserIds: (mongoose.Types.ObjectId | string)[],
        businessName: string,
        documentName: string,
        userEmail: string,
        businessId: mongoose.Types.ObjectId | string
    ) {
        const promises = adminUserIds.map(adminId =>
            this.createNotification({
                userId: adminId,
                category: 'document',
                title: 'New Document Uploaded',
                message: `User ${userEmail} has uploaded document "${documentName}" for business "${businessName}".`,
                data: { action: 'document_uploaded', businessName, documentName, userEmail, businessId: businessId.toString() },
            })
        );

        return Promise.all(promises);
    }
}
