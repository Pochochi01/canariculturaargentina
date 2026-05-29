const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const ctrl    = require('../controllers/csvToPdf.controller');
const { authenticate, authorize } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'text/csv' ||
               file.mimetype === 'application/vnd.ms-excel' ||
               file.originalname.toLowerCase().endsWith('.csv');
    cb(ok ? null : new Error('Solo se permiten archivos .csv'), ok);
  }
});

router.use(authenticate, authorize('admin_general'));

router.post('/',                    upload.single('file'), ctrl.convertir);
router.get('/files',                ctrl.listar);
router.get('/download/:filename',   ctrl.descargar);
router.delete('/:filename',         ctrl.eliminar);

// Error de multer → JSON
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
});

module.exports = router;
