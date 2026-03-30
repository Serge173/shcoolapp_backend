const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
const photosDir = path.join(uploadDir, 'photos');
const brochuresDir = path.join(uploadDir, 'brochures');
const logosDir = path.join(uploadDir, 'logos');

[uploadDir, photosDir, brochuresDir, logosDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storagePhotos = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => cb(null, `photo-${Date.now()}-${crypto.randomUUID()}${safeExt(file, '.jpg')}`),
});
const storageBrochure = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brochuresDir),
  filename: (req, file, cb) => cb(null, `brochure-${Date.now()}-${crypto.randomUUID()}.pdf`),
});
const storageLogo = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logosDir),
  filename: (req, file, cb) => cb(null, `logo-${Date.now()}-${crypto.randomUUID()}${safeExt(file, '.png')}`),
});

function safeExt(file, fallback) {
  const ext = (path.extname(file.originalname || '') || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'].includes(ext)) return ext;
  return fallback;
}

const fileFilter = (req, file, cb) => {
  const imageMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
  const pdfMimes = new Set(['application/pdf']);
  const ext = (path.extname(file.originalname || '').slice(1) || '').toLowerCase();
  if (file.fieldname === 'brochure') {
    if (ext === 'pdf' && pdfMimes.has((file.mimetype || '').toLowerCase())) return cb(null, true);
    return cb(new Error('Seuls les PDF sont acceptés pour la brochure.'));
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) && imageMimes.has((file.mimetype || '').toLowerCase())) return cb(null, true);
  cb(new Error('Format de fichier non autorisé.'));
};

exports.uploadPhotos = multer({ storage: storagePhotos, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }).array('photos', 10);
exports.uploadBrochure = multer({ storage: storageBrochure, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }).single('brochure');
exports.uploadLogo = multer({ storage: storageLogo, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } }).single('logo');
exports.uploadDir = uploadDir;
exports.photosDir = photosDir;
exports.brochuresDir = brochuresDir;
exports.logosDir = logosDir;
