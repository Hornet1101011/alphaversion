import { Request, Response } from 'express';
import { logActivity } from '../middleware/logActivity';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { Resident } from '../models/Resident';
import jwt from 'jsonwebtoken';
import { validateEmail, validatePassword } from '../utils/validation';

// Types for request bodies
interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'staff' | 'resident' | 'ADMIN' | 'STAFF' | 'RESIDENT';
  barangayID: string;
  contactNumber?: string;
  address?: string;
  department?: string;
}

interface LoginRequest {
  identifier: string; // can be email or username
  password: string;
}

// Generate JWT Token (now includes username)
const generateToken = (user: { _id: string, role: string, username: string }): string => {
  return jwt.sign(
    { _id: user._id, role: user.role, username: user.username },
    process.env.JWT_SECRET || 'defaultsecret',
    { expiresIn: '24h' }
  );
};

export const register = async (req: Request, res: Response, next: unknown) => {
  try {
    const {
      fullName,
      username,
      email,
      password,
      role,
      barangayID,
      contactNumber,
      address,
      department,
    } = req.body as RegisterRequest;

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password strength
    if (!validatePassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long and contain at least one number, one uppercase letter, and one special character'
      });
    }


    // Check if email, username, or barangayID already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    // Normalize or generate barangayID if not provided
    let finalBarangayID = (barangayID || '').toString().trim();
    if (!finalBarangayID) {
      // Generate in the format: brgyparian-<year>-<6digits>
      let attempts = 0;
      do {
        const year = new Date().getFullYear();
        // generate 6-character mixed-case alphanumeric suffix
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let rand = '';
        for (let i = 0; i < 6; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
        finalBarangayID = `brgyparian-${year}-${rand}`;
        const exists = await User.findOne({ barangayID: finalBarangayID });
        if (!exists) break;
        attempts++;
      } while (attempts < 10);
      if (attempts >= 5) {
        return res.status(500).json({ message: 'Failed to generate unique Barangay ID' });
      }
    } else {
      // If provided, ensure it's not already taken
      const existingBarangayID = await User.findOne({ barangayID: finalBarangayID });
      if (existingBarangayID) {
        return res.status(400).json({ message: 'Barangay ID already registered' });
      }
    }

    // If user is requesting staff via public registration, register as resident and create notification
    let actualRole = role;
    let staffRequest = false;
    const normalizedRole = role.toLowerCase();
    if (
      normalizedRole === 'staff' &&
      (
        !(req as any).user ||
        ((req as any).user as { role?: string }).role !== 'admin'
      )
    ) {
      actualRole = 'resident';
      staffRequest = true;
    } else {
      actualRole = normalizedRole as RegisterRequest['role'];
    }

    // Create new user
    const user = new User({
      name: fullName, // Set name field for validation
      fullName,
      username,
      email,
      password,
      role: actualRole,
      barangayID: finalBarangayID,
      contactNumber,
      address,
      department,
      isActive: true,
    });

    await user.save();

  // If user is a resident, create a Resident document for their personal info
  if (actualRole === 'resident') {
      await Resident.create({
        userId: user._id, // <-- Add this line to fix validation error
        firstName: fullName.split(' ')[0] || '',
        lastName: fullName.split(' ').slice(-1)[0] || '',
        barangayID,
        email,
        contactNumber,
        address,
        // Optionally add more fields as needed
      });
    }

    // If staff request, create notification for admin
    if (staffRequest) {
      // Find all admins
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          type: 'staff_approval',
          message: `${fullName} (${email}) has requested staff access.`,
          data: { userId: user._id, fullName, email, username },
        });
      }
    }

    // Generate token
    const token = generateToken({ _id: user._id as string, role: user.role, username: user.username });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log registration activity
    await logActivity(req, 'USER', 'REGISTER', `User ${user.email} registered with role ${user.role}.`);

    res.status(201).json({
      message: staffRequest ? 'Registration successful. Staff request sent to admin.' : 'Registration successful',
      token,
      user: user.userInfo
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Error during registration',
      error: (error as Error).message
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body as LoginRequest;

    // Find user by email or username
    const user = await User.findByCredentials(identifier);

    if (!user) {
      return res.status(401).json({ message: 'Invalid login credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Check if user is suspended until a future date
    if (user.suspendedUntil && user.suspendedUntil instanceof Date && user.suspendedUntil > new Date()) {
      return res.status(403).json({ message: `Account suspended until ${user.suspendedUntil.toISOString()}` });
    }

    // Verify password
    const isPasswordValid = typeof user.comparePassword === 'function'
      ? await user.comparePassword(password)
      : user.password === password;
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid login credentials' });
    }


    // Always normalize role to lowercase for schema compatibility
    if (user.role && typeof user.role === 'string') {
      user.role = user.role.toLowerCase() as typeof user.role;
    }
    // If user is a resident, ensure they have a Resident container
    if (user.role === 'resident') {
      // Use require to avoid ESM import error
      const { Resident } = require('../models/Resident');
      let resident = await Resident.findOne({ barangayID: user.barangayID });
      if (!resident) {
        resident = await Resident.create({
          userId: user._id,
          firstName: user.fullName?.split(' ')[0] || '',
          lastName: user.fullName?.split(' ').slice(-1)[0] || '',
          barangayID: user.barangayID,
          email: user.email,
          contactNumber: user.contactNumber,
          address: user.address,
        });
      } else {
        // Optionally update resident container with latest user info
        resident.userId = user._id;
        resident.email = user.email;
        resident.contactNumber = user.contactNumber;
        resident.address = user.address;
        await resident.save();
      }
    }

    // Generate token
    const token = generateToken({ _id: user._id as string, role: user.role, username: user.username });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log activity
    await logActivity(req, 'USER', 'LOGIN', `User ${user.email} logged in.`);
    // Send response with token and basic user info
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      message: 'Error during login',
      error: (error as Error).message
    });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
  const userId = ((req as any).user)?._id;
  const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.userInfo);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching user profile',
      error: (error as Error).message
    });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const updates = {
      fullName: req.body.fullName,
      contactNumber: req.body.contactNumber,
      address: req.body.address,
    };

    // Prevent barangayID tampering
    if (req.body.barangayID) {
      return res.status(400).json({ message: 'Barangay ID cannot be changed.' });
    }

    const userId = ((req as any).user)?._id;

    // Optionally check for duplicate barangayID (shouldn't happen since it's read-only, but for safety)
    // const existingBarangayID = await User.findOne({ barangayID: req.body.barangayID, _id: { $ne: userId } });
    // if (existingBarangayID) {
    //   return res.status(400).json({ message: 'Barangay ID already registered' });
    // }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: user.userInfo
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating profile',
      error: (error as Error).message
    });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

  const userId = ((req as any).user)?._id;
  const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Validate new password
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        message: 'New password must be at least 6 characters long and contain at least one number, one uppercase letter, and one special character'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({
      message: 'Error changing password',
      error: (error as Error).message
    });
  }
};

// Example: Add this function if you don't have a resident save/update controller
// Save or update resident information
export const saveResidentInfo = async (req: Request, res: Response) => {
  try {
    const userId = ((req as any).user)?._id;
    // Find resident by userId
    let resident = await Resident.findOne({ userId });
    if (resident) {
      // Update resident info
      Object.assign(resident, req.body);
      await resident.save();
      return res.json({ message: 'Resident information updated successfully', resident });
    } else {
      // Create new resident info
      resident = new Resident({ ...req.body, userId });
      await resident.save();
      return res.status(201).json({ message: 'Resident information saved successfully', resident });
    }
  } catch (error) {
    return res.status(500).json({
      message: 'Error saving resident information',
      error: (error as Error).message
    });
  }
};
