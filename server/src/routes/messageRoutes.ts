import express from 'express';
import { Message } from '../models/Message';
import { User } from '../models/User';

const router = express.Router();

// Get all messages for the logged-in resident
router.get('/my-inbox', async (req: any, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const messages = await Message.find({ to: userId }).sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inbox', error });
  }
});

export default router;
