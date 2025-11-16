import { Request, Response, NextFunction } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { User } from '../models/User';

export async function logActivity(req: Request, module: string, action: string, description: string) {
  try {
    const user = (req as any).user;
    if (!user || !user._id) {
      // Skip logging if userId is missing
      return;
    }
    const userId = user._id;
    const userRole = user.role || 'GUEST';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    await ActivityLog.create({
      timestamp: new Date(),
      userId,
      userRole,
      module,
      action,
      description,
      ipAddress,
    });
  } catch (err) {
    // Optionally log error
    console.error('Activity log error:', err);
  }
}
