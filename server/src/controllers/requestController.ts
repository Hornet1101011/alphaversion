import { Request, Response } from 'express';
import { Request as ServiceRequest } from '../models/Request';
import { User, UserRole } from '../models/User';
import { Notification } from '../models/Notification';
import { Message } from '../models/Message';

export const createRequest = async (req: Request, res: Response) => {
  try {
    const request = new ServiceRequest({
      ...req.body,
      requestedBy: (req as any).user?._id,
    });
    await request.save();
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: 'Error creating request', error });
  }
};

export const getAllRequests = async (req: Request, res: Response) => {
  try {
    const requests = await ServiceRequest.find()
      // Populate requestedBy/assignedTo with friendly user fields so clients can display names/emails
      .populate('requestedBy', 'fullName username email')
      .populate('assignedTo', 'fullName username email');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests', error });
  }
};

export const getRequestById = async (req: Request, res: Response) => {
  try {
    const request = await ServiceRequest.findById(req.params.id)
      .populate('requestedBy', 'fullName username email')
      .populate('assignedTo', 'fullName username email');
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching request', error });
  }
};

export const updateRequest = async (req: Request, res: Response) => {
  try {
    const request = await ServiceRequest.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Error updating request', error });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.comments?.push({
      text: req.body.text,
      createdBy: (req as any).user._id,
      createdAt: new Date(),
    });

    await request.save();
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Error adding comment', error });
  }
};

// Approve a request (admin/staff) - promotes the requested user to staff and updates the Request
export const approveRequest = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.id;
    const serviceReq = await ServiceRequest.findById(requestId);
    if (!serviceReq) return res.status(404).json({ message: 'Request not found' });

    const requestedById: any = (serviceReq.requestedBy as any) || null;
    if (!requestedById) return res.status(400).json({ message: 'Request does not have requestedBy set' });

    const user = await User.findById(requestedById);
    if (!user) return res.status(404).json({ message: 'Requested user not found' });

    // If already staff, just update request status and return
    if (user.role === UserRole.STAFF) {
      serviceReq.status = 'approved';
      serviceReq.assignedTo = (req as any).user?._id;
      await serviceReq.save();
      return res.json({ message: 'User already staff; request marked approved', request: serviceReq });
    }

    // Promote to staff
  (user as any).role = UserRole.STAFF;
    user.isActive = true;
    await user.save();

  // Update request status
  serviceReq.status = 'approved';
    serviceReq.assignedTo = (req as any).user?._id;
    await serviceReq.save();

    // Remove any notifications that referenced this request (cleanup)
    try {
      await Notification.deleteMany({ 'data.requestId': serviceReq._id });
    } catch (e) {
      console.warn('Failed to delete related notifications (continuing):', e);
    }

    // Send a confirmation message (best-effort)
    try {
      await Message.create({
        to: user._id,
        from: (req as any).user?._id,
        subject: 'Staff access approved',
        text: 'Your request for staff access has been approved. You now have staff privileges.'
      });
    } catch (e) {
      console.warn('Failed to create approval message', e);
    }

  res.json({ message: 'User promoted to staff and request updated (approved)', request: serviceReq });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ message: 'Error approving request', error });
  }
};
