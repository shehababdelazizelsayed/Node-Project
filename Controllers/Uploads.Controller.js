const fs = require('fs');
const path = require('path');
const multer = require('multer');
const logger = require('../utils/logger'); 

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.mimetype);
    cb(ok ? null : new Error('Invalid file type!'), ok);
  }
});

// Security header
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    logger.warn('File upload failed', { userId: req.user?.userId, path: req.originalUrl });
    return res.status(400).json({ message: 'No file uploaded' });
  }

  logger.info('File uploaded successfully', {
    userId: req.user?.userId,
    filename: req.file.filename,
    originalname: req.file.originalname,
    path: req.originalUrl
  });

  res.status(201).json({
    url: `/uploads/${req.file.filename}`
  });
});

// Error handler for multer or other errors
app.use((err, req, res, next) => {
  if (err) {
    logger.error('Upload error', {
      message: err.message,
      stack: err.stack,
      userId: req.user?.userId,
      path: req.originalUrl
    });
    return res.status(400).json({ message: err.message });
  }
  next();
});
