const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AppError = require('../utils/AppError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'complaints');

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.jpg', '.jpeg', '.png']);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
]);

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safe);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new AppError(400, 'Only PDF, DOCX, JPG, JPEG, and PNG files are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

module.exports = {
  uploadSingle: upload.single('file'),
  UPLOAD_DIR,
  ensureUploadDir
};
