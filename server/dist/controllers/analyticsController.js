"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIncomeBrackets = exports.getBusinessSizeDistribution = exports.getBusinessTypeDistribution = exports.getChildrenCountDistribution = exports.getDisabilityDistribution = exports.getBloodTypeDistribution = exports.getNationalityDistribution = exports.getOccupationDistribution = exports.getAgeBuckets = exports.getFieldDistribution = exports.getGenderDistribution = exports.getMonthlyAnalytics = exports.getRequestAnalytics = void 0;
const DocumentRequest_1 = require("../models/DocumentRequest");
const Inquiry_1 = require("../models/Inquiry");
const Resident_1 = require("../models/Resident");
const getRequestAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = {};
        // Add date range to query if provided
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        // Get total requests count
        const totalRequests = await DocumentRequest_1.DocumentRequest.countDocuments(query);
        // Get requests by status
        const requestsByStatus = await DocumentRequest_1.DocumentRequest.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        // Get daily request trend
        const dailyTrend = await DocumentRequest_1.DocumentRequest.aggregate([
            { $match: query },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]);
        // Get requests by document type
        const requestsByType = await DocumentRequest_1.DocumentRequest.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$documentType',
                    count: { $sum: 1 }
                }
            }
        ]);
        // Get average processing time
        const avgProcessingTime = await DocumentRequest_1.DocumentRequest.aggregate([
            { $match: { ...query, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    averageTime: {
                        $avg: {
                            $subtract: ['$completedAt', '$createdAt']
                        }
                    }
                }
            }
        ]);
        res.json({
            totalRequests,
            requestsByStatus,
            dailyTrend,
            requestsByType,
            averageProcessingTime: avgProcessingTime[0]?.averageTime || 0
        });
    }
    catch (error) {
        console.error('Error fetching request analytics:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getRequestAnalytics = getRequestAnalytics;
const getMonthlyAnalytics = async (req, res, next) => {
    try {
        const currentYear = new Date().getFullYear();
        // Monthly Document Requests
        const documentRequests = await DocumentRequest_1.DocumentRequest.aggregate([
            { $match: { dateRequested: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) } } },
            { $group: {
                    _id: { month: { $month: "$dateRequested" } },
                    count: { $sum: 1 }
                } },
            { $sort: { "_id.month": 1 } }
        ]);
        // Monthly Inquiries
        const inquiries = await Inquiry_1.Inquiry.aggregate([
            { $match: { createdAt: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) } } },
            { $group: {
                    _id: { month: { $month: "$createdAt" } },
                    count: { $sum: 1 }
                } },
            { $sort: { "_id.month": 1 } }
        ]);
        // Monthly Active Residents
        const residents = await Resident_1.Resident.aggregate([
            { $match: { createdAt: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) } } },
            { $group: {
                    _id: { month: { $month: "$createdAt" } },
                    count: { $sum: 1 }
                } },
            { $sort: { "_id.month": 1 } }
        ]);
        res.json({
            documentRequests,
            inquiries,
            residents
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching analytics', error });
    }
};
exports.getMonthlyAnalytics = getMonthlyAnalytics;
const getGenderDistribution = async (req, res) => {
    try {
        // Aggregate residents by normalized sex value (scan Resident.sex)
        // We'll normalize values (trim + lowercase) and map common prefixes to Male/Female.
        // Anything else will count toward 'Other' and empty/null will be 'Unknown'.
        const groups = await Resident_1.Resident.aggregate([
            { $project: { sexNorm: { $toLower: { $trim: { input: { $ifNull: ['$sex', ''] } } } } } },
            { $group: { _id: '$sexNorm', count: { $sum: 1 } } }
        ]);
        let maleCount = 0;
        let femaleCount = 0;
        let otherCount = 0;
        let unknownCount = 0;
        for (const g of groups) {
            const raw = (g._id || '').toString();
            const cnt = Number(g.count) || 0;
            if (!raw) {
                unknownCount += cnt;
            }
            else if (raw.startsWith('m')) {
                maleCount += cnt;
            }
            else if (raw.startsWith('f')) {
                femaleCount += cnt;
            }
            else {
                otherCount += cnt;
            }
        }
        const totalResidents = maleCount + femaleCount + otherCount + unknownCount;
        const data = [];
        if (maleCount > 0)
            data.push({ name: 'Male', value: maleCount });
        if (femaleCount > 0)
            data.push({ name: 'Female', value: femaleCount });
        if (otherCount > 0)
            data.push({ name: 'Other', value: otherCount });
        if (unknownCount > 0)
            data.push({ name: 'Unknown', value: unknownCount });
        res.json({ sex: { male: maleCount, female: femaleCount, other: otherCount, unknown: unknownCount }, totalResidents, data });
    }
    catch (error) {
        console.error('Error fetching gender distribution:', error);
        res.status(500).json({ message: 'Error fetching sex distribution', error });
    }
};
exports.getGenderDistribution = getGenderDistribution;
// Generic field distribution endpoint: aggregates any string field values (trimmed/lowercased) and returns counts
const getFieldDistribution = async (req, res) => {
    try {
        const field = (req.query.field || '').toString().trim();
        if (!field)
            return res.status(400).json({ message: 'Missing field parameter' });
        // Build aggregation: project a normalized value for the requested field, then group
        const projectStage = {};
        // Convert field to string first (handles numeric fields like age), then trim and lowercase
        // Use $ifNull to ensure an empty string for missing values, then $toString to safely stringify
        projectStage[field + 'Norm'] = {
            $toLower: {
                $trim: {
                    input: { $toString: { $ifNull: [`$${field}`, ''] } }
                }
            }
        };
        const groups = await Resident_1.Resident.aggregate([
            { $match: { [field]: { $exists: true, $ne: null } } },
            { $project: projectStage },
            { $group: { _id: `$${field}Norm`, count: { $sum: 1 } } }
        ]);
        // Map groups into name/value pairs, exclude empty/invalid names
        const data = [];
        let total = 0;
        for (const g of groups) {
            const raw = (g._id || '').toString().trim();
            if (!raw)
                continue; // skip empty/null
            // For display, capitalize first letter (guard empty)
            const name = raw ? (raw.charAt(0).toUpperCase() + raw.slice(1)) : raw;
            const value = Number(g.count) || 0;
            if (value > 0) {
                data.push({ name, value });
                total += value;
            }
        }
        res.json({ field, totalResidents: total, data });
    }
    catch (error) {
        console.error('Error fetching field distribution:', error);
        res.status(500).json({ message: 'Error fetching field distribution', error });
    }
};
exports.getFieldDistribution = getFieldDistribution;
// Pre-bucket ages into ranges for charting: 0-18, 19-35, 36-60, 60+
const getAgeBuckets = async (req, res) => {
    try {
        // We'll group by numeric age when possible. Use $ifNull/$toInt to coerce numeric-like strings
        const groups = await Resident_1.Resident.aggregate([
            { $match: { age: { $exists: true, $ne: null } } },
            { $project: { ageNum: { $toInt: { $toString: { $ifNull: ['$age', '0'] } } } } },
            { $group: { _id: '$ageNum', count: { $sum: 1 } } }
        ]);
        // Now bucket into ranges
        const buckets = { '0-18': 0, '19-35': 0, '36-60': 0, '60+': 0 };
        for (const g of groups) {
            const age = Number(g._id) || 0;
            const cnt = Number(g.count) || 0;
            if (age <= 18)
                buckets['0-18'] += cnt;
            else if (age <= 35)
                buckets['19-35'] += cnt;
            else if (age <= 60)
                buckets['36-60'] += cnt;
            else
                buckets['60+'] += cnt;
        }
        const ageBucketsArray = [
            { group: '0-18', value: buckets['0-18'] },
            { group: '19-35', value: buckets['19-35'] },
            { group: '36-60', value: buckets['36-60'] },
            { group: '60+', value: buckets['60+'] }
        ];
        res.json({ totalResidents: ageBucketsArray.reduce((s, b) => s + b.value, 0), data: ageBucketsArray });
    }
    catch (error) {
        console.error('Error fetching age buckets:', error);
        res.status(500).json({ message: 'Error fetching age buckets', error });
    }
};
exports.getAgeBuckets = getAgeBuckets;
// Helper to aggregate a string field into name/value data array
const aggregateStringField = async (field) => {
    const groups = await Resident_1.Resident.aggregate([
        { $match: { [field]: { $exists: true, $ne: null } } },
        { $project: { val: { $toLower: { $trim: { input: { $toString: { $ifNull: [`$${field}`, ''] } } } } } } },
        { $group: { _id: '$val', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
    const data = [];
    let total = 0;
    for (const g of groups) {
        const raw = (g._id || '').toString().trim();
        if (!raw)
            continue;
        const name = raw.charAt(0).toUpperCase() + raw.slice(1);
        const value = Number(g.count) || 0;
        if (value > 0) {
            data.push({ name, value });
            total += value;
        }
    }
    return { data, totalResidents: total };
};
const getOccupationDistribution = async (req, res) => {
    try {
        const result = await aggregateStringField('occupation');
        res.json({ field: 'occupation', ...result });
    }
    catch (error) {
        console.error('Error fetching occupation distribution:', error);
        res.status(500).json({ message: 'Error fetching occupation distribution', error });
    }
};
exports.getOccupationDistribution = getOccupationDistribution;
const getNationalityDistribution = async (req, res) => {
    try {
        const result = await aggregateStringField('nationality');
        res.json({ field: 'nationality', ...result });
    }
    catch (error) {
        console.error('Error fetching nationality distribution:', error);
        res.status(500).json({ message: 'Error fetching nationality distribution', error });
    }
};
exports.getNationalityDistribution = getNationalityDistribution;
const getBloodTypeDistribution = async (req, res) => {
    try {
        const result = await aggregateStringField('bloodType');
        res.json({ field: 'bloodType', ...result });
    }
    catch (error) {
        console.error('Error fetching blood type distribution:', error);
        res.status(500).json({ message: 'Error fetching blood type distribution', error });
    }
};
exports.getBloodTypeDistribution = getBloodTypeDistribution;
const getDisabilityDistribution = async (req, res) => {
    try {
        const result = await aggregateStringField('disabilityStatus');
        res.json({ field: 'disabilityStatus', ...result });
    }
    catch (error) {
        console.error('Error fetching disability distribution:', error);
        res.status(500).json({ message: 'Error fetching disability distribution', error });
    }
};
exports.getDisabilityDistribution = getDisabilityDistribution;
const getChildrenCountDistribution = async (req, res) => {
    try {
        const groups = await Resident_1.Resident.aggregate([
            { $project: { numChildren: { $toInt: { $toString: { $ifNull: ['$numberOfChildren', '0'] } } } } },
            { $group: { _id: '$numChildren', count: { $sum: 1 } } },
            { $sort: { '_id': 1 } }
        ]);
        const buckets = {};
        for (const g of groups) {
            const n = Number(g._id) || 0;
            const cnt = Number(g.count) || 0;
            const key = n >= 6 ? '6+' : `${n}`;
            buckets[key] = (buckets[key] || 0) + cnt;
        }
        const data = Object.keys(buckets).sort((a, b) => {
            const na = a === '6+' ? 99 : Number(a);
            const nb = b === '6+' ? 99 : Number(b);
            return na - nb;
        }).map(k => ({ name: k, value: buckets[k] }));
        const total = data.reduce((s, d) => s + (d.value || 0), 0);
        res.json({ field: 'numberOfChildren', totalResidents: total, data });
    }
    catch (error) {
        console.error('Error fetching children count distribution:', error);
        res.status(500).json({ message: 'Error fetching children count distribution', error });
    }
};
exports.getChildrenCountDistribution = getChildrenCountDistribution;
const getBusinessTypeDistribution = async (req, res) => {
    try {
        const result = await aggregateStringField('businessType');
        res.json({ field: 'businessType', ...result });
    }
    catch (error) {
        console.error('Error fetching business type distribution:', error);
        res.status(500).json({ message: 'Error fetching business type distribution', error });
    }
};
exports.getBusinessTypeDistribution = getBusinessTypeDistribution;
const getBusinessSizeDistribution = async (req, res) => {
    try {
        const groups = await Resident_1.Resident.aggregate([
            { $project: { employees: { $toInt: { $toString: { $ifNull: ['$numberOfEmployees', '0'] } } } } },
            { $group: { _id: '$employees', count: { $sum: 1 } } }
        ]);
        const buckets = { '0': 0, '1-5': 0, '6-20': 0, '21-100': 0, '100+': 0 };
        for (const g of groups) {
            const n = Number(g._id) || 0;
            const cnt = Number(g.count) || 0;
            if (n === 0)
                buckets['0'] += cnt;
            else if (n <= 5)
                buckets['1-5'] += cnt;
            else if (n <= 20)
                buckets['6-20'] += cnt;
            else if (n <= 100)
                buckets['21-100'] += cnt;
            else
                buckets['100+'] += cnt;
        }
        const data = Object.keys(buckets).map(k => ({ name: k, value: buckets[k] }));
        const total = data.reduce((s, d) => s + (d.value || 0), 0);
        res.json({ field: 'numberOfEmployees', totalResidents: total, data });
    }
    catch (error) {
        console.error('Error fetching business size distribution:', error);
        res.status(500).json({ message: 'Error fetching business size distribution', error });
    }
};
exports.getBusinessSizeDistribution = getBusinessSizeDistribution;
const getIncomeBrackets = async (req, res) => {
    try {
        const groups = await Resident_1.Resident.aggregate([
            { $project: { income: { $toInt: { $toString: { $ifNull: ['$annualGrossIncome', '0'] } } } } },
            { $group: { _id: '$income', count: { $sum: 1 } } }
        ]);
        // Define brackets
        const buckets = { '<10k': 0, '10k-50k': 0, '50k-100k': 0, '100k-500k': 0, '500k+': 0 };
        for (const g of groups) {
            const n = Number(g._id) || 0;
            const cnt = Number(g.count) || 0;
            if (n < 10000)
                buckets['<10k'] += cnt;
            else if (n < 50000)
                buckets['10k-50k'] += cnt;
            else if (n < 100000)
                buckets['50k-100k'] += cnt;
            else if (n < 500000)
                buckets['100k-500k'] += cnt;
            else
                buckets['500k+'] += cnt;
        }
        const data = Object.keys(buckets).map(k => ({ name: k, value: buckets[k] }));
        const total = data.reduce((s, d) => s + (d.value || 0), 0);
        res.json({ field: 'annualGrossIncome', totalResidents: total, data });
    }
    catch (error) {
        console.error('Error fetching income brackets:', error);
        res.status(500).json({ message: 'Error fetching income brackets', error });
    }
};
exports.getIncomeBrackets = getIncomeBrackets;
