"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const Resident_1 = require("../models/Resident");
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion';
async function backfillResidents() {
    await mongoose_1.default.connect(MONGO_URI);
    const users = await User_1.User.find({ role: 'resident' });
    let created = 0;
    for (const user of users) {
        // Check if a Resident document exists for this user (by barangayID or email)
        const exists = await Resident_1.Resident.findOne({
            $or: [
                { barangayID: user.barangayID },
                { email: user.email }
            ]
        });
        if (!exists) {
            await Resident_1.Resident.create({
                firstName: user.fullName?.split(' ')[0] || '',
                lastName: user.fullName?.split(' ').slice(-1)[0] || '',
                barangayID: user.barangayID,
                email: user.email,
                contactNumber: user.contactNumber,
                address: user.address,
            });
            created++;
        }
    }
    console.log(`Backfill complete. Created ${created} Resident containers.`);
    await mongoose_1.default.disconnect();
}
backfillResidents().catch(err => {
    console.error('Backfill error:', err);
    process.exit(1);
});
