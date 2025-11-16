const express = require('express');
const router = express.Router();


const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');

// GET /api/templates/:name - returns the template file as a download or 404
router.get('/:name', async (req, res) => {
  const fileName = req.params.name;
  // Support both .docx and no extension
  const possibleNames = [fileName, fileName + '.docx'];
  const templatesDir = path.join(__dirname, '../../client/public/Templates');
  let foundPath = null;
  for (const name of possibleNames) {
    const filePath = path.join(templatesDir, name);
    if (fs.existsSync(filePath)) {
      foundPath = filePath;
      break;
    }
  }
  if (!foundPath) {
    return res.status(404).json({ error: 'Template not found' });
  }
  try {
    const result = await mammoth.extractRawText({ path: foundPath });
    res.json({ text: result.value });
  } catch (err) {
    res.status(500).json({ error: 'Failed to extract template text' });
  }
});

module.exports = router;
