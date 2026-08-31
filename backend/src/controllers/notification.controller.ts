import { Response } from 'express';
import {
  getNotificationsByUserId,
  getUnreadCountByUserId,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../models/notification.model';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import type { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/notifications?limit=30&offset=0
 * Returns the current user's notifications.
 */
export const getUserNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { limit, offset } = parsePagination(req, { defaultLimit: 30, maxLimit: 100 });

  const notifications = await getNotificationsByUserId(userId, limit, offset);
  res.json({ notifications, limit, offset });
});

/**
 * GET /api/notifications/unread-count
 * Returns the count of unread notifications for the user.
 */
export const getUnreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const count = await getUnreadCountByUserId(userId);
  res.json({ count });
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a specific notification as read. Scoped to user_id at the model
 * layer, so a user cannot mark another user's notification as read.
 */
export const markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  await markNotificationRead(id, userId);
  res.json({ message: 'Notification marked as read' });
});

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications as read for the user.
 */
export const markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  await markAllNotificationsRead(userId);
  res.json({ message: 'All notifications marked as read' });
});

/**
 * DELETE /api/notifications/:id
 * Deletes a specific notification. Scoped to user_id at the model layer.
 */
export const removeNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  await deleteNotification(id, userId);
  res.json({ message: 'Notification deleted' });
});
