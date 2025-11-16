"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteResident = exports.updateResident = exports.addResident = exports.getAllResidents = void 0;
const Resident_1 = require("../models/Resident");
const Log_1 = require("../models/Log"); // Import the Log model
const getAllResidents = async (req, res) => {
    const residents = await Resident_1.Resident.find();
    res.json(residents);
};
exports.getAllResidents = getAllResidents;
const addResident = async (req, res) => {
    const resident = new Resident_1.Resident(req.body);
    await resident.save();
    res.status(201).json(resident);
};
exports.addResident = addResident;
const updateResident = async (req, res) => {
    try {
        const resident = await Resident_1.Resident.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!resident)
            return res.status(404).json({ message: 'Resident not found' });
        res.json(resident);
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(500).json({ message: errorMessage });
    }
};
exports.updateResident = updateResident;
const deleteResident = async (req, res) => {
    await Resident_1.Resident.findByIdAndDelete(req.params.id);
    // Audit log for resident deletion
    await Log_1.Log.create({
        type: 'audit',
        message: 'Resident deleted',
        details: `Resident ID: ${req.params.id}, Deleted by: ${req.user._id}`,
        actor: String(req.user._id),
        target: String(req.params.id)
    });
    res.status(204).end();
};
exports.deleteResident = deleteResident;
