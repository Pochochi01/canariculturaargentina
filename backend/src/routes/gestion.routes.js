const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');

const configCtrl = require('../controllers/configCuota.controller');
const pagoCtrl   = require('../controllers/pagoCuota.controller');
const movCtrl    = require('../controllers/movimientoSociedad.controller');
const pdfGestion = require('../services/pdfGestion.service');

// ── Multer para logo ─────────────────────────────────────────────────────────
const logoDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logoDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${Date.now()}${ext}`);
  }
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// ── Todas las rutas requieren auth ──────────────────────────────────────────
router.use(authenticate);

const adminSoc = authorize('admin_general', 'admin_sociedad');
const cualquiera = authorize('admin_general', 'admin_sociedad', 'socio');

// Sociedad
router.get('/sociedad',   adminSoc, configCtrl.getSociedad);
router.post('/logo',      adminSoc, uploadLogo.single('logo'), configCtrl.uploadLogo);

// Configuración de cuotas
router.get('/config',     adminSoc, configCtrl.get);
router.put('/config',     adminSoc, configCtrl.upsert);

// Pagos de cuotas
router.get('/pagos',          adminSoc,   pagoCtrl.getBySocio);
router.get('/pagos/ultimo',   adminSoc,   pagoCtrl.getUltimoPago);
router.post('/pagos',         adminSoc,   pagoCtrl.create);
router.put('/pagos/:id',      adminSoc,   pagoCtrl.update);
router.delete('/pagos/:id',   adminSoc,   pagoCtrl.remove);

// Estado de cuenta del socio (admin y el propio socio)
router.get('/estado-socio',   cualquiera, pagoCtrl.getEstadoSocio);
// El socio consulta su propio estado (sin necesitar pasarse su propio socioId)
router.get('/mi-estado',      authorize('socio'), pagoCtrl.getMiEstado);

// Movimientos de la sociedad (ingresos/egresos)
router.get('/movimientos',        adminSoc, movCtrl.getBySociedad);
router.post('/movimientos',       adminSoc, movCtrl.create);
router.put('/movimientos/:id',    adminSoc, movCtrl.update);
router.delete('/movimientos/:id', adminSoc, movCtrl.remove);

// PDF recibo
router.get('/pdf/recibo/:pagoId', cualquiera, async (req, res, next) => {
  try {
    await pdfGestion.generarRecibo(req.params.pagoId, res);
  } catch (err) { next(err); }
});

// PDF estado de cuenta del socio
router.get('/pdf/estado-socio/:socioId', cualquiera, async (req, res, next) => {
  try {
    await pdfGestion.generarEstadoCuenta(req.params.socioId, res);
  } catch (err) { next(err); }
});

// PDF estado cuenta general de la sociedad
router.get('/pdf/movimientos', adminSoc, async (req, res, next) => {
  try {
    await pdfGestion.generarEstadoSociedad(req.user.sociedadId, req.query, res);
  } catch (err) { next(err); }
});

module.exports = router;
