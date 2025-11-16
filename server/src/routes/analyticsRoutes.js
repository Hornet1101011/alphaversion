const express = require('express');
const router = express.Router();

// Import models: prefer compiled JS in dist for plain node runtime, otherwise defer to mongoose.model
let Resident, DocumentRequest;
try {
  // try compiled dist models (relative to project structure)
  Resident = require('../../dist/models/Resident');
  DocumentRequest = require('../../dist/models/DocumentRequest');
  // if those modules export model constructor directly, they may export the model as default or named
  Resident = Resident && (Resident.Resident || Resident.default || Resident);
  DocumentRequest = DocumentRequest && (DocumentRequest.DocumentRequest || DocumentRequest.default || DocumentRequest);
} catch (e) {
  // fallback: try to get models from mongoose registry (models may be registered elsewhere)
  try {
    const mongoose = require('mongoose');
    Resident = mongoose.model('Resident');
    DocumentRequest = mongoose.model('DocumentRequest');
  } catch (err) {
    // keep undefined; routes will error at runtime if models aren't available
    Resident = undefined;
    DocumentRequest = undefined;
  }
}

// Helper to normalize empty/N/A strings to 'Unknown'
function normalizeStringField(fieldExpr) {
  // fieldExpr is a field path like '$sex'
  return {
    $let: {
      vars: { v: { $ifNull: [fieldExpr, ''] } },
      in: {
        $trim: { input: { $toLower: ['$$v'] } }
      }
    }
  };
}

