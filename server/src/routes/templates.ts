const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
let mammoth;
try { mammoth = require('mammoth'); } catch (e) { mammoth = null; }

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../client/public/Templates') });

// Upload a new template file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Optionally, rename file to original name
  const destPath = path.join(req.file.destination, req.file.originalname);
  const templatesJsonPath = path.join(__dirname, '../../client/src/data/templates.json');
  fs.rename(req.file.path, destPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save file' });
    }
    // Update templates.json
    fs.readFile(templatesJsonPath, 'utf8', (readErr, data) => {
      let templatesArr: string[] = [];
      if (!readErr) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            templatesArr = parsed.filter((f: any) => typeof f === 'string');
          }
        } catch (parseErr) {
          templatesArr = [];
        }
      }
      if (!templatesArr.includes(req.file.originalname)) {
        templatesArr.push(req.file.originalname);
      }
      fs.writeFile(templatesJsonPath, JSON.stringify(templatesArr, null, 2), 'utf8', (writeErr) => {
        if (writeErr) {
          return res.json({ success: true, filename: req.file.originalname, warning: 'File uploaded, but failed to update templates.json' });
        }
        res.json({ success: true, filename: req.file.originalname });
      });
    });
  });
});

// Delete a template file
router.delete('/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../../client/public/Templates', filename);
  const templatesJsonPath = path.join(__dirname, '../../client/src/data/templates.json');
  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found or could not be deleted' });
    }
    // Update templates.json
    fs.readFile(templatesJsonPath, 'utf8', (readErr, data) => {
      if (readErr) {
        // File deleted, but failed to update JSON
        return res.json({ success: true, warning: 'File deleted, but failed to update templates.json' });
      }
      let templatesArr;
      try {
        templatesArr = JSON.parse(data);
      } catch (parseErr) {
        return res.json({ success: true, warning: 'File deleted, but templates.json is invalid' });
      }
      const updatedArr = templatesArr.filter(f => f !== filename);
      fs.writeFile(templatesJsonPath, JSON.stringify(updatedArr, null, 2), 'utf8', (writeErr) => {
        if (writeErr) {
          return res.json({ success: true, warning: 'File deleted, but failed to update templates.json' });
        }
        res.json({ success: true });
      });
    });
  });
});

// Rename a template file
router.post('/rename', (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) {
    return res.status(400).json({ error: 'Missing oldName or newName' });
  }
  const oldPath = path.join(__dirname, '../../client/public/Templates', oldName);
  const newPath = path.join(__dirname, '../../client/public/Templates', newName);
  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to rename file' });
    }
    res.json({ success: true });
  });
});

// List all .docx templates in the Templates folder
router.get('/list', (req, res) => {
  const templatesDir = path.join(__dirname, '../../client/public/Templates');
  fs.readdir(templatesDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read templates directory' });
    }
    const docxFiles = files.filter(f => f.endsWith('.docx'));
    res.json({ templates: docxFiles });
  });
});

// Get the contents of a specific template by filename
router.get('/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../../client/public/Templates', filename);
  try {
    let text = '';
    if (mammoth && filename.endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
      } catch (e) {
        text = '';
      }
    }
    if (!text) {
      try {
        text = fs.readFileSync(filePath, 'utf8');
      } catch (e) {
        console.log('Error reading file:', e);
        return res.status(404).json({ error: 'File not found or unreadable' });
      }
    }
    const matches = Array.from(text.matchAll(/\$\{([^}]+)\}/g)).map(m => m[1]);
    res.json({ text, placeholders: matches });
  } catch (err) {
    console.log('Error reading template:', err);
    res.status(500).json({ error: 'Failed to read template' });
  }
});

// Move a template file to a subdirectory when clicked
router.post('/move', (req, res) => {
  const { filename, targetDir } = req.body;
  if (!filename || !targetDir) {
    return res.status(400).json({ error: 'Missing filename or targetDir' });
  }
  const templatesDir = path.join(__dirname, '../../client/public/Templates');
  const sourcePath = path.join(templatesDir, filename);
  const destDir = path.join(templatesDir, targetDir);
  const destPath = path.join(destDir, filename);

  // Ensure target directory exists
  fs.mkdir(destDir, { recursive: true }, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to create target directory' });
    }
    // Move the file
    fs.rename(sourcePath, destPath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to move file' });
      }
      res.json({ success: true, newPath: destPath });
    });
  });
});

export = router;
