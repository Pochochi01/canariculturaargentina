const MovimientoSociedad = require('../models/MovimientoSociedad');

// GET /api/gestion/movimientos?desde=&hasta=&tipo=
exports.getBySociedad = async (req, res, next) => {
  try {
    const sociedadId = req.user.sociedadId;
    const { desde, hasta, tipo } = req.query;
    const filter = { sociedadId };
    if (tipo) filter.tipo = tipo;
    if (desde || hasta) {
      filter.fecha = {};
      if (desde) filter.fecha.$gte = new Date(desde);
      if (hasta) {
        const h = new Date(hasta);
        h.setHours(23, 59, 59, 999);
        filter.fecha.$lte = h;
      }
    }
    const movimientos = await MovimientoSociedad.find(filter).sort({ fecha: -1 });

    const totalIngresos = movimientos
      .filter(m => m.tipo === 'ingreso')
      .reduce((acc, m) => acc + m.monto, 0);
    const totalEgresos = movimientos
      .filter(m => m.tipo === 'egreso')
      .reduce((acc, m) => acc + m.monto, 0);

    res.json({ movimientos, totalIngresos, totalEgresos, saldo: totalIngresos - totalEgresos });
  } catch (err) { next(err); }
};

// POST /api/gestion/movimientos
exports.create = async (req, res, next) => {
  try {
    const sociedadId = req.user.sociedadId;
    const mov = await MovimientoSociedad.create({ ...req.body, sociedadId });
    res.status(201).json(mov);
  } catch (err) { next(err); }
};

// PUT /api/gestion/movimientos/:id
exports.update = async (req, res, next) => {
  try {
    const mov = await MovimientoSociedad.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(mov);
  } catch (err) { next(err); }
};

// DELETE /api/gestion/movimientos/:id
exports.remove = async (req, res, next) => {
  try {
    const mov = await MovimientoSociedad.findByIdAndDelete(req.params.id);
    if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};
