"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveRequest = exports.addComment = exports.updateRequest = exports.getRequestById = exports.getAllRequests = exports.createRequest = void 0;
const Request_1 = require("../models/Request");
const User_1 = require("../models/User");
const Notification_1 = require("../models/Notification");
const Message_1 = require("../models/Message");
const createRequest = async (req, res) => {
    try {
        const request = new Request_1.Request({
            ...req.body,
            requestedBy: req.user?._id,
        });
        await request.save();
        res.status(201).json(request);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating request', error });
    }
};
exports.createRequest = createRequest;
const getAllRequests = async (req, res) => {
    try {
        const requests = await Request_1.Request.find()
            // Populate requestedBy/assignedTo with friendly user fields so clients can display names/emails
            .populate('requestedBy', 'fullName username email')
            .populate('assignedTo', 'fullName username email');
        res.json(requests);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching requests', error });
    }
};
exports.getAllRequests = getAllRequests;
const getRequestById = async (req, res) => {
    try {
        const request = await Request_1.Request.findById(req.params.id)
            .populate('requestedBy', 'fullName username email')
            .populate('assignedTo', 'fullName username email');
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        res.json(request);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching request', error });
    }
};
exports.getRequestById = getRequestById;
const updateRequest = async (req, res) => {
    try {
        const request = await Request_1.Request.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true });
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        res.json(request);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating request', error });
    }
};
exports.updateRequest = updateRequest;
const addComment = async (req, res) => {
    try {
        const request = await Request_1.Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        request.comments?.push({
            text: req.body.text,
            createdBy: req.user._id,
            createdAt: new Date(),
        });
        await request.save();
        res.json(request);
    }
    catch (error) {
        res.status(500).json({ message: 'Error adding comment', error });
    }
};
exports.addComment = addComment;
// Approve a request (admin/staff) - promotes the requested user to staff and updates the Request
const approveRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const serviceReq = await Request_1.Request.findById(requestId);
        if (!serviceReq)
            return res.status(404).json({ message: 'Request not found' });
        const requestedById = serviceReq.requestedBy || null;
        if (!requestedById)
            return res.status(400).json({ message: 'Request does not have requestedBy set' });
        const user = await User_1.User.findById(requestedById);
        if (!user)
            return res.status(404).json({ message: 'Requested user not found' });
        // If already staff, just update request status and return
        if (user.role === User_1.UserRole.STAFF) {
            serviceReq.status = 'approved';
            serviceReq.assignedTo = req.user?._id;
            await serviceReq.save();
            return res.json({ message: 'User already staff; request marked approved', request: serviceReq });
        }
        // Promote to staff
        user.role = User_1.UserRole.STAFF;
        user.isActive = true;
        await user.save();
        // Update request status
        serviceReq.status = 'approved';
        serviceReq.assignedTo = req.user?._id;
        await serviceReq.save();
        // Remove any notifications that referenced this request (cleanup)
        try {
            await Notification_1.Notification.deleteMany({ 'data.requestId': serviceReq._id });
        }
        catch (e) {
            console.warn('Failed to delete related notifications (continuing):', e);
        }
        // Send a confirmation message (best-effort)
        try {
            await Message_1.Message.create({
                to: user._id,
                from: req.user?._id,
                subject: 'Staff access approved',
                text: 'Your request for staff access has been approved. You now have staff privileges.'
            });
        }
        catch (e) {
            console.warn('Failed to create approval message', e);
        }
        res.json({ message: 'User promoted to staff and request updated (approved)', request: serviceReq });
    }
    catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ message: 'Error approving request', error });
    }
};
exports.approveRequest = approveRequest;
