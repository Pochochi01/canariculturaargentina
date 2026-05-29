const path = require('path');
const fs   = require('fs');
const Publicidad  = require('../models/Publicidad');
const Competencia = require('../models/Competencia');
const pdfRevista  = require('../services/pdfRevista.service');

const ADS_ROOT = path.join(__dirname, '../../uploads/advertisements');

// POST /api/publicidades/upload
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

    const { tipo, subtipo, competenciaId, orden = 0 } = req.body;

    if (!tipo || !competenciaId)
      return res.status(400).json({ error: 'tipo y competenciaId son requeridos' });

    const TIPOS_VALIDOS = ['cover', 'backcover', 'fullpage', 'halfpage', 'quarterpage', 'grades'];
    if (!TIPOS_VALIDOS.includes(tipo))
      return res.status(400).json({ error: `tipo inválido: ${tipo}` });
    if (tipo === 'fullpage' && !['peers', 'odd'].includes(subtipo))
      return res.status(400).json({ error: 'Para fullpage se requiere subtipo: peers | odd' });

    const competencia = await Competencia.findById(competenciaId).select('nombre fecha').lean();
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    const año = competencia.fecha
      ? new Date(competencia.fecha).getFullYear()
      : new Date().getFullYear();

    const pub = await Publicidad.create({
      tipo,
      subtipo: tipo === 'fullpage' ? subtipo : null,
      competenciaId,
      año,
      filename: req.file.filename,
      originalName: req.file.originalname,
      orden: Number(orden)
    });

    res.status(201).json(pub);
  } catch (err) { next(err); }
};

// GET /api/publicidades?competenciaId=&tipo=
exports.getByCompetencia = async (req, res, next) => {
  try {
    const { competenciaId, tipo } = req.query;
    if (!competenciaId) return res.status(400).json({ error: 'competenciaId requerido' });

    const filter = { competenciaId };
    if (tipo) filter.tipo = tipo;

    const pubs = await Publicidad.find(filter).sort({ tipo: 1, subtipo: 1, orden: 1 });
    res.json(pubs);
  } catch (err) { next(err); }
};

// DELETE /api/publicidades/:id
exports.remove = async (req, res, next) => {
  try {
    const pub = await Publicidad.findByIdAndDelete(req.params.id);
    if (!pub) return res.status(404).json({ error: 'Publicidad no encontrada' });

    const filePath = path.join(ADS_ROOT, pub.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ ok: true });
  } catch (err) { next(err); }
};

// GET /api/publicidades/revista/:competenciaId
exports.generarRevista = async (req, res, next) => {
  try {
    await pdfRevista.generarRevistaPDF(req.params.competenciaId, res);
  } catch (err) {
    if (!res.headersSent) return next(err);
    console.error('Error generando revista:', err.message);
    res.end();
  }
};
