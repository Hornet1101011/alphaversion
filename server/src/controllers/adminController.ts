import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { IUser } from '../models/User';
import { Log } from '../models/Log';

interface StaffCreateRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  contactNumber: string;
}

interface StaffUpdateRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  contactNumber?: string;
  isActive?: boolean;
  role?: string;
}

// Create new staff account
export const createStaff = async (req: Request, res: Response) => {
  try {
    const { fullName, username, email, password, contactNumber, barangayID, department }: Partial<IUser> = req.body;

    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }, { barangayID }] });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new staff user (password will be hashed by pre-save middleware)
    user = new User({
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
  } catch (error) {
    console.error('Error creating staff account:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update staff account
export const updateStaff = async (req: Request, res: Response) => {
  try {
    const staffId = req.params.id;
    const updates: StaffUpdateRequest = req.body;

    // Check if staff exists
    const staff = await User.findById(staffId);
    if (!staff || staff.role !== 'staff') {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Update password if provided
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }

    // Update staff details
    const updatedStaff = await User.findByIdAndUpdate(
      staffId,
      { $set: updates },
      { new: true }
    ).select('-password');

    // Audit log for role change
    if (updates.role) {
      await Log.create({
        type: 'audit',
        message: 'Staff role changed',
        details: `Staff ID: ${staffId}, New role: ${updates.role}, Changed by: ${(req as any).user._id}`,
        actor: String((req as any).user._id),
        target: String(staffId)
      });
    }

    res.json({
      message: 'Staff account updated successfully',
      user: updatedStaff
    });
  } catch (error) {
    console.error('Error updating staff account:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete staff account
export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const staffId = req.params.id;

    // Check if staff exists
    const staff = await User.findById(staffId);
    if (!staff || staff.role !== 'staff') {
      return res.status(404).json({ message: 'Staff not found' });
    }

    await User.findByIdAndDelete(staffId);
    // Audit log for staff deletion
    await Log.create({
      type: 'audit',
      message: 'Staff account deleted',
      details: `Staff ID: ${staffId}, Deleted by: ${(req as any).user._id}`,
      actor: String((req as any).user._id),
      target: String(staffId)
    });
    res.json({ message: 'Staff account deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff account:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all staff accounts
export const getAllStaff = async (req: Request, res: Response) => {
  try {
    const staff = await User.find({ role: 'staff' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff accounts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
