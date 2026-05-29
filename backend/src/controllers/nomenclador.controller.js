const NomencladorColor = require('../models/NomencladorColor');
const NomencladorForma = require('../models/NomencladorForma');
const NomencladorCanto = require('../models/NomencladorCanto');
const pdfParse = require('pdf-parse');

// ─── CRUD genérico ────────────────────────────────────────────────────────────

const crudFor = (Model, nombreEntidad) => ({
  getAll: async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.activo !== undefined) filter.activo = req.query.activo === 'true';
      const items = await Model.find(filter).sort({ codigo: 1 });
      res.json(items);
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const item = await Model.findById(req.params.id);
      if (!item) return res.status(404).json({ error: `${nombreEntidad} no encontrado` });
      res.json(item);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { codigo, nombreLinea } = req.body;
      if (!codigo?.trim()) return res.status(400).json({ error: 'El código es requerido' });
      if (!nombreLinea?.trim()) return res.status(400).json({ error: 'El nombre de línea es requerido' });
      const item = await Model.create({ codigo: codigo.trim(), nombreLinea: nombreLinea.trim() });
      res.status(201).json({ message: `${nombreEntidad} agregado correctamente`, item });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { codigo, nombreLinea, activo } = req.body;
      const update = {};
      if (codigo !== undefined) update.codigo = codigo.trim().toUpperCase();
      if (nombreLinea !== undefined) update.nombreLinea = nombreLinea.trim();
      if (activo !== undefined) update.activo = activo;
      const item = await Model.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ error: `${nombreEntidad} no encontrado` });
      res.json(item);
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ error: `${nombreEntidad} no encontrado` });
      res.json({ message: `${nombreEntidad} eliminado` });
    } catch (err) { next(err); }
  }
});

// ─── Parser de texto extraído del PDF ────────────────────────────────────────
// Soporta dos formatos encontrados en los PDFs de la FAC:
//   1) Línea única:  "D002    BLANCO DOMINANTE"  (código + 2+ espacios + nombre)
//   2) Línea doble:  "D001\nBLANCO"              (código solo, nombre en línea siguiente)
//
// Líneas de cabecera/pie ("RAMA", "NOMENCLADOR", "Id", "Color", números solos) se descartan.

// Código: 1-4 letras mayúsculas seguidas de 1-6 dígitos (ej: D001, F12, C0123)
const CODIGO_RE = /^([A-Z]{1,4}\d{1,6})(\s{2,}(.+))?$/;
// Ruido: encabezados de página, números de página, años
const RUIDO_RE  = /^(RAMA|NOMENCLADOR|Id|Color|\d{1,4})$/i;

const parsearLineasPDF = (texto) => {
  const lineas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const registros  = [];
  const vistos     = new Set();
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];

    if (RUIDO_RE.test(linea)) { i++; continue; }

    const m = linea.match(CODIGO_RE);
    if (!m) { i++; continue; }

    const codigo = m[1].toUpperCase();

    // Nombre en la misma línea (separado por 2+ espacios)
    let nombreLinea = m[3] ? m[3].trim() : null;

    // Nombre en la línea siguiente (solo si la línea actual era código puro)
    if (!nombreLinea && i + 1 < lineas.length) {
      const sig = lineas[i + 1].trim();
      if (!RUIDO_RE.test(sig) && !CODIGO_RE.test(sig) && sig.length >= 2) {
        nombreLinea = sig;
        i++; // consumir la línea del nombre
      }
    }

    if (nombreLinea && nombreLinea.length >= 2 && !vistos.has(codigo)) {
      vistos.add(codigo);
      registros.push({ codigo, nombreLinea });
    }

    i++;
  }

  return registros;
};

// ─── Importación desde PDF ────────────────────────────────────────────────────

const importarPDFPara = (Model, nombreColeccion) => async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
    }

    let pdfData;
    try {
      pdfData = await pdfParse(req.file.buffer);
    } catch {
      return res.status(422).json({
        error: 'No se pudo leer el archivo PDF. Verifique que no esté protegido ni dañado.'
      });
    }

    const registros = parsearLineasPDF(pdfData.text);

    if (registros.length === 0) {
      return res.status(422).json({
        error: 'No se encontraron datos válidos en el PDF. El formato esperado es: CODIGO  Nombre de línea'
      });
    }

    await Model.deleteMany({});
    const insertados = await Model.insertMany(registros);

    res.json({
      message: `Importación exitosa: ${insertados.length} registros cargados en ${nombreColeccion}`,
      total: insertados.length,
      muestra: insertados.slice(0, 5).map(i => ({ codigo: i.codigo, nombreLinea: i.nombreLinea }))
    });
  } catch (err) { next(err); }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

exports.color = crudFor(NomencladorColor, 'Nomenclador de color');
exports.forma = crudFor(NomencladorForma, 'Nomenclador de forma');
exports.canto = crudFor(NomencladorCanto, 'Nomenclador de canto');

exports.importarColoresPDF = importarPDFPara(NomencladorColor, 'colores');
exports.importarFormasPDF  = importarPDFPara(NomencladorForma, 'formas');
exports.importarCantoPDF   = importarPDFPara(NomencladorCanto, 'canto');
