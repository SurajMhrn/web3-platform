import { Router } from 'express';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  removeNotification,
} from '../controllers/notification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// All notification routes require authentication
router.use(authenticateJWT);

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: List the authenticated user's notifications
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30, maximum: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Paginated notification list }
 */
router.get('/', getUserNotifications);

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     summary: Count of unread notifications for the authenticated user
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Unread count }
 */
router.get('/unread-count', getUnreadCount);

/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: All notifications marked read }
 */
router.patch('/read-all', markAllAsRead);

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark one notification as read
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Notification marked read }
 */
router.patch('/:id/read', markAsRead);

/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Notification deleted }
 */
router.delete('/:id', removeNotification);

export default router;
