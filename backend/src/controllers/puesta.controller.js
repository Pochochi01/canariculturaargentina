const Puesta = require('../models/Puesta');
const Pareja = require('../models/Pareja');
const Ejemplar = require('../models/Ejemplar');
const Socio = require('../models/Socio');

async function getSocioId(user) {
  const socio = await Socio.findOne({ userId: user._id }).select('_id').lean();
  return socio?._id ?? null;
}

// ─── Puestas por pareja ───────────────────────────────────────────────────────

exports.getByPareja = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const puestas = await Puesta.find({ parejaId: req.params.parejaId, socioId, activo: true })
      .sort({ numPuesta: 1 });
    res.json(puestas);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    // Verificar que la pareja pertenece al socio
    const pareja = await Pareja.findOne({ _id: req.body.parejaId, socioId, activo: true });
    if (!pareja) return res.status(404).json({ error: 'Pareja no encontrada' });

    // Calcular número de puesta
    const count = await Puesta.countDocuments({ parejaId: pareja._id, socioId, activo: true });

    const { fechaInicioPuesta, fechaInicioIncubacion, numHuevos, comentarios } = req.body;

    // Construir array de huevos (uno por número)
    const cantidad = Math.min(Math.max(parseInt(numHuevos) || 0, 0), 7);
    const huevos = Array.from({ length: cantidad }, (_, i) => ({
      numero: i + 1,
      estado: 'incubando',
      fechaInicioIncubacion: fechaInicioIncubacion || null,
    }));

    const puesta = await Puesta.create({
      parejaId: pareja._id,
      socioId,
      numPuesta: count + 1,
      fechaInicioPuesta: fechaInicioPuesta || null,
      fechaInicioIncubacion: fechaInicioIncubacion || null,
      huevos,
      comentarios,
    });
    res.status(201).json(puesta);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const puesta = await Puesta.findOne({ _id: req.params.id, socioId });
    if (!puesta) return res.status(404).json({ error: 'Puesta no encontrada' });

    const { fechaInicioPuesta, fechaInicioIncubacion, comentarios } = req.body;
    if (fechaInicioPuesta !== undefined) puesta.fechaInicioPuesta = fechaInicioPuesta || null;
    if (fechaInicioIncubacion !== undefined) puesta.fechaInicioIncubacion = fechaInicioIncubacion || null;
    if (comentarios !== undefined) puesta.comentarios = comentarios;

    await puesta.save();
    res.json(puesta);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const puesta = await Puesta.findOneAndDelete({ _id: req.params.id, socioId });
    if (!puesta) return res.status(404).json({ error: 'Puesta no encontrada' });
    res.json({ message: 'Puesta eliminada' });
  } catch (err) { next(err); }
};

// ─── Huevos dentro de una puesta ─────────────────────────────────────────────

exports.updateHuevo = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const puesta = await Puesta.findOne({ _id: req.params.id, socioId });
    if (!puesta) return res.status(404).json({ error: 'Puesta no encontrada' });

    const huevo = puesta.huevos.id(req.params.huevoId);
    if (!huevo) return res.status(404).json({ error: 'Huevo no encontrado' });

    const { estado, fechaInicioIncubacion, parejaNodrizaId } = req.body;
    if (estado !== undefined) huevo.estado = estado;
    if (fechaInicioIncubacion !== undefined) huevo.fechaInicioIncubacion = fechaInicioIncubacion || null;
    if (parejaNodrizaId !== undefined) huevo.parejaNodrizaId = parejaNodrizaId || null;

    await puesta.save();
    res.json(puesta);
  } catch (err) { next(err); }
};

exports.addHuevos = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const puesta = await Puesta.findOne({ _id: req.params.id, socioId });
    if (!puesta) return res.status(404).json({ error: 'Puesta no encontrada' });

    const { numHuevos, fechaInicioIncubacion } = req.body;
    const cantidad = Math.min(Math.max(parseInt(numHuevos) || 0, 0), 7);

    // Reemplazar todos los huevos
    puesta.huevos = Array.from({ length: cantidad }, (_, i) => ({
      numero: i + 1,
      estado: 'incubando',
      fechaInicioIncubacion: fechaInicioIncubacion || puesta.fechaInicioIncubacion || null,
    }));

    await puesta.save();
    res.json(puesta);
  } catch (err) { next(err); }
};

// ─── Descendientes (ejemplares nacidos) ──────────────────────────────────────

exports.getDescendientes = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const puestaIds = await Puesta.find({ parejaId: req.params.parejaId, socioId, activo: true })
      .select('_id').lean();

    const ids = puestaIds.map(p => p._id);
    const descendientes = await Ejemplar.find({ puestaId: { $in: ids }, socioId, activo: true })
      .sort({ numAnillo: 1 });

    res.json(descendientes);
  } catch (err) { next(err); }
};
