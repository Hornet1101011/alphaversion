export const getMyInquiries = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    // Find inquiries by username and barangayID
    const inquiries = await Inquiry.find({ username: user.username, barangayID: user.barangayID })
      .sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching resident inquiries', error });
  }
};
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { Inquiry } from '../models/Inquiry';
import { io } from '../index';
import { User } from '../models/User';
import { Message } from '../models/Message';

export const createInquiry = async (req: any, res: Response, next: NextFunction) => {
  try {
    // Accept assignedTo (array of user IDs) and/or assignedRole
    const { subject, message, type, assignedTo, assignedRole, username: targetUsername, barangayID: targetBarangayID } = req.body;
    const user = (req as any).user;

    // Resolve recipient username/barangayID. Prefer explicit client-provided fields.
    let resolvedUsername = targetUsername;
    let resolvedBarangayID = targetBarangayID;

    // Diagnostic: log incoming body for debugging
    try {
      console.info('createInquiry incoming body:', { bodySample: { subject, message, targetUsername, targetBarangayID, assignedTo, assignedRole }, rawBodyKeys: Object.keys(req.body || {}) });
    } catch (e) {
      // ignore logging errors
    }

    // If client didn't provide username, attempt to infer from request body or uploaded metadata
    if (!resolvedUsername) {
      // Try to detect a username in other body fields (legacy clients might send 'username' elsewhere)
      if (req.body && (req.body.recipientUsername || req.body.toUsername)) {
        resolvedUsername = req.body.recipientUsername || req.body.toUsername;
      }
    }

    // If still missing, try to match by createdBy info (if the client attached createdBy as object)
    if (!resolvedUsername && req.body && req.body.createdBy) {
      if (typeof req.body.createdBy === 'string') {
        resolvedUsername = req.body.createdBy;
      } else if (req.body.createdBy.username) {
        resolvedUsername = req.body.createdBy.username;
      }
    }

    // If a username-like identifier is present (could be email or id), try to find canonical resident
    if (resolvedUsername) {
      try {
        // Look up by username or email or _id
        const possibleResident = await User.findOne({
          role: 'resident',
          $or: [ { username: resolvedUsername }, { email: resolvedUsername }, { _id: resolvedUsername } ]
        }).lean();
        if (possibleResident) {
          resolvedUsername = possibleResident.username;
          resolvedBarangayID = resolvedBarangayID || possibleResident.barangayID;
        }
      } catch (e) {
        // ignore lookup errors
      }
    }

    // Last-ditch: try to find a resident by matching a name in the subject/message to a user record
    if (!resolvedUsername && (subject || message)) {
      try {
        const nameCandidate = (subject || message).toString().slice(0, 200);
        const regex = new RegExp(nameCandidate.split(' ').slice(0,3).join('|'), 'i');
        const possible = await User.findOne({
          role: 'resident',
          $or: [ { fullName: { $regex: regex } }, { username: { $regex: regex } } ]
        }).lean();
        if (possible && possible.username) {
          resolvedUsername = possible.username;
          resolvedBarangayID = resolvedBarangayID || possible.barangayID;
        }
      } catch (e) {
        // ignore inference errors
        console.warn('Failed to infer resident username for inquiry creation', e);
      }
    }

    // Diagnostic: log what we resolved before creating inquiry
    try {
      console.info('createInquiry resolved recipient', { resolvedUsername, resolvedBarangayID, fallbackToStaff: (!resolvedUsername) });
    } catch (e) {}

    // If this is a staff/admin creating a thread and we couldn't resolve a recipient,
    // return an error so staff must explicitly select a resident instead of silently
    // saving the inquiry under the staff account (which prevents the resident from seeing it).
    try {
      const roleStr = (user && user.role) ? String(user.role).toLowerCase() : '';
      const isStaffLike = roleStr.includes('staff') || roleStr.includes('admin');
      if (isStaffLike && !resolvedUsername) {
        return res.status(400).json({ message: 'Recipient not resolved. Please select a resident to send this message to.' });
      }
    } catch (e) {
      // ignore
    }

    const inquiry = new Inquiry({
      subject,
      message,
      type: type || 'General',
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
      assignedRole: assignedRole || 'staff',
      createdBy: user?._id,
      // Use resolvedUsername/barangayID if available; otherwise fall back to staff user (legacy behavior)
      username: resolvedUsername || user?.username || 'Unknown',
      barangayID: resolvedBarangayID || user?.barangayID || 'Unknown',
    });
    // If files were uploaded via multer (router uses upload.array('attachments')) save metadata
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const host = req.get('host');
      const proto = req.protocol;
      inquiry.attachments = (req.files as any[]).map(f => ({
        filename: f.originalname,
        path: f.path,
        url: `${proto}://${host}/uploads/inquiries/${path.basename(f.path)}`,
        contentType: f.mimetype,
        size: f.size,
        uploadedAt: new Date()
      }));
    }
    await inquiry.save();
    // Notify assigned staff
    const Notification = require('../../models/Notification');
    if (Array.isArray(assignedTo)) {
      for (const staffId of assignedTo) {
        await Notification.create({
          userId: staffId,
          type: 'inquiries',
          title: 'New Inquiry',
          message: `New inquiry submitted: ${subject}`
        });
      }
    }
    res.status(201).json(inquiry);
  } catch (error) {
    res.status(500).json({ message: 'Error creating inquiry', error });
  }
};

