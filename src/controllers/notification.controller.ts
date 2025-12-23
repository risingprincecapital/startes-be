import { Request, Response, NextFunction } from 'express';
import { Notification } from '../models/notification.model';
import { User } from '../models/user.model';
import { emailService } from '../services/email.service';

export class NotificationController {
    /**
     * Get all notifications for user
     * GET /api/notifications
     */
    async getAllNotifications(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;
            const { page = 1, limit = 50, category, status } = req.query;

            const query: any = { userId };
            if (category) query.category = category;
            if (status) query.status = status;

            const skip = (Number(page) - 1) * Number(limit);

            const notifications = await Notification.find(query)
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 });

            const total = await Notification.countDocuments(query);
            const unreadCount = await Notification.countDocuments({ userId, status: { $ne: 'read' } });

            res.status(200).json({
                success: true,
                notifications,
                unreadCount,
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
                error: error.message || 'Failed to fetch notifications',
            });
        }
    }

    /**
     * Mark notification as read
     * PUT /api/notifications/:id/read
     */
    async markAsRead(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;
            const { id } = req.params;

            const notification = await Notification.findOneAndUpdate(
                { _id: id, userId },
                { status: 'read', readAt: new Date() },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found',
                });
            }

            res.status(200).json({
                success: true,
                notification,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to mark notification as read',
            });
        }
    }

    /**
     * Mark all notifications as read
     * PUT /api/notifications/read-all
     */
    async markAllAsRead(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;

            await Notification.updateMany(
                { userId, status: { $ne: 'read' } },
                { status: 'read', readAt: new Date() }
            );

            res.status(200).json({
                success: true,
                message: 'All notifications marked as read',
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to mark all notifications as read',
            });
        }
    }

    /**
     * Clear all notifications (delete)
     * DELETE /api/notifications/clear-all
     */
    async clearAll(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;

            const result = await Notification.deleteMany({ userId });

            res.status(200).json({
                success: true,
                message: `${result.deletedCount} notifications cleared`,
                deletedCount: result.deletedCount,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to clear notifications',
            });
        }
    }

    /**
     * Send custom email (Admin only)
     * POST /api/notifications/send-custom-email
     */
    async sendCustomEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const { recipientEmail, recipientUserId, subject, htmlContent, templateData } = req.body;

            if (!recipientEmail || !subject || !htmlContent) {
                return res.status(400).json({
                    success: false,
                    error: 'Recipient email, subject, and HTML content are required',
                });
            }

            // Queue custom email
            await emailService.queueCustomEmail({
                to: recipientEmail,
                subject,
                htmlContent,
                data: templateData || {},
                userId: recipientUserId,
            });

            res.status(200).json({
                success: true,
                message: 'Custom email queued successfully',
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to send custom email',
            });
        }
    }

    /**
     * Send bulk email (Admin only)
     * POST /api/notifications/send-bulk-email
     */
    async sendBulkEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const { userIds, subject, htmlContent, templateData } = req.body;

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'User IDs array is required',
                });
            }

            if (!subject || !htmlContent) {
                return res.status(400).json({
                    success: false,
                    error: 'Subject and HTML content are required',
                });
            }

            // Fetch users
            const users = await User.find({ _id: { $in: userIds } });

            if (users.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No users found',
                });
            }

            // Queue emails for each user
            const promises = users.map((user) =>
                emailService.queueCustomEmail({
                    to: user.email,
                    subject,
                    htmlContent,
                    data: {
                        ...templateData,
                        userName: user.name || user.email,
                    },
                    userId: user._id.toString(),
                })
            );

            await Promise.all(promises);

            res.status(200).json({
                success: true,
                message: `Bulk email queued for ${users.length} users`,
                count: users.length,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to send bulk email',
            });
        }
    }

    /**
     * Get notification statistics
     * GET /api/notifications/stats
     */
    async getStats(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).userId;

            const [total, unread, byCategory, byStatus] = await Promise.all([
                Notification.countDocuments({ userId }),
                Notification.countDocuments({ userId, status: { $ne: 'read' } }),
                Notification.aggregate([
                    { $match: { userId: userId } },
                    { $group: { _id: '$category', count: { $sum: 1 } } },
                ]),
                Notification.aggregate([
                    { $match: { userId: userId } },
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                ]),
            ]);

            res.status(200).json({
                success: true,
                stats: {
                    total,
                    unread,
                    byCategory: byCategory.reduce((acc: any, item: any) => {
                        acc[item._id] = item.count;
                        return acc;
                    }, {}),
                    byStatus: byStatus.reduce((acc: any, item: any) => {
                        acc[item._id] = item.count;
                        return acc;
                    }, {}),
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch notification stats',
            });
        }
    }
}
