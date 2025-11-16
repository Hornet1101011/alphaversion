"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLog = exports.getAllLogs = void 0;
const Log_1 = require("../models/Log");
const getAllLogs = async (req, res) => {
    const logs = await Log_1.Log.find();
    res.json(logs);
};
exports.getAllLogs = getAllLogs;
const addLog = async (req, res) => {
    const log = new Log_1.Log(req.body);
    await log.save();
    res.status(201).json(log);
};
exports.addLog = addLog;
// Add more analytics/error log logic as needed
