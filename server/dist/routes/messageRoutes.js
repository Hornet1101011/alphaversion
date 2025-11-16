"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Message_1 = require("../models/Message");
const router = express_1.default.Router();
// Get all messages for the logged-in resident
router.get('/my-inbox', async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const messages = await Message_1.Message.find({ to: userId }).sort({ createdAt: -1 });
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching inbox', error });
    }
});
exports.default = router;
