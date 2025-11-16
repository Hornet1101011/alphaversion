"use strict";
const express_1 = require("express");
const router = (0, express_1.Router)();
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'wrong@example.com')
        return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ user: { email } });
});
router.post('/register', (req, res) => {
    res.status(201).json({ user: req.body });
});
module.exports = router;
