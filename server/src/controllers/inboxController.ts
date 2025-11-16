import { Request, Response, NextFunction } from 'express';
import { Inquiry } from '../models/Inquiry';

// Get all inquiries for the logged-in resident (for inbox)
export const getResidentInbox = async (req: any, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.username || !req.user.barangayID) {
      return res.status(401).json({ message: 'Unauthorized: No user found' });
    }  
    const { username, barangayID } = req.user;
    // Fetch inquiries by username and barangayID
    const inquiries = await Inquiry.find({ username, barangayID }).sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (error) {
    next(error);
  }
};
