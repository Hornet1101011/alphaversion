"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.UserStatus = exports.UserRole = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["STAFF"] = "staff";
    UserRole["RESIDENT"] = "resident";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["INACTIVE"] = "INACTIVE";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
const userSchema = new mongoose_1.default.Schema({
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
userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    try {
        const salt = await bcryptjs_1.default.genSalt(12);
        this.password = await bcryptjs_1.default.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcryptjs_1.default.compare(candidatePassword, this.password);
    }
    catch (error) {
        throw new Error('Error comparing passwords');
    }
};
// Static method to find user by email
userSchema.statics.findByCredentials = async function (login) {
    // Allow login by email or username
    return await this.findOne({
        $or: [
            { email: login.toLowerCase() },
            { username: login }
        ]
    });
};
// Virtual for user's public info
userSchema.virtual('userInfo').get(function () {
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
    transform: function (_doc, ret) {
        const transformed = { ...ret };
        transformed.password = undefined;
        transformed.__v = undefined;
        return transformed;
    }
});
exports.User = mongoose_1.default.model('User', userSchema);
