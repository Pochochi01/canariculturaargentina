const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const Revista     = require('../models/Revista');
const Competencia = require('../models/Competencia');
const pdfRevista  = require('../services/pdfRevista.service');

const REVISTAS_DIR = path.join(__dirname, '../../uploads/revistas');
fs.mkdirSync(REVISTAS_DIR, { recursive: true });

// ── POST /api/revistas/publicar/:competenciaId ────────────────────────────────
// Genera la revista PDF, la guarda en disco y crea el registro en BD.
exports.publicar = async (req, res, next) => {
  try {
    const { competenciaId } = req.params;

    const competencia = await Competencia.findById(competenciaId)
      .populate('sociedadId', 'nombre federacionId')
      .lean();
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    // Generar PDF a buffer capturando la respuesta
    const { PassThrough } = require('stream');
    const chunks = [];
    const pt = new PassThrough();
    pt.on('data', c => chunks.push(c));

    const pdfBuffer = await new Promise((resolve, reject) => {
      pt.on('end',   () => resolve(Buffer.concat(chunks)));
      pt.on('error', reject);
      const mockRes = Object.assign(pt, { setHeader: () => {}, statusCode: 200 });
      pdfRevista.generarRevistaPDF(competenciaId, mockRes).catch(reject);
    });

    // Guardar en disco
    const nombre   = competencia.nombre?.replace(/[^a-z0-9_\-]/gi, '_') || competenciaId;
    const año      = competencia.fecha ? new Date(competencia.fecha).getFullYear() : new Date().getFullYear();
    const filename = `revista_${nombre}_${Date.now()}.pdf`;
    const filePath = path.join(REVISTAS_DIR, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    // Token público único
    const token = crypto.randomBytes(20).toString('hex');

    const revista = await Revista.create({
      nombre: `${competencia.nombre} ${año}`,
      competenciaId,
      año,
      filename,
      token
    });

    res.status(201).json(revista);
  } catch (err) { next(err); }
};

// ── GET /api/revistas ─────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const revistas = await Revista.find()
      .populate('competenciaId', 'nombre fecha')
      .sort({ fecha: -1 });
    res.json(revistas);
  } catch (err) { next(err); }
};

// ── GET /api/revistas/:id ─────────────────────────────────────────────────────
exports.getById = async (req, res, next) => {
  try {
    const revista = await Revista.findById(req.params.id)
      .populate('competenciaId', 'nombre fecha');
    if (!revista) return res.status(404).json({ error: 'Revista no encontrada' });
    res.json(revista);
  } catch (err) { next(err); }
};

// ── GET /api/revistas/publica/:token (SIN auth) ───────────────────────────────
exports.getByToken = async (req, res, next) => {
  try {
    const revista = await Revista.findOne({ token: req.params.token })
      .populate('competenciaId', 'nombre fecha');
    if (!revista) return res.status(404).json({ error: 'Revista no encontrada' });
    res.json(revista);
  } catch (err) { next(err); }
};

// ── DELETE /api/revistas/:id ──────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const revista = await Revista.findByIdAndDelete(req.params.id);
    if (!revista) return res.status(404).json({ error: 'Revista no encontrada' });

    const filePath = path.join(REVISTAS_DIR, revista.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ ok: true });
  } catch (err) { next(err); }
};
