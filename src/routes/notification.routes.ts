import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// All routes require authentication
router.use(authenticate);

// Get all notifications
router.get('/', notificationController.getAllNotifications.bind(notificationController));

// Get notification stats
router.get('/stats', notificationController.getStats.bind(notificationController));

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead.bind(notificationController));

// Mark all as read
router.put('/read-all', notificationController.markAllAsRead.bind(notificationController));

// Clear all notifications (delete)
router.delete('/clear-all', notificationController.clearAll.bind(notificationController));

// Admin routes (TODO: Add admin middleware)
router.post('/send-custom-email', notificationController.sendCustomEmail.bind(notificationController));
router.post('/send-bulk-email', notificationController.sendBulkEmail.bind(notificationController));

export default router;
