const Puesta = require('../models/Puesta');
const Pareja = require('../models/Pareja');
const Ejemplar = require('../models/Ejemplar');
const Socio = require('../models/Socio');
const Notificacion = require('../models/Notificacion');

async function getSocioId(user) {
  const socio = await Socio.findOne({ userId: user._id }).select('_id').lean();
  return socio?._id ?? null;
}

// Elimina notificaciones no leídas del mismo tipo para la misma entidad y crea una nueva
async function scheduleNotif(socioId, entidadId, entidadTipo, tipo, titulo, mensaje, fecha) {
  await Notificacion.deleteMany({ socioId, entidadId, entidadTipo, tipo, leida: false });
  if (fecha) {
    await Notificacion.create({ socioId, tipo, titulo, mensaje, fechaVencimiento: fecha, entidadId, entidadTipo });
  }
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

    const pareja = await Pareja.findOne({ _id: req.body.parejaId, socioId, activo: true });
    if (!pareja) return res.status(404).json({ error: 'Pareja no encontrada' });

    const count = await Puesta.countDocuments({ parejaId: pareja._id, socioId, activo: true });

    const { fechaInicioPuesta, fechaInicioIncubacion, numHuevos, comentarios } = req.body;

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

    if (fechaInicioIncubacion) {
      const base = new Date(fechaInicioIncubacion);
      const d6  = new Date(base); d6.setDate(d6.getDate() + 6);
      const d14 = new Date(base); d14.setDate(d14.getDate() + 14);
      await scheduleNotif(socioId, puesta._id, 'puesta', 'fertilidad',
        `Puesta ${puesta.numPuesta} — Revisión de fertilidad`,
        `Han pasado 6 días desde el inicio de la incubación. Revisá si los huevos están fértiles.`,
        d6
      );
      await scheduleNotif(socioId, puesta._id, 'puesta', 'nacimiento',
        `Puesta ${puesta.numPuesta} — Control de nacimiento`,
        `Han pasado 14 días de incubación. Controlá el nacimiento de los pichones.`,
        d14
      );
    }

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

    if (fechaInicioIncubacion !== undefined) {
      if (fechaInicioIncubacion) {
        const base = new Date(fechaInicioIncubacion);
        const d6  = new Date(base); d6.setDate(d6.getDate() + 6);
        const d14 = new Date(base); d14.setDate(d14.getDate() + 14);
        await scheduleNotif(socioId, puesta._id, 'puesta', 'fertilidad',
          `Puesta ${puesta.numPuesta} — Revisión de fertilidad`,
          `Han pasado 6 días desde el inicio de la incubación. Revisá si los huevos están fértiles.`,
          d6
        );
        await scheduleNotif(socioId, puesta._id, 'puesta', 'nacimiento',
          `Puesta ${puesta.numPuesta} — Control de nacimiento`,
          `Han pasado 14 días de incubación. Controlá el nacimiento de los pichones.`,
          d14
        );
      } else {
        await Notificacion.deleteMany({ socioId, entidadId: puesta._id, entidadTipo: 'puesta', leida: false });
      }
    }

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

    const { estado, fechaInicioIncubacion, parejaNodrizaId, estadoPichon, ejemplarId } = req.body;

    const prevEstado = huevo.estado;
    if (estado !== undefined) huevo.estado = estado;
    if (fechaInicioIncubacion !== undefined) huevo.fechaInicioIncubacion = fechaInicioIncubacion || null;
    if (parejaNodrizaId !== undefined) huevo.parejaNodrizaId = parejaNodrizaId || null;
    if (estadoPichon !== undefined) huevo.estadoPichon = estadoPichon || null;
    if (ejemplarId !== undefined) huevo.ejemplarId = ejemplarId || null;

    // Al eclosionar: fijar fecha y estado de pichón; programar notificación de anillado
    if (estado === 'eclosionado' && prevEstado !== 'eclosionado') {
      huevo.fechaEclosion = new Date();
      if (!huevo.estadoPichon) huevo.estadoPichon = 'pendiente_anillar';
      const d5 = new Date(); d5.setDate(d5.getDate() + 5);
      await scheduleNotif(
        socioId,
        huevo._id,
        'huevo',
        'anillado',
        `Pichón eclosionado — ¡Hora de anillar!`,
        `Han pasado 5 días desde que eclosionó el huevo #${huevo.numero} de la puesta ${puesta.numPuesta}. Es momento de colocarle el anillo.`,
        d5
      );
    }

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
