const path = require('path');
const fs   = require('fs');

const NomencladorCompetencia = require('../models/NomencladorCompetencia');
const Competencia             = require('../models/Competencia');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/nomencladores');

// Nombre de los archivos base más recientes (por defecto FAC 2026)
const BASE_COLOR = 'nomenclador_color_2026.csv';
const BASE_FORMA = 'nomenclador_formapostura_2026.csv';

function slugify(str) {
  return str
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// POST /api/nomenclador-competencia/:competenciaId/asignar
exports.asignar = async (req, res) => {
  try {
    const { competenciaId } = req.params;

    const competencia = await Competencia.findById(competenciaId).lean();
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    const slug = slugify(competencia.nombre);
    const filenameColor = `${slug}_${competenciaId}_color.csv`;
    const filenameForma = `${slug}_${competenciaId}_formapostura.csv`;

    const srcColor = path.join(UPLOADS_DIR, BASE_COLOR);
    const srcForma = path.join(UPLOADS_DIR, BASE_FORMA);

    if (!fs.existsSync(srcColor)) return res.status(500).json({ error: `Archivo base no encontrado: ${BASE_COLOR}` });
    if (!fs.existsSync(srcForma)) return res.status(500).json({ error: `Archivo base no encontrado: ${BASE_FORMA}` });

    fs.copyFileSync(srcColor, path.join(UPLOADS_DIR, filenameColor));
    fs.copyFileSync(srcForma, path.join(UPLOADS_DIR, filenameForma));

    const año = competencia.fecha ? new Date(competencia.fecha).getFullYear() : null;

    const doc = await NomencladorCompetencia.findOneAndUpdate(
      { competenciaId },
      {
        competenciaId,
        nombreCompetencia: competencia.nombre,
        filenameColor,
        filenameForma,
        añoBase: año,
        fechaAsignacion: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, nomenclador: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/nomenclador-competencia/:competenciaId
exports.getByCompetencia = async (req, res) => {
  try {
    const doc = await NomencladorCompetencia.findOne({ competenciaId: req.params.competenciaId }).lean();
    if (!doc) return res.status(404).json({ error: 'Sin nomenclador asignado' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/nomenclador-competencia/:competenciaId/data?tipo=color|forma
exports.getData = async (req, res) => {
  try {
    const { tipo = 'color' } = req.query;
    const doc = await NomencladorCompetencia.findOne({ competenciaId: req.params.competenciaId }).lean();
    if (!doc) return res.status(404).json({ error: 'Sin nomenclador asignado' });

    const filename = tipo === 'forma' ? doc.filenameForma : doc.filenameColor;
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado en disco' });

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const headers = lines[0].split(',');
    const records = lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
      return obj;
    });

    res.json({ tipo, filename, total: records.length, data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/nomenclador-competencia/:competenciaId/descargar?tipo=color|forma
exports.descargar = async (req, res) => {
  try {
    const { tipo = 'color' } = req.query;
    const doc = await NomencladorCompetencia.findOne({ competenciaId: req.params.competenciaId }).lean();
    if (!doc) return res.status(404).json({ error: 'Sin nomenclador asignado' });

    const filename = tipo === 'forma' ? doc.filenameForma : doc.filenameColor;
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado en disco' });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
