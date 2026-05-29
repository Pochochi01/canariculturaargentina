const router = require('express').Router();
const ctrl = require('../controllers/pdf.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Accesible también para el rol socio
router.get('/certificado/:competenciaId',
  authorize('admin_general', 'admin_sociedad', 'socio'),
  ctrl.certificado
);

// Resto solo para admins
router.use(authorize('admin_general', 'admin_sociedad'));

router.get('/catalogo/:competenciaId',               ctrl.catalogo);
router.get('/planilla-jura/:competenciaId',          ctrl.planillaJura);
router.get('/listado-lote/:competenciaId',           ctrl.listadoLote);
router.get('/listado-socio/:competenciaId',          ctrl.listadoSocio);
router.get('/listado-variedad-sociedad/:competenciaId', ctrl.listadoVariedadSociedad);

module.exports = router;
