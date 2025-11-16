import { Request, Response } from 'express';
import { Guest } from '../models/Guest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const createGuest = async (req: Request, res: Response) => {
  try {
    const { name, contactNumber, email, intent } = req.body || {};
    if (!name || !contactNumber || !intent) {
      return res.status(400).json({ message: 'Missing required guest fields: name, contactNumber, intent' });
    }
    // generate a secure session token for guest
    const sessionToken = crypto.randomBytes(24).toString('hex');
    const guest = new Guest({ name, contactNumber, email, intent, sessionToken });
    await guest.save();
    // create a short-lived JWT so the guest can be treated like a limited user on the client
    const tokenPayload = {
      _id: (guest as any)._id.toString(),
      role: 'guest',
      username: (guest.name || 'guest').toString().replace(/\s+/g, '_').toLowerCase(),
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: '24h' });

    // respond with minimal guest info and the token
    res.status(201).json({
      _id: guest._id,
      name: guest.name,
      contactNumber: guest.contactNumber,
      email: guest.email,
      intent: guest.intent,
      sessionToken: guest.sessionToken,
      expiresAt: guest.expiresAt,
      token,
    });
  } catch (err: any) {
    console.error('Failed to create guest', err);
    if (err.name === 'ValidationError') {
      const errors: any = {};
      for (const k in err.errors) errors[k] = err.errors[k].message;
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    return res.status(500).json({ message: 'Failed to create guest', error: err.message });
  }
};

export default createGuest;
