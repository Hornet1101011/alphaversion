"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Resident_1 = require("../models/Resident");
const User_1 = require("../models/User");
const DocumentRequest_1 = require("../models/DocumentRequest");
const Request_1 = require("../models/Request");
const auth_1 = require("../middleware/auth");
const Notification_1 = require("../models/Notification");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const sharp_1 = __importDefault(require("sharp"));
const router = (0, express_1.Router)();
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'residents');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Multer setup
const storage = multer_1.default.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (_req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${unique}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req, file, cb) => {
        // Accept images only
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});
// GridFSBucket for avatars (initialized when mongoose connection opens)
let avatarsBucket = null;
mongoose_1.default.connection.on('open', () => {
    // @ts-ignore
    const db = mongoose_1.default.connection.db;
    try {
        avatarsBucket = new mongodb_1.GridFSBucket(db, { bucketName: 'avatars' });
        console.log('Avatars GridFSBucket initialized');
    }
    catch (err) {
        console.error('Failed to initialize avatars GridFSBucket', err);
    }
});
// Log all incoming requests for debugging
router.use((req, res, next) => {
    console.log(`[Residents API] ${req.method} ${req.originalUrl}`);
    next();
});
// Get personal info for current resident
// Only retrieve resident info; do not auto-create
router.get('/personal-info', auth_1.auth, async (req, res) => {
    try {
        const { barangayID, username } = req.user;
        const user = await User_1.User.findOne({ barangayID, username });
        if (!user) {
            console.error('User not found for barangayID:', barangayID, 'username:', username);
            return res.status(404).json({ message: 'User not found', barangayID, username });
        }
        let resident = await Resident_1.Resident.findOne({ userId: user._id });
        console.log('Resident fetch query:', { userId: user._id });
        console.log('Resident fetch result:', resident);
        if (!resident) {
            // Auto-create resident record if missing. Ensure required name fields are populated
            const parts = user.fullName && typeof user.fullName === 'string'
                ? user.fullName.trim().split(/\s+/)
                : [];
            const first = parts.length > 0 ? parts[0] : (user.username || 'N/A');
            const last = parts.length > 1 ? parts.slice(1).join(' ') : 'N/A';
            resident = new Resident_1.Resident({
                userId: user._id,
                barangayID: user.barangayID,
                username: user.username,
                firstName: first,
                lastName: last,
                email: user.email || '',
                contactNumber: user.contactNumber || '',
                address: user.address || '',
            });
            await resident.save();
            console.log('Auto-created resident record for user:', user.username);
        }
        res.json(resident);
    }
    catch (error) {
        console.error('Error fetching resident info:', {
            error,
            user: req.user,
            requestBody: req.body
        });
        const err = error;
        res.status(500).json({ message: 'Failed to fetch resident info', error: err.message, stack: err.stack });
    }
});
// Update personal info for current resident
// Create resident container only when user edits personal info
router.put('/personal-info', auth_1.auth, async (req, res) => {
    const { barangayID, username } = req.user;
    const user = await User_1.User.findOne({ barangayID, username });
    if (!user) {
        console.log('User not found for barangayID:', barangayID, 'username:', username);
        return res.status(404).json({ message: 'User not found' });
    }
    let resident = await Resident_1.Resident.findOne({ userId: user._id });
    try {
        // Only allow expected fields to be updated/created
        const allowedFields = [
            'firstName', 'lastName', 'barangayID', 'email', 'contactNumber', 'address', 'department'
        ];
        const residentData = { userId: user._id };
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                residentData[field] = req.body[field];
            }
        }
        if (!resident) {
            if (!user._id) {
                return res.status(400).json({ message: 'userId is required' });
            }
            resident = new Resident_1.Resident(residentData);
            await resident.save();
            console.log('Created new resident container for user:', user.email);
        }
        else {
            Object.assign(resident, residentData);
            await resident.save();
        }
        res.json(resident);
    }
    catch (error) {
        console.error('Resident save error:', error);
        if (error.name === 'ValidationError') {
            const errors = {};
            for (const key in error.errors) {
                errors[key] = error.errors[key].message;
            }
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        return res.status(500).json({
            message: 'Failed to save resident info',
            error: error.message,
            stack: error.stack // Add stack trace for debugging
        });
    }
});
// Upload or change profile avatar for current resident
router.post('/personal-info/avatar', auth_1.auth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: 'No file uploaded' });
        const user = await User_1.User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        // Find existing resident container. Prefer resident found by userId, otherwise fall back to barangayID only.
        let resident = await Resident_1.Resident.findOne({ userId: user._id });
        if (!resident && user.barangayID) {
            resident = await Resident_1.Resident.findOne({ barangayID: user.barangayID });
        }
        if (!resident) {
            console.warn(`[Residents API] Resident container not found for barangayID=${user.barangayID}`);
            return res.status(404).json({ message: 'Resident container not found. Please create or update your personal info first.' });
        }
        // Ensure required name fields exist on the found resident to avoid validation errors when saving
        if ((!resident.firstName || resident.firstName === '') || (!resident.lastName || resident.lastName === '')) {
            if (user.fullName && typeof user.fullName === 'string') {
                const parts = user.fullName.trim().split(' ');
                if (!resident.firstName || resident.firstName === '')
                    resident.firstName = parts[0] || resident.firstName || 'N/A';
                if (!resident.lastName || resident.lastName === '')
                    resident.lastName = parts.length > 1 ? parts.slice(1).join(' ') : resident.lastName || 'N/A';
            }
            else {
                if (!resident.firstName || resident.firstName === '')
                    resident.firstName = resident.username || resident.email || 'N/A';
                if (!resident.lastName || resident.lastName === '')
                    resident.lastName = resident.lastName || 'N/A';
            }
        }
        // Process image with sharp: resize to max 800x800, convert to jpeg, quality 80
        const inputPath = req.file.path;
        const processedBuffer = await (0, sharp_1.default)(inputPath)
            .resize({ width: 800, height: 800, fit: 'inside' })
            .rotate()
            .jpeg({ quality: 80 })
            .toBuffer();
        // delete temporary uploaded file
        fs_1.default.unlink(inputPath, () => { });
        // Upload processed buffer to GridFS only (no disk copy). Store the GridFS id and expose a stream URL.
        let gridFsId;
        const filename = `avatar_${Date.now()}.jpg`;
        if (avatarsBucket) {
            try {
                const uploadStream = avatarsBucket.openUploadStream(filename, {
                    contentType: 'image/jpeg',
                    metadata: { userId: user._id }
                });
                await new Promise((resolve, reject) => {
                    uploadStream.on('finish', () => resolve());
                    uploadStream.on('error', (err) => reject(err));
                    uploadStream.end(processedBuffer);
                });
                gridFsId = uploadStream.id;
            }
            catch (err) {
                console.warn('Failed to write avatar to GridFS:', err);
            }
        }
        else {
            console.warn('GridFS avatarsBucket not initialized; cannot save avatar to GridFS');
        }
        // If resident had a previous avatar stored in GridFS, attempt cleanup (best-effort)
        if (resident.profileImageId && avatarsBucket) {
            try {
                const prevId = new mongodb_1.ObjectId(resident.profileImageId);
                await avatarsBucket.delete(prevId);
            }
            catch (err) {
                console.warn('Failed to delete previous avatar from GridFS (continuing):', err);
            }
        }
        // If resident had a previous file in uploads/residents/<id>/, attempt to delete it (best-effort)
        try {
            if (resident.profileImage && resident.profileImage.startsWith('/uploads/residents/')) {
                const prevRel = resident.profileImage.replace(/^\//, '');
                const prevAbs = path_1.default.join(process.cwd(), prevRel);
                if (fs_1.default.existsSync(prevAbs)) {
                    fs_1.default.unlink(prevAbs, () => { });
                }
            }
        }
        catch (err) {
            console.warn('Failed to delete previous resident avatar file (continuing):', err);
        }
        // Save resident with GridFS-based URL and id
        if (gridFsId) {
            resident.profileImageId = gridFsId.toString();
            resident.profileImage = `/api/resident/personal-info/avatar/${resident.profileImageId}`;
        }
        else {
            // fallback: no gridfs -> clear image fields
            resident.profileImageId = resident.profileImageId || undefined;
            resident.profileImage = resident.profileImage || undefined;
        }
        await resident.save();
        // Also update the user's profileImage so both records point to the same avatar
        try {
            if (user) {
                user.profileImage = resident.profileImage;
                user.profileImageId = resident.profileImageId || undefined;
                await user.save();
            }
        }
        catch (err) {
            console.warn('Failed to update user.profileImage (continuing):', err);
        }
        res.json({ message: 'Profile image uploaded', resident, user });
    }
    catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ message: 'Failed to upload avatar', error });
    }
});
// Get current resident profile
router.get('/profile', auth_1.auth, async (req, res) => {
    try {
        const { barangayID, username } = req.user;
        const user = await User_1.User.findOne({ barangayID, username });
        if (!user) {
            console.error('Resident not found:', { barangayID, username });
            return res.status(404).json({ message: 'Resident not found', barangayID, username });
        }
        // Split fullName if available
        let firstName = '';
        let lastName = '';
        if (user.fullName && typeof user.fullName === 'string') {
            const parts = user.fullName.trim().split(' ');
            firstName = parts[0] || '';
            lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
        }
        // Try to include resident record (for profile image and extra details)
        const resident = await Resident_1.Resident.findOne({ userId: user._id });
        const profileImage = resident && resident.profileImage ? resident.profileImage : undefined;
        const profileImageId = resident && resident.profileImageId ? resident.profileImageId : undefined;
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            address: user.address,
            contactNumber: user.contactNumber,
            barangayID: user.barangayID,
            role: user.role,
            isActive: user.isActive,
            firstName,
            lastName,
            department: user.department || '',
            profileImage,
            profileImageId,
            // Do NOT include password
        });
    }
    catch (error) {
        console.error('Error fetching resident profile:', {
            error,
            user: req.user,
            requestBody: req.body
        });
        const err = error;
        res.status(500).json({ message: 'Failed to fetch resident profile', error: err.message, stack: err.stack });
    }
});
// Stream avatar by GridFS id
router.get('/personal-info/avatar/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!avatarsBucket)
            return res.status(503).json({ message: 'Avatar service not available' });
        let _id;
        try {
            _id = new mongodb_1.ObjectId(id);
        }
        catch (err) {
            return res.status(400).json({ message: 'Invalid avatar id' });
        }
        const downloadStream = avatarsBucket.openDownloadStream(_id);
        downloadStream.on('error', err => {
            console.error('GridFS download error:', err);
            res.status(404).end();
        });
        res.setHeader('Content-Type', 'image/jpeg');
        downloadStream.pipe(res);
    }
    catch (err) {
        console.error('Avatar stream error:', err);
        res.status(500).json({ message: 'Failed to stream avatar', error: String(err) });
    }
});
// Get current resident's document requests
router.get('/requests', auth_1.auth, async (req, res) => {
    const user = await User_1.User.findById(req.user._id);
    if (!user)
        return res.status(404).json({ message: 'Resident not found' });
    const requests = await DocumentRequest_1.DocumentRequest.find({ username: user.username, barangayID: user.barangayID });
    res.json(requests);
});
// Create a new resident (register)
router.post('/', auth_1.auth, async (req, res) => {
    try {
        // Dynamically get schema fields to populate defaults
        const schemaFields = Object.keys(Resident_1.Resident.schema.paths).filter(f => f !== '__v' && f !== '_id');
        const user = await User_1.User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        // Build incoming data object but prefer values from the logged-in user for identity fields
        const incoming = {};
        incoming.barangayID = user?.barangayID || req.body.barangayID || 'N/A';
        incoming.email = user?.email || req.body.email || 'noemail@na.local';
        incoming.username = user?.username || req.body.username || 'N/A';
        incoming.userId = user._id;
        // Fill other schema fields from request body or sensible defaults
        for (const field of schemaFields) {
            if (['barangayID', 'email', 'username', 'userId'].includes(field))
                continue;
            const schemaType = Resident_1.Resident.schema.paths[field].instance;
            if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
                incoming[field] = req.body[field];
            }
            else if (schemaType === 'String') {
                incoming[field] = 'N/A';
            }
            else if (schemaType === 'Number') {
                incoming[field] = null;
            }
            else {
                incoming[field] = null;
            }
        }
        // Try to find an existing resident to avoid duplicates. Prefer userId match, then barangayID, then email/username.
        const existing = await Resident_1.Resident.findOne({
            $or: [
                { userId: user._id },
                { barangayID: incoming.barangayID },
                { email: incoming.email },
                { username: incoming.username }
            ]
        });
        if (existing) {
            // Merge only missing/empty fields from incoming into existing; do not overwrite existing non-empty data unless explicitly provided
            let changed = false;
            for (const key of Object.keys(incoming)) {
                if (key === 'userId') {
                    // ensure userId is linked
                    if (!existing.userId) {
                        existing.userId = incoming.userId;
                        changed = true;
                    }
                    continue;
                }
                const incomingVal = incoming[key];
                const existingVal = existing[key];
                // If incoming has a non-default meaningful value and existing is empty/null/N/A, apply it
                const isExistingEmpty = existingVal === undefined || existingVal === null || existingVal === '' || existingVal === 'N/A';
                const isIncomingMeaningful = incomingVal !== undefined && incomingVal !== null && incomingVal !== '' && incomingVal !== 'N/A';
                if (isIncomingMeaningful && isExistingEmpty) {
                    existing[key] = incomingVal;
                    changed = true;
                }
            }
            if (changed)
                await existing.save();
            // Link userId if missing on resident
            if (!existing.userId) {
                existing.userId = user._id;
                await existing.save();
            }
            // Return the existing resident to the client — avoid creating a duplicate
            return res.status(200).json(existing);
        }
        // Use an atomic upsert to create the resident if none exists; $setOnInsert ensures we only set fields on insert.
        try {
            const filter = {
                $or: [
                    { userId: user._id },
                    { barangayID: incoming.barangayID },
                    { email: incoming.email },
                    { username: incoming.username }
                ]
            };
            // Perform findOneAndUpdate with rawResult so we can know if we inserted or matched an existing doc
            const raw = await Resident_1.Resident.findOneAndUpdate(filter, { $setOnInsert: incoming }, { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true });
            // raw.value is the document returned; raw.lastErrorObject.updatedExisting === true means we matched an existing doc
            const doc = raw.value;
            const matchedExisting = raw.lastErrorObject && raw.lastErrorObject.updatedExisting === true;
            if (!doc) {
                // Shouldn't happen, but fallback to previous behavior
                const resident = new Resident_1.Resident(incoming);
                await resident.save();
                return res.status(201).json(resident);
            }
            if (!matchedExisting) {
                // We inserted a new document
                return res.status(201).json(doc);
            }
            // We matched an existing document. Merge missing/empty fields from incoming into the existing doc.
            const toSet = {};
            for (const key of Object.keys(incoming)) {
                if (key === 'userId') {
                    if (!doc.userId)
                        toSet.userId = incoming.userId;
                    continue;
                }
                const incomingVal = incoming[key];
                const existingVal = doc[key];
                const isExistingEmpty = existingVal === undefined || existingVal === null || existingVal === '' || existingVal === 'N/A';
                const isIncomingMeaningful = incomingVal !== undefined && incomingVal !== null && incomingVal !== '' && incomingVal !== 'N/A';
                if (isIncomingMeaningful && isExistingEmpty) {
                    toSet[key] = incomingVal;
                }
            }
            if (Object.keys(toSet).length > 0) {
                await Resident_1.Resident.updateOne({ _id: doc._id }, { $set: toSet });
                // re-read the updated doc
                const updated = await Resident_1.Resident.findById(doc._id);
                return res.status(200).json(updated);
            }
            return res.status(200).json(doc);
        }
        catch (saveErr) {
            // If duplicate key error occurred as a race fallback, try to return an existing doc
            if (saveErr && saveErr.code === 11000) {
                console.warn('Duplicate key on resident upsert, attempting fallback lookup', saveErr.keyValue || saveErr);
                const fallback = await Resident_1.Resident.findOne({
                    $or: [
                        { userId: incoming.userId },
                        { barangayID: incoming.barangayID },
                        { email: incoming.email },
                        { username: incoming.username }
                    ]
                });
                if (fallback)
                    return res.status(200).json(fallback);
            }
            throw saveErr;
        }
    }
    catch (error) {
        console.error('Error creating resident:', error);
        return res.status(500).json({ message: 'Failed to register resident', error });
    }
});
// Resident requests staff access: create a Request document and notify admins
router.post('/request-staff-access', auth_1.auth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        // Create a Request record representing the staff-access application
        const staffRequest = await Request_1.Request.create({
            type: 'staff_access',
            subject: `Staff access request: ${user.fullName || user.username}`,
            description: `User ${user._id} (${user.fullName || user.username}) has requested staff access.`,
            requestedBy: user._id,
            status: 'pending',
            priority: 'medium',
        });
        // Find all admins and create notifications for them (so they still see alerts)
        const admins = await User_1.User.find({ role: 'admin' });
        if (!admins || admins.length === 0) {
            console.warn('Request staff access: no admin accounts found. User:', user?.username || user?._id);
            return res.status(200).json({ message: 'Request recorded but no admin accounts were found. Please contact the system administrator.', staffRequest });
        }
        const notifications = await Promise.all(admins.map(admin => Notification_1.Notification.create({
            user: admin._id,
            type: 'staff_approval',
            message: `${user.fullName || user.username} requested staff access`,
            data: {
                requestId: staffRequest._id,
                userId: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username,
            },
            read: false,
        })));
        res.json({ message: 'Request sent to admin for staff access', staffRequest, notifications });
    }
    catch (error) {
        console.error('Staff access request error:', error);
        res.status(500).json({ message: 'Failed to create staff access request', error });
    }
});
// Get registered resident information for current user by barangayID
router.get('/my-info', auth_1.auth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Try to find resident by userId first (preferred), then fallback to barangayID
        let resident = await Resident_1.Resident.findOne({ userId: user._id });
        if (!resident && user.barangayID) {
            resident = await Resident_1.Resident.findOne({ barangayID: user.barangayID });
        }
        if (!resident) {
            return res.status(404).json({ message: 'No resident information found for this user' });
        }
        res.json(resident);
    }
    catch (error) {
        console.error('Error fetching resident info:', error);
        res.status(500).json({ message: 'Failed to fetch resident info', error });
    }
});
// Update registered resident information for current user by barangayID
router.put('/my-info', auth_1.auth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user._id);
        if (!user || !user.barangayID) {
            return res.status(404).json({ message: 'User or barangayID not found' });
        }
        const resident = await Resident_1.Resident.findOne({ barangayID: user.barangayID });
        if (!resident) {
            return res.status(404).json({ message: 'No resident information found for this barangayID' });
        }
        // Only allow updates to fields defined in the schema
        const schemaFields = Object.keys(Resident_1.Resident.schema.paths).filter(f => f !== '__v' && f !== '_id' && f !== 'barangayID');
        // Prevent changing barangayID to one that belongs to another resident
        if (req.body.barangayID && req.body.barangayID !== user.barangayID) {
            // If client attempts to change barangayID, reject to avoid accidental duplicates
            return res.status(409).json({ message: 'Changing barangayID is not allowed' });
        }
        // If updating identity fields like email or username, ensure they don't collide with other residents
        if (req.body.email && req.body.email !== resident.email) {
            const conflict = await Resident_1.Resident.findOne({ email: req.body.email });
            if (conflict && String(conflict._id) !== String(resident._id)) {
                return res.status(409).json({ message: 'Email already in use by another resident' });
            }
        }
        if (req.body.username && req.body.username !== resident.username) {
            const conflict = await Resident_1.Resident.findOne({ username: req.body.username });
            if (conflict && String(conflict._id) !== String(resident._id)) {
                return res.status(409).json({ message: 'Username already in use by another resident' });
            }
        }
        for (const field of schemaFields) {
            if (req.body[field] !== undefined) {
                resident[field] = req.body[field];
            }
        }
        await resident.save();
        res.json(resident);
    }
    catch (error) {
        console.error('Error updating resident info:', error);
        res.status(500).json({ message: 'Failed to update resident info', error });
    }
});
// Add this at the end for debugging undefined routes
router.use((req, res) => {
    res.status(404).json({ message: 'Route not found in residents API' });
});
exports.default = router;
