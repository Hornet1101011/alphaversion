const express = require('express');
const router = express.Router();

// Placeholder route for gridfs
router.get('/', (req, res) => {
  res.json({ message: 'GridFS route placeholder' });
});

module.exports = router;
