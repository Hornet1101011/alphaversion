import { Request, Response } from 'express';
import { Log, ILog } from '../models/Log';

export const getAllLogs = async (req: Request, res: Response) => {
  const logs = await Log.find();
  res.json(logs);
};

export const addLog = async (req: Request, res: Response) => {
  const log = new Log(req.body);
  await log.save();
  res.status(201).json(log);
};
// Add more analytics/error log logic as needed