export const getAllInquiries = async (req: any, res: Response, next: NextFunction) => {
  try {
    // Only show inquiries assigned to the user or their role
    const user = req.user;
    let filter: any = {};
    if (user) {
      // Make staff inbox more permissive: include inquiries explicitly assigned to the user,
      // inquiries assigned to the user's role, and also inquiries that have no assignedRole
      // or an empty assignedRole (so staff don't miss unassigned submissions).
      filter = {
        $or: [
          { assignedTo: user._id },
          { assignedRole: user.role },
          { assignedRole: { $exists: false } },
          { assignedRole: '' },
          { assignedRole: null }
        ]
      };
    }
    const inquiries = await Inquiry.find(filter)
      .populate('createdBy', 'fullName username')
      .populate('assignedTo', 'fullName username');
    res.json(inquiries);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inquiries', error });
  }
};

export const getInquiryById = async (req: any, res: Response, next: NextFunction) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('assignedTo', 'firstName lastName');
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }
    res.json(inquiry);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inquiry', error });
  }
};

export const updateInquiry = async (req: any, res: Response, next: NextFunction) => {
  try {
    const inquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }
    res.json(inquiry);
  } catch (error) {
    res.status(500).json({ message: 'Error updating inquiry', error });
  }
};

export const addResponse = async (req: any, res: Response, next: NextFunction) => {
// ...existing code...
module.exports = {
  createInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiry,
  addResponse,
  getMyInquiries,
};
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    const responseText = req.body.text || req.body.response;
    if (!responseText) {
      return res.status(400).json({ message: 'Response text is required.' });
    }
    const responseEntry: any = {
      text: responseText,
      createdBy: (req as any).user._id,
      createdAt: new Date(),
    };

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const host = req.get('host');
      const proto = req.protocol;
      responseEntry.attachments = (req.files as any[]).map(f => ({
        filename: f.originalname,
        path: f.path,
        url: `${proto}://${host}/uploads/inquiries/${path.basename(f.path)}`,
        contentType: f.mimetype,
        size: f.size,
        uploadedAt: new Date()
      }));
    }

    inquiry.responses?.push(responseEntry);

    await inquiry.save();

    // Find the resident user by username and barangayID
    const { username, barangayID } = inquiry;
    let resident;
    try {
      resident = await User.findOne({ username, barangayID, role: 'resident' });
    } catch (userErr) {
      console.error('Error finding resident:', userErr);
    }

    // Optionally, emit a socket event to notify the resident in real-time
    if (resident) {
      io.to(resident._id.toString()).emit('inquiryResponse', {
        inquiryId: req.params.id,
        responder: (req as any).user._id,
        response: responseText,
      });
    }

    // Notify resident
    const Notification = require('../../models/Notification');
    if (resident) {
      await Notification.create({
        userId: resident._id,
        type: 'inquiries',
        title: 'Inquiry Reply',
        message: `Staff replied to your inquiry: ${responseText}`
      });
    }
    res.json(inquiry);
  } catch (error) {
    console.error('Error in addResponse:', error);
    res.status(500).json({ message: 'Error adding response', error });
  }
};
