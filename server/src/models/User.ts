import mongoose, { Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';


interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}



export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  RESIDENT = 'resident',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}


export interface IUser extends Document {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  barangayID: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  deletedAt?: Date | null;
  suspendedUntil?: Date | null;
  contactNumber?: string;
  address?: string;
  department?: string;
  profileImage?: string;
  profileImageId?: string;
  // Password reset handled by PasswordResetToken model
  userInfo?: {
    id: string;
    fullName: string;
    username: string;
    email: string;
    role: string;
    barangayID: string;
    isActive: boolean;
    contactNumber?: string;
    address?: string;
    department?: string;
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
}

interface IUserModel extends Model<IUser, {}, IUserMethods> {
  findByCredentials(login: string): Promise<IUser | null>;
}

const userSchema = new mongoose.Schema({
// Removed 'name' field from schema
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [4, 'Username must be at least 4 characters long'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.RESIDENT,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE,
    required: true,
  },
  barangayID: {
    type: String,
    required: [true, 'Barangay ID is required'],
    unique: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  suspendedUntil: {
    type: Date,
    default: null,
  },
  contactNumber: {
    type: String,
    match: [/^[0-9+\-\s()]+$/, 'Please enter a valid contact number'],
  },
  address: {
    type: String,
  },
  profileImage: { type: String },
  profileImageId: { type: String },
  // Resident verification status
  verified: {
    type: Boolean,
    default: false,
  },
  // Password reset token and expiry (for forgot/reset flow)
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  department: {
    type: String,
    trim: true,
    required: false,
  }
}, {
  timestamps: true,
});

// Note: email is already declared unique on the schema field. Avoid duplicate index declarations.

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};

// Static method to find user by email
userSchema.statics.findByCredentials = async function(login: string) {
  // Allow login by email or username
  return await this.findOne({
    $or: [
      { email: login.toLowerCase() },
      { username: login }
    ]
  });
};

// Virtual for user's public info
userSchema.virtual('userInfo').get(function(this: IUser) {
  return {
    id: this._id,
    fullName: this.fullName,
    username: this.username,
    email: this.email,
    role: this.role,
    barangayID: this.barangayID,
    isActive: this.isActive,
    contactNumber: this.contactNumber,
    address: this.address,
    department: this.department,
    status: this.status,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
    deletedAt: this.deletedAt,
    suspendedUntil: this.suspendedUntil,
  };
});

// Ensure virtuals are included when converting to JSON
userSchema.set('toJSON', {
  transform: function(_doc, ret: any) {
    const transformed = { ...ret };
    transformed.password = undefined;
    transformed.__v = undefined;
    return transformed;
  }
});

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
