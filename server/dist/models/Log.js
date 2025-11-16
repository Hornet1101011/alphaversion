"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = void 0;
const mongoose_1 = require("mongoose");
const LogSchema = new mongoose_1.Schema({
    type: { type: String },
    message: { type: String },
    details: { type: String },
    actor: { type: String },
    target: { type: String },
    createdAt: { type: Date, default: Date.now }
});
exports.Log = (0, mongoose_1.model)('Log', LogSchema);
