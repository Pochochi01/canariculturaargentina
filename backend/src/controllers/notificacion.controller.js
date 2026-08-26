const Notificacion = require('../models/Notificacion');
const Socio = require('../models/Socio');

async function getSocioId(user) {
  const socio = await Socio.findOne({ userId: user._id }).select('_id').lean();
  return socio?._id ?? null;
}

// GET /api/notificaciones
exports.getAll = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const notifs = await Notificacion.find({
      socioId,
      activo: true,
      fechaVencimiento: { $lte: new Date() }
    }).sort({ leida: 1, fechaVencimiento: -1 }).lean();

    res.json(notifs);
  } catch (err) { next(err); }
};

// PUT /api/notificaciones/leer-todas
exports.marcarTodasLeidas = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    await Notificacion.updateMany(
      { socioId, activo: true, leida: false },
      { leida: true }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// PUT /api/notificaciones/:id/leer
exports.marcarLeida = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const notif = await Notificacion.findOneAndUpdate(
      { _id: req.params.id, socioId },
      { leida: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json(notif);
  } catch (err) { next(err); }
};

// DELETE /api/notificaciones/:id
exports.remove = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const notif = await Notificacion.findOneAndUpdate(
      { _id: req.params.id, socioId },
      { activo: false },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};
