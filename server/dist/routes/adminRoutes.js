"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Get staff applicants (users with role: 'staff' and isActive: false)
const express_1 = __importDefault(require("express"));
// import { isAdmin } from '../middleware/authMiddleware';
// import { createStaff, updateStaff, deleteStaff, getAllStaff } from '../controllers/adminController';
// import { getRequestAnalytics } from '../controllers/analyticsController';
const router = express_1.default.Router();
const User_1 = require("../models/User");
const Resident_1 = require("../models/Resident");
const authMiddleware_1 = require("../middleware/authMiddleware");
const logController_1 = require("../controllers/logController");
// Get staff applicants (users with role: 'staff' and isActive: false)
router.get('/staff-applications', async (req, res) => {
    try {
        const applicants = await User_1.User.find({ role: 'staff', isActive: false }).select('-password');
        res.json({ count: applicants.length, applicants });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to fetch staff applicants', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// Get staff applicants (users with role: 'staff' and isActive: false)
router.get('/staff-applications', async (req, res) => {
    try {
        const applicants = await User_1.User.find({ role: User_1.UserRole.STAFF, isActive: false }).select('-password');
        res.json({ count: applicants.length, applicants });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to fetch staff applicants', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// Staff management routes
// router.post('/staff', isAdmin, createStaff);
// router.put('/staff/:id', isAdmin, updateStaff);
// router.delete('/staff/:id', isAdmin, deleteStaff);
// router.get('/staff', isAdmin, getAllStaff);
// Dashboard statistics endpoint
const Document_1 = require("../models/Document");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Announcement_1 = require("../models/Announcement");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const sharp_1 = __importDefault(require("sharp"));
router.get('/statistics', async (req, res) => {
    try {
        // Get all users and break down by role
        const allUsers = await User_1.User.find({});
        const totalUsers = allUsers.length;
        const byRole = {
            admin: allUsers.filter(u => u.role === User_1.UserRole.ADMIN).length,
            staff: allUsers.filter(u => u.role === User_1.UserRole.STAFF).length,
            resident: allUsers.filter(u => u.role === User_1.UserRole.RESIDENT).length
        };
        // Total documents, completed, and pending documents
        const documents = await Document_1.Document.find({});
        const byType = {};
        let completed = 0;
        let pending = 0;
        let rejected = 0;
        documents.forEach(doc => {
            if (doc.status === 'approved')
                completed++;
            if (doc.status === 'pending')
                pending++;
            if (doc.status === 'rejected')
                rejected++;
            byType[doc.type] = (byType[doc.type] || 0) + 1;
        });
        res.json({
            users: {
                total: totalUsers,
                byRole
            },
            documents: {
                total: documents.length,
                completed,
                pending,
                rejected,
                byType
            }
        });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to fetch statistics', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// Multer setup for announcement images
const announcementsUploadDir = path_1.default.join(process.cwd(), 'uploads', 'announcements');
if (!fs_1.default.existsSync(announcementsUploadDir))
    fs_1.default.mkdirSync(announcementsUploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, announcementsUploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = (0, multer_1.default)({ storage });
// Create a separate multer instance for admin avatar uploads with limits and fileFilter
const avatarUpload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowed.includes(file.mimetype)) {
            // reject file
            return cb(new Error('INVALID_FILE_TYPE'));
        }
        cb(null, true);
    }
});
// GridFS bucket for admin avatar uploads (lazy init)
let adminAvatarsBucket = null;
mongoose_1.default.connection.on('open', () => {
    try {
        // @ts-ignore
        const db = mongoose_1.default.connection.db;
        adminAvatarsBucket = new mongodb_1.GridFSBucket(db, { bucketName: 'avatars' });
        console.log('Admin avatars GridFSBucket initialized');
    }
    catch (err) {
        console.error('Failed to init admin avatars GridFSBucket', err);
    }
});
// POST /admin/announcements - create an announcement (admin only)
router.post('/announcements', authMiddleware_1.isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || text.trim() === '')
            return res.status(400).json({ message: 'Text is required' });
        const imagePath = req.file ? path_1.default.join('uploads', 'announcements', path_1.default.basename(req.file.path)) : undefined;
        // req.user may contain _id (from mongoose) or id depending on auth middleware
        const createdBy = (req.user && (req.user._id || req.user.id)) || undefined;
        const annData = { text: text.trim(), imagePath, createdBy };
        // if multer stored the file, read its buffer and content-type to save into DB
        if (req.file && req.file.path) {
            try {
                const buffer = fs_1.default.readFileSync(req.file.path);
                annData.imageData = buffer;
                annData.imageContentType = req.file.mimetype || undefined;
            }
            catch (e) {
                console.warn('Failed to read uploaded file into buffer', e);
            }
        }
        const ann = new Announcement_1.Announcement(annData);
        await ann.save();
        res.json({ message: 'Announcement created', announcement: ann });
    }
    catch (err) {
        console.error('Failed to create announcement', err);
        res.status(500).json({ message: 'Failed to create announcement', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// GET /admin/announcements/list - admin listing (exclude binary image data)
router.get('/announcements/list', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const anns = await Announcement_1.Announcement.find({}, '-imageData -imageContentType').sort({ createdAt: -1 });
        res.json(anns);
    }
    catch (err) {
        console.error('Failed to fetch admin announcements', err);
        res.status(500).json({ message: 'Failed to fetch admin announcements', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// DELETE /admin/announcements/:id - delete announcement and remove image file if exists
router.delete('/announcements/:id', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const ann = await Announcement_1.Announcement.findById(req.params.id);
        if (!ann)
            return res.status(404).json({ message: 'Announcement not found' });
        if (ann.imagePath) {
            const filePath = path_1.default.join(process.cwd(), ann.imagePath);
            try {
                if (fs_1.default.existsSync(filePath))
                    fs_1.default.unlinkSync(filePath);
            }
            catch (e) {
                console.warn('Failed to delete file', filePath, e);
            }
        }
        await ann.deleteOne();
        res.json({ message: 'Announcement deleted' });
    }
    catch (err) {
        console.error('Failed to delete announcement', err);
        res.status(500).json({ message: 'Failed to delete announcement', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// GET /admin/logs - admin activity/logs (protected)
router.get('/logs', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        // reuse existing controller to fetch logs
        return (0, logController_1.getAllLogs)(req, res);
    }
    catch (err) {
        console.error('Failed to fetch admin logs', err);
        return res.status(500).json({ message: 'Failed to fetch admin logs', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// Admin: fetch resident by barangayID
// GET /admin/resident/:barangayID
router.get('/resident/:barangayID', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const barangayID = req.params.barangayID;
        if (!barangayID)
            return res.status(400).json({ message: 'barangayID required' });
        const resident = await Resident_1.Resident.findOne({ barangayID });
        let user = null;
        if (resident && resident.userId) {
            const u = await User_1.User.findById(resident.userId).select('-password');
            if (u)
                user = u;
        }
        else {
            const u = await User_1.User.findOne({ barangayID }).select('-password');
            if (u)
                user = u;
        }
        return res.json({ resident: resident || null, user: user || null });
    }
    catch (err) {
        console.error('Admin resident lookup failed', err);
        return res.status(500).json({ message: 'Lookup failed', error: err && err.message ? err.message : err });
    }
});
// Admin: upload avatar for any resident (stores in GridFS 'avatars' bucket)
router.post('/resident/:id/avatar', authMiddleware_1.isAdmin, avatarUpload.single('avatar'), async (req, res) => {
    const residentId = req.params.id;
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!adminAvatarsBucket) {
        return res.status(500).json({ error: 'GridFS not initialized' });
    }
    try {
        const resident = await Resident_1.Resident.findById(residentId);
        if (!resident)
            return res.status(404).json({ error: 'Resident not found' });
        // process image using sharp to a reasonable size/format
        const processedBuffer = await (0, sharp_1.default)(req.file.path).resize(512, 512, { fit: 'cover' }).png().toBuffer();
        // upload to GridFS
        const uploadStream = adminAvatarsBucket.openUploadStream(req.file.filename + '-' + Date.now() + '.png', {
            contentType: 'image/png',
        });
        uploadStream.end(processedBuffer);
        uploadStream.on('finish', async (file) => {
            // store file id on resident and mirror to linked user if any
            const fileId = file._id;
            resident.profileImage = `/api/resident/personal-info/avatar/${fileId}`;
            resident.profileImageId = fileId.toString();
            await resident.save();
            // update linked user if exists
            if (resident.userId) {
                const user = await User_1.User.findById(resident.userId);
                if (user) {
                    user.profileImage = resident.profileImage;
                    user.profileImageId = resident.profileImageId;
                    await user.save();
                }
            }
            // remove temp file
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (e) {
                // ignore
            }
            res.json({ resident, fileId });
        });
        uploadStream.on('error', (err) => {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (e) { }
            console.error('GridFS upload error', err);
            res.status(500).json({ error: 'Upload failed' });
        });
    }
    catch (err) {
        console.error(err);
        try {
            fs_1.default.unlinkSync(req.file.path);
        }
        catch (e) { }
        res.status(500).json({ error: 'Server error' });
    }
});
// GET /admin/users/:id/with-resident - return user and resident info (admin only)
router.get('/users/:id/with-resident', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User_1.User.findById(userId).select('-password');
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        // Try to find resident by userId first, then fallback to barangayID
        let resident = await Resident_1.Resident.findOne({ userId: user._id });
        if (!resident && user.barangayID) {
            resident = await Resident_1.Resident.findOne({ barangayID: user.barangayID });
        }
        return res.json({ user, resident: resident || null });
    }
    catch (err) {
        console.error('Failed to fetch user with resident info', err);
        return res.status(500).json({ message: 'Failed to fetch user/resident', error: err && err.message ? err.message : err });
    }
});
// PATCH /admin/users/:id/disable - disable a user and optionally set suspendedUntil
router.patch('/users/:id/disable', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { suspendedUntil } = req.body;
        if (!userId)
            return res.status(400).json({ message: 'User id required' });
        const user = await User_1.User.findById(userId);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        user.isActive = false;
        if (suspendedUntil) {
            const dt = new Date(suspendedUntil);
            if (isNaN(dt.getTime()))
                return res.status(400).json({ message: 'Invalid suspendedUntil date' });
            user.suspendedUntil = dt;
        }
        await user.save();
        return res.json({ message: 'User disabled', user: user.userInfo });
    }
    catch (err) {
        console.error('Failed to disable user', err);
        return res.status(500).json({ message: 'Failed to disable user', error: err && err.message ? err.message : err });
    }
});
// PATCH /admin/users/:id/enable - enable a user and clear suspension
router.patch('/users/:id/enable', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        if (!userId)
            return res.status(400).json({ message: 'User id required' });
        const user = await User_1.User.findById(userId);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        user.isActive = true;
        user.suspendedUntil = null;
        await user.save();
        return res.json({ message: 'User enabled', user: user.userInfo });
    }
    catch (err) {
        console.error('Failed to enable user', err);
        return res.status(500).json({ message: 'Failed to enable user', error: err && err.message ? err.message : err });
    }
});
// PUT /admin/users/:id - update allowed user fields (admin only)
router.put('/users/:id', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        if (!userId)
            return res.status(400).json({ message: 'User id required' });
        const user = await User_1.User.findById(userId);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        // whitelist of editable fields via this admin endpoint
        const allowed = ['role', 'email', 'barangayID', 'isActive', 'fullName'];
        // Prevent demoting an existing admin via this generic endpoint unless explicitly allowed
        if (user.role === User_1.UserRole.ADMIN && req.body.role && req.body.role !== User_1.UserRole.ADMIN) {
            return res.status(403).json({ message: 'Cannot change role of an admin via this endpoint' });
        }
        for (const key of Object.keys(req.body)) {
            if (allowed.includes(key)) {
                // @ts-ignore
                user[key] = req.body[key];
            }
        }
        await user.save();
        return res.json({ message: 'User updated', user: user.userInfo });
    }
    catch (err) {
        console.error('Failed to update user', err);
        return res.status(500).json({ message: 'Failed to update user', error: err && err.message ? err.message : err });
    }
});
// GET /admin/resident/id/:id - fetch resident by Mongo _id
router.get('/resident/id/:id', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        if (!id)
            return res.status(400).json({ message: 'Resident id required' });
        const resident = await Resident_1.Resident.findById(id);
        if (!resident)
            return res.status(404).json({ message: 'Resident not found' });
        return res.json({ resident });
    }
    catch (err) {
        console.error('Failed to fetch resident by id', err);
        return res.status(500).json({ message: 'Failed to fetch resident', error: err && err.message ? err.message : err });
    }
});
// PUT /admin/resident/:id - update resident (admin only)
router.put('/resident/:id', authMiddleware_1.isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        if (!id)
            return res.status(400).json({ message: 'Resident id required' });
        const resident = await Resident_1.Resident.findById(id);
        if (!resident)
            return res.status(404).json({ message: 'Resident not found' });
        // Merge allowed fields from body into resident
        const allowed = [
            'firstName', 'middleName', 'lastName', 'username', 'barangayID', 'birthDate', 'placeOfBirth', 'nationality', 'religion', 'maritalStatus', 'passportNumber', 'governmentIdNumber', 'bloodType', 'disabilityStatus', 'occupation', 'educationalAttainment', 'sex', 'civilStatus', 'dateOfResidency', 'address', 'facebook', 'email', 'contactNumber', 'emergencyContact', 'landlineNumber', 'spouseName', 'spouseMiddleName', 'spouseLastName', 'spouseAge', 'spouseBirthDate', 'spouseNationality', 'spouseOccupation', 'spouseStatus', 'spouseContactNumber', 'numberOfChildren', 'childrenNames', 'childrenAges', 'motherName', 'motherAge', 'motherBirthDate', 'motherOccupation', 'motherStatus', 'fatherName', 'fatherAge', 'fatherBirthDate', 'fatherOccupation', 'fatherStatus', 'emergencyContactName', 'emergencyContactRelationship', 'businessName', 'businessType', 'natureOfBusiness', 'businessAddress', 'dateEstablished', 'tin', 'registrationNumber', 'businessPermitNumber', 'barangayClearanceNumber', 'numberOfEmployees', 'capitalInvestment', 'annualGrossIncome', 'businessContactPerson', 'businessContactNumber', 'businessEmail', 'profileImage', 'profileImageId'
        ];
        for (const key of Object.keys(req.body)) {
            if (allowed.includes(key)) {
                // @ts-ignore
                resident[key] = req.body[key];
            }
        }
        await resident.save();
        return res.json({ message: 'Resident updated', resident });
    }
    catch (err) {
        console.error('Failed to update resident', err);
        return res.status(500).json({ message: 'Failed to update resident', error: err && err.message ? err.message : err });
    }
});
// PUT /admin/announcements/:id - update announcement (admin only)
router.put('/announcements/:id', authMiddleware_1.isAdmin, upload.single('image'), async (req, res) => {
    try {
        const ann = await Announcement_1.Announcement.findById(req.params.id);
        if (!ann)
            return res.status(404).json({ message: 'Announcement not found' });
        const { text } = req.body;
        if (text && text.trim() !== '')
            ann.text = text.trim();
        // If new file uploaded, save to disk (already by multer) and to DB buffer, and remove old disk file
        if (req.file && req.file.path) {
            const newPath = path_1.default.join('uploads', 'announcements', path_1.default.basename(req.file.path));
            // remove old disk file if exists
            if (ann.imagePath) {
                try {
                    const oldPath = path_1.default.join(process.cwd(), ann.imagePath);
                    if (fs_1.default.existsSync(oldPath))
                        fs_1.default.unlinkSync(oldPath);
                }
                catch (e) {
                    console.warn('Failed to remove old image file', e);
                }
            }
            ann.imagePath = newPath;
            try {
                const buffer = fs_1.default.readFileSync(req.file.path);
                ann.imageData = buffer;
                ann.imageContentType = req.file.mimetype || ann.imageContentType;
            }
            catch (e) {
                console.warn('Failed to read new file into buffer', e);
            }
        }
        await ann.save();
        res.json({ message: 'Announcement updated', announcement: ann });
    }
    catch (err) {
        console.error('Failed to update announcement', err);
        res.status(500).json({ message: 'Failed to update announcement', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
exports.default = router;
