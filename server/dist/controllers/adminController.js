"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllStaff = exports.deleteStaff = exports.updateStaff = exports.createStaff = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const Log_1 = require("../models/Log");
// Create new staff account
const createStaff = async (req, res) => {
    try {
        const { fullName, username, email, password, contactNumber, barangayID, department } = req.body;
        // Check if user already exists
        let user = await User_1.User.findOne({ $or: [{ email }, { username }, { barangayID }] });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        // Create new staff user (password will be hashed by pre-save middleware)
        user = new User_1.User({
            fullName,
            username,
            email,
            password,
            contactNumber,
            barangayID,
            department,
            role: 'staff',
            isActive: true
        });
        await user.save();
        res.status(201).json({
            message: 'Staff account created successfully',
            user: user.userInfo
        });
    }
    catch (error) {
        console.error('Error creating staff account:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createStaff = createStaff;
// Update staff account
const updateStaff = async (req, res) => {
    try {
        const staffId = req.params.id;
        const updates = req.body;
        // Check if staff exists
        const staff = await User_1.User.findById(staffId);
        if (!staff || staff.role !== 'staff') {
            return res.status(404).json({ message: 'Staff not found' });
        }
        // Update password if provided
        if (updates.password) {
            const salt = await bcryptjs_1.default.genSalt(10);
            updates.password = await bcryptjs_1.default.hash(updates.password, salt);
        }
        // Update staff details
        const updatedStaff = await User_1.User.findByIdAndUpdate(staffId, { $set: updates }, { new: true }).select('-password');
        // Audit log for role change
        if (updates.role) {
            await Log_1.Log.create({
                type: 'audit',
                message: 'Staff role changed',
                details: `Staff ID: ${staffId}, New role: ${updates.role}, Changed by: ${req.user._id}`,
                actor: String(req.user._id),
                target: String(staffId)
            });
        }
        res.json({
            message: 'Staff account updated successfully',
            user: updatedStaff
        });
    }
    catch (error) {
        console.error('Error updating staff account:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateStaff = updateStaff;
// Delete staff account
const deleteStaff = async (req, res) => {
    try {
        const staffId = req.params.id;
        // Check if staff exists
        const staff = await User_1.User.findById(staffId);
        if (!staff || staff.role !== 'staff') {
            return res.status(404).json({ message: 'Staff not found' });
        }
        await User_1.User.findByIdAndDelete(staffId);
        // Audit log for staff deletion
        await Log_1.Log.create({
            type: 'audit',
            message: 'Staff account deleted',
            details: `Staff ID: ${staffId}, Deleted by: ${req.user._id}`,
            actor: String(req.user._id),
            target: String(staffId)
        });
        res.json({ message: 'Staff account deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting staff account:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteStaff = deleteStaff;
// Get all staff accounts
const getAllStaff = async (req, res) => {
    try {
        const staff = await User_1.User.find({ role: 'staff' })
            .select('-password')
            .sort({ createdAt: -1 });
        res.json(staff);
    }
    catch (error) {
        console.error('Error fetching staff accounts:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getAllStaff = getAllStaff;
