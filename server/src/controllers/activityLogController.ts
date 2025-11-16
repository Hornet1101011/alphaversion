import { Request, Response } from 'express';
import { ActivityLog } from '../models/ActivityLog';

// GET /activity-logs?userId=&module=&action=&fromDate=&toDate=&page=&pageSize=&search=
export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      module,
      action,
      fromDate,
      toDate,
      page = 1,
      pageSize = 20,
      search
    } = req.query;

    const filter: any = {};
    if (userId) filter.userId = userId;
    if (module) filter.module = module;
    if (action) filter.action = action;
    if (fromDate || toDate) {
      filter.timestamp = {};
      if (fromDate) filter.timestamp.$gte = new Date(fromDate as string);
      if (toDate) filter.timestamp.$lte = new Date(toDate as string);
    }
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { module: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const total = await ActivityLog.countDocuments(filter);
    const logs = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(pageSize))
      .populate('userId', 'username fullName email role');

    res.json({
      data: logs,
      total,
      page: Number(page),
      pageSize: Number(pageSize)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activity logs', error });
  }
};
