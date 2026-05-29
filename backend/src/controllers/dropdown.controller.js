const Federacion = require('../models/Federacion');
const TipoJuez   = require('../models/TipoJuez');
const OpcionMax  = require('../models/OpcionMax');

// Defaults cargados automáticamente si la colección está vacía
const DEFAULTS_FEDERACION = [
  { codigo: 'FAC',  nombre: 'Federación Argentina de Canaricultura' },
  { codigo: 'FOA',  nombre: 'Federación Ornitológica Argentina' },
  { codigo: 'FOCI', nombre: 'Federación Ornitológica del Centro Interior' },
];
const DEFAULTS_TIPO_JUEZ = [
  { valor: 'Color',  label: 'Color',          orden: 1 },
  { valor: 'Forma',  label: 'Forma y Postura', orden: 2 },
  { valor: 'Canto',  label: 'Canto',           orden: 3 },
];
const DEFAULTS_OPCION_MAX = [
  { valor: 'libre', label: 'Libre',  orden: 0 },
  { valor: '2',     label: '2',      orden: 1 },
  { valor: '3',     label: '3',      orden: 2 },
  { valor: '5',     label: '5',      orden: 3 },
  { valor: '10',    label: '10',     orden: 4 },
];

// ── Genérico: si la colección está vacía, inserta los defaults y los devuelve ──
const makeGetAll = (Model, defaults, sortField) => async (_req, res, next) => {
  try {
    const count = await Model.countDocuments();
    if (count === 0) {
      await Model.insertMany(defaults, { ordered: false }).catch(() => {}); // ignora duplicados en caso de carrera
    }
    const docs = await Model.find().sort({ [sortField]: 1 }).lean();
    res.json(docs);
  } catch (err) { next(err); }
};

// ── Federaciones ──────────────────────────────────────────────────────────────
exports.getFederaciones = makeGetAll(Federacion, DEFAULTS_FEDERACION, 'codigo');

exports.createFederacion = async (req, res, next) => {
  try {
    const { codigo, nombre } = req.body;
    const doc = await Federacion.create({ codigo, nombre });
    res.status(201).json(doc);
  } catch (err) { next(err); }
};

exports.updateFederacion = async (req, res, next) => {
  try {
    const doc = await Federacion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  } catch (err) { next(err); }
};

exports.deleteFederacion = async (req, res, next) => {
  try {
    await Federacion.findByIdAndDelete(req.params.id);
    res.json({ message: 'Eliminado' });
  } catch (err) { next(err); }
};

// ── Tipos de Juez ─────────────────────────────────────────────────────────────
exports.getTiposJuez = makeGetAll(TipoJuez, DEFAULTS_TIPO_JUEZ, 'orden');

exports.createTipoJuez = async (req, res, next) => {
  try {
    const doc = await TipoJuez.create(req.body);
    res.status(201).json(doc);
  } catch (err) { next(err); }
};

exports.updateTipoJuez = async (req, res, next) => {
  try {
    const doc = await TipoJuez.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  } catch (err) { next(err); }
};

exports.deleteTipoJuez = async (req, res, next) => {
  try {
    await TipoJuez.findByIdAndDelete(req.params.id);
    res.json({ message: 'Eliminado' });
  } catch (err) { next(err); }
};

// ── Opciones Max por Socio ────────────────────────────────────────────────────
exports.getOpcionesMax = makeGetAll(OpcionMax, DEFAULTS_OPCION_MAX, 'orden');

exports.createOpcionMax = async (req, res, next) => {
  try {
    const doc = await OpcionMax.create(req.body);
    res.status(201).json(doc);
  } catch (err) { next(err); }
};

exports.updateOpcionMax = async (req, res, next) => {
  try {
    const doc = await OpcionMax.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  } catch (err) { next(err); }
};

exports.deleteOpcionMax = async (req, res, next) => {
  try {
    await OpcionMax.findByIdAndDelete(req.params.id);
    res.json({ message: 'Eliminado' });
  } catch (err) { next(err); }
};
