"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Sample document request endpoints
router.post('/request', (req, res) => res.status(201).json({ _id: 'doc1', ...req.body }));
router.get('/request/:id', (req, res) => res.json({ _id: req.params.id, type: 'Barangay Clearance' }));
router.put('/request/:id', (req, res) => res.json({ _id: req.params.id, status: req.body.status }));
router.delete('/request/:id', (req, res) => res.status(200).json({ deleted: true }));
exports.default = router;