// /api/analytics/summary -> totals and requests by type
router.get('/summary', async (req, res) => {
  try {
    // Total residents
    const residentsAgg = await Resident.aggregate([
      { $group: { _id: null, count: { $sum: 1 } } },
      { $project: { _id: 0, totalResidents: '$count' } }
    ]).allowDiskUse(true);

    // Total document requests and counts per type
    const docsAgg = await DocumentRequest.aggregate([
      { $group: { _id: { type: { $ifNull: ['$type', 'Unknown'] } }, count: { $sum: 1 } } },
      { $group: { _id: null, total: { $sum: '$count' }, byType: { $push: { type: '$_id.type', count: '$count' } } } },
      { $project: { _id: 0, totalDocumentRequests: '$total', requestsByType: '$byType' } }
    ]).allowDiskUse(true);

  const totalResidents = (residentsAgg[0] && residentsAgg[0].totalResidents) || 0;
  const totalDocumentRequests = (docsAgg[0] && docsAgg[0].totalDocumentRequests) || 0;
  const requestsByTypeRaw = (docsAgg[0] && docsAgg[0].requestsByType) || [];
  // normalize to { type, value }
  const requestsByType = requestsByTypeRaw.map(r => ({ type: r.type || 'Unknown', value: r.count || 0 }));

  res.json({ totalResidents, totalDocumentRequests, requestsByType });
  } catch (err) {
    console.error('Analytics /summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// /api/analytics/gender -> group residents by sex (Male/Female/Other)
router.get('/gender', async (req, res) => {
  try {
    const pipeline = [
      // normalize and map to Male/Female/Other
      { $project: { sexRaw: { $ifNull: ['$sex', 'Unknown'] } } },
      { $addFields: { sexNorm: { $trim: { input: { $toLower: '$sexRaw' } } } } },
      { $addFields: {
        sexGroup: {
          $switch: {
            branches: [
              { case: { $regexMatch: { input: '$sexNorm', regex: '^m' } }, then: 'Male' },
              { case: { $regexMatch: { input: '$sexNorm', regex: '^f' } }, then: 'Female' }
            ],
            default: 'Other'
          }
        }
      } },
  // group into type/value shape suitable for charts
  { $group: { _id: '$sexGroup', count: { $sum: 1 } } },
  { $project: { _id: 0, type: '$_id', value: '$count' } },
  { $sort: { value: -1 } }
    ];

  const data = await Resident.aggregate(pipeline).allowDiskUse(true);
  res.json({ data });
  } catch (err) {
    console.error('Analytics /gender error:', err);
    res.status(500).json({ error: 'Failed to fetch gender distribution' });
  }
});

// /api/analytics/age -> bucket residents by age ranges
router.get('/age', async (req, res) => {
  try {
    const pipeline = [
      // ensure we have a numeric age where possible
      { $addFields: { ageNum: { $cond: [{ $and: [{ $ne: ['$age', null] }, { $isNumber: '$age' }] }, '$age', { $cond: [{ $and: [{ $ne: ['$age', null] }, { $regexMatch: { input: { $toString: '$age' }, regex: '^\\d+' } }] }, { $toInt: '$age' }, null] } ] } } },
      // determine bucket
      { $addFields: {
        ageGroup: {
          $switch: {
            branches: [
              { case: { $and: [{ $gte: ['$ageNum', 0] }, { $lte: ['$ageNum', 18] }] }, then: '0-18' },
              { case: { $and: [{ $gte: ['$ageNum', 19] }, { $lte: ['$ageNum', 35] }] }, then: '19-35' },
              { case: { $and: [{ $gte: ['$ageNum', 36] }, { $lte: ['$ageNum', 60] }] }, then: '36-60' },
              { case: { $gte: ['$ageNum', 61] }, then: '60+' }
            ],
            default: 'Unknown'
          }
        }
      } },
      // keep only the requested buckets for charting
      { $match: { ageGroup: { $in: ['0-18', '19-35', '36-60', '60+'] } } },
      { $group: { _id: '$ageGroup', count: { $sum: 1 } } },
      { $project: { _id: 0, type: '$_id', value: '$count' } },
      { $sort: { type: 1 } }
    ];

    const data = await Resident.aggregate(pipeline).allowDiskUse(true);
    // ensure presence of all groups in the returned array and order
    const map = data.reduce((acc, d) => { acc[d.type] = d.value; return acc; }, {});
    const result = [
      { type: '0-18', value: map['0-18'] || 0 },
      { type: '19-35', value: map['19-35'] || 0 },
      { type: '36-60', value: map['36-60'] || 0 },
      { type: '60+', value: map['60+'] || 0 },
    ];

    res.json({ data: result });
  } catch (err) {
    console.error('Analytics /age error:', err);
    res.status(500).json({ error: 'Failed to fetch age buckets' });
  }
});

// /api/analytics/documents-monthly -> group documentRequests by creation month
router.get('/documents-monthly', async (req, res) => {
  try {
    const pipeline = [
      { $project: { date: '$dateRequested' } },
      { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $project: {
        _id: 0,
        type: { $concat: [ { $toString: '$_id.year' }, '-', { $cond: [ { $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' } ] } ] },
        value: '$count'
      } }
    ];

  const data = await DocumentRequest.aggregate(pipeline).allowDiskUse(true);
  res.json({ data });
  } catch (err) {
    console.error('Analytics /documents-monthly error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly documents' });
  }
});

// /api/analytics/civil-status -> group residents by civilStatus
router.get('/civil-status', async (req, res) => {
  try {
    const pipeline = [
      { $project: { raw: { $ifNull: ['$civilStatus', 'Unknown'] } } },
      { $addFields: { norm: { $trim: { input: { $toLower: '$raw' } } } } },
      { $addFields: { label: { $cond: [ { $or: [{ $eq: ['$norm', ''] }, { $eq: ['$norm', 'n/a'] }, { $eq: ['$norm', 'unknown'] }] }, 'Unknown', '$raw' ] } } },
  { $group: { _id: '$label', count: { $sum: 1 } } },
  { $project: { _id: 0, type: '$_id', value: '$count' } },
  { $sort: { value: -1 } }
    ];

  const data = await Resident.aggregate(pipeline).allowDiskUse(true);
  res.json({ data });
  } catch (err) {
    console.error('Analytics /civil-status error:', err);
    res.status(500).json({ error: 'Failed to fetch civil status data' });
  }
});

// /api/analytics/education -> group residents by educationalAttainment
router.get('/education', async (req, res) => {
  try {
    const pipeline = [
      { $project: { raw: { $ifNull: ['$educationalAttainment', 'Unknown'] } } },
      { $addFields: { norm: { $trim: { input: { $toLower: '$raw' } } } } },
      { $addFields: { label: { $cond: [ { $or: [{ $eq: ['$norm', ''] }, { $eq: ['$norm', 'n/a'] }, { $eq: ['$norm', 'unknown'] }] }, 'Unknown', '$raw' ] } } },
  { $group: { _id: '$label', count: { $sum: 1 } } },
  { $project: { _id: 0, type: '$_id', value: '$count' } },
  { $sort: { value: -1 } }
    ];

  const data = await Resident.aggregate(pipeline).allowDiskUse(true);
  res.json({ data });
  } catch (err) {
    console.error('Analytics /education error:', err);
    res.status(500).json({ error: 'Failed to fetch education data' });
  }
});

module.exports = router;
