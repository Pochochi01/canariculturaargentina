const PagoCuota = require('../models/PagoCuota');
const Socio = require('../models/Socio');
const MovimientoSociedad = require('../models/MovimientoSociedad');

// Generar número de recibo: YYYY-NNNNNN secuencial por sociedad
async function generarNroRecibo(sociedadId) {
  const año = new Date().getFullYear();
  const prefix = `${año}-`;
  const ultimo = await PagoCuota.findOne(
    { sociedadId, nroRecibo: { $regex: `^${prefix}` } },
    { nroRecibo: 1 },
    { sort: { nroRecibo: -1 } }
  );
  let seq = 1;
  if (ultimo?.nroRecibo) {
    const parts = ultimo.nroRecibo.split('-');
    seq = parseInt(parts[1] || '0') + 1;
  }
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

// GET /api/gestion/pagos?socioId=&page=&limit=
exports.getBySocio = async (req, res, next) => {
  try {
    const { socioId, page = 1, limit = 50 } = req.query;
    const sociedadId = req.user.sociedadId || req.user._id; // admin_sociedad or socio
    const filter = { sociedadId };
    if (socioId) filter.socioId = socioId;

    const pagos = await PagoCuota.find(filter)
      .populate('socioId', 'apellido nombre anilloCriador')
      .populate('competenciaId', 'nombre')
      .sort({ fechaPago: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await PagoCuota.countDocuments(filter);
    res.json({ pagos, total });
  } catch (err) { next(err); }
};

// GET /api/gestion/pagos/ultimo?socioId=
exports.getUltimoPago = async (req, res, next) => {
  try {
    const { socioId } = req.query;
    if (!socioId) return res.status(400).json({ error: 'socioId requerido' });

    const ultimo = await PagoCuota.findOne(
      { socioId, tipo: { $in: ['mensual', 'anual'] } },
      null,
      { sort: { fechaPago: -1 } }
    );

    let proximoMes = null, proximoAño = null;
    if (ultimo && ultimo.meses && ultimo.meses.length > 0) {
      // Encontrar el mes más reciente cubierto
      const sorted = [...ultimo.meses].sort((a, b) =>
        a.año !== b.año ? b.año - a.año : b.mes - a.mes
      );
      const { mes, año } = sorted[0];
      // Sugerir el siguiente mes
      if (mes === 12) { proximoMes = 1; proximoAño = año + 1; }
      else { proximoMes = mes + 1; proximoAño = año; }
    } else {
      // Si no hay pagos, sugerir mes actual
      const now = new Date();
      proximoMes = now.getMonth() + 1;
      proximoAño = now.getFullYear();
    }

    res.json({ ultimoPago: ultimo, proximoMes, proximoAño });
  } catch (err) { next(err); }
};

// POST /api/gestion/pagos
exports.create = async (req, res, next) => {
  try {
    const sociedadId = req.user.sociedadId;
    const nroRecibo = await generarNroRecibo(sociedadId);
    const pago = await PagoCuota.create({ ...req.body, sociedadId, nroRecibo });

    // Registrar como movimiento de ingreso en el estado de cuenta de la sociedad
    let concepto = '';
    if (pago.tipo === 'mensual') {
      const m = pago.meses?.[0];
      concepto = m ? `Cuota mensual ${m.mes}/${m.año}` : 'Cuota mensual';
    } else if (pago.tipo === 'anual') {
      concepto = `Cuota anual ${pago.meses?.[0]?.año || ''}`;
    } else if (pago.tipo === 'derecho_jaula') {
      concepto = pago.concepto || `Derecho de jaula (${pago.cantidadJaulas} jaulas)`;
    }
    // Obtener nombre del socio
    const socio = await Socio.findById(pago.socioId);
    if (socio) concepto += ` - ${socio.apellido}, ${socio.nombre}`;

    await MovimientoSociedad.create({
      sociedadId,
      tipo: 'ingreso',
      concepto: `Rec. ${nroRecibo} - ${concepto}`,
      monto: pago.monto,
      fecha: pago.fechaPago
    });

    const populated = await PagoCuota.findById(pago._id)
      .populate('socioId', 'apellido nombre anilloCriador')
      .populate('competenciaId', 'nombre');
    res.status(201).json(populated);
  } catch (err) { next(err); }
};

// PUT /api/gestion/pagos/:id
exports.update = async (req, res, next) => {
  try {
    const pago = await PagoCuota.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('socioId', 'apellido nombre anilloCriador');
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(pago);
  } catch (err) { next(err); }
};

// DELETE /api/gestion/pagos/:id
exports.remove = async (req, res, next) => {
  try {
    const pago = await PagoCuota.findByIdAndDelete(req.params.id);
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// GET /api/gestion/mi-estado  — para rol socio: obtiene su propio estado
exports.getMiEstado = async (req, res, next) => {
  try {
    const socio = await Socio.findOne({ userId: req.user._id });
    if (!socio) return res.status(404).json({ error: 'Perfil de socio no encontrado' });
    req.query.socioId = String(socio._id);
    return exports.getEstadoSocio(req, res, next);
  } catch (err) { next(err); }
};

// GET /api/gestion/estado-socio?socioId=
exports.getEstadoSocio = async (req, res, next) => {
  try {
    const { socioId } = req.query;
    if (!socioId) return res.status(400).json({ error: 'socioId requerido' });

    const pagos = await PagoCuota.find({ socioId })
      .populate('competenciaId', 'nombre')
      .sort({ fechaPago: 1 });

    // Calcular saldo / meses adeudados
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const añoActual = ahora.getFullYear();

    // Recopilar meses pagados (mensual/anual)
    const mesesPagados = new Set();
    let totalPagado = 0;
    for (const p of pagos) {
      totalPagado += p.monto;
      if (p.tipo === 'mensual' || p.tipo === 'anual') {
        for (const { mes, año } of p.meses || []) {
          mesesPagados.add(`${año}-${mes}`);
        }
      }
    }

    res.json({ pagos, mesesPagados: Array.from(mesesPagados), totalPagado });
  } catch (err) { next(err); }
};
