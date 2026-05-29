const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/nomencladorCompetencia.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Asignar nomenclador a una competencia (solo admin_general)
router.post('/:competenciaId/asignar', authenticate, authorize('admin_general'), ctrl.asignar);

// Consultar qué nomenclador tiene una competencia
router.get('/:competenciaId', authenticate, ctrl.getByCompetencia);

// Obtener datos (JSON) del nomenclador de color o forma
router.get('/:competenciaId/data', authenticate, ctrl.getData);

// Descargar CSV
router.get('/:competenciaId/descargar', authenticate, ctrl.descargar);

module.exports = router;
