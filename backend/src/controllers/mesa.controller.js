const mongoose = require('mongoose');
const Mesa = require('../models/Mesa');
const Competencia = require('../models/Competencia');
const User = require('../models/User');
const Inscripcion = require('../models/Inscripcion');

exports.getByCompetencia = async (req, res, next) => {
  try {
    const { competenciaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(competenciaId)) {
      return res.status(400).json({ error: 'ID de competencia inválido' });
    }

    const mesas = await Mesa.find({
      competenciaId: new mongoose.Types.ObjectId(competenciaId)
    })
      .populate('juecesIds', 'nombre apellido codigo')
      .populate('operadorId', 'dni')
      .sort({ numero: 1 });

    res.json(mesas);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const mesa = await Mesa.findById(req.params.id)
      .populate('juecesIds', 'nombre apellido codigo')
      .populate('operadorId', 'dni')
      .populate('competenciaId', 'nombre estadoInscripcion');
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json(mesa);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { competenciaId, juecesIds, lotes, operadorDni, operadorPassword, jaulaDesde, jaulaHasta } = req.body;

    if (!competenciaId || !mongoose.Types.ObjectId.isValid(competenciaId)) {
      return res.status(400).json({ error: 'ID de competencia requerido e inválido' });
    }

    if (!operadorDni) {
      return res.status(400).json({ error: 'El DNI del operador es obligatorio' });
    }

    const competencia = await Competencia.findById(competenciaId);
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    // Número autoincremental por competencia
    const lastMesa = await Mesa.findOne({ competenciaId }).sort({ numero: -1 });
    const numero = (lastMesa?.numero || 0) + 1;

    // Crear o buscar usuario operador
    let operador = await User.findOne({ dni: operadorDni });
    if (!operador) {
      const passwordHash = await User.hashPassword(operadorPassword || operadorDni);
      operador = await User.create({ dni: operadorDni, passwordHash, role: 'operador' });
    } else {
      operador.role = 'operador';
      await operador.save();
    }

    const mesa = await Mesa.create({
      competenciaId,
      numero,
      juecesIds: Array.isArray(juecesIds) ? juecesIds.filter(Boolean) : [],
      lotes: lotes || [],
      operadorId: operador._id,
      jaulaDesde: jaulaDesde || null,
      jaulaHasta: jaulaHasta || null
    });

    const populated = await Mesa.findById(mesa._id)
      .populate('juecesIds', 'nombre apellido codigo')
      .populate('operadorId', 'dni');

    res.status(201).json(populated);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { juecesIds, lotes, operadorDni, operadorPassword, jaulaDesde, jaulaHasta } = req.body;
    const mesa = await Mesa.findById(req.params.id);
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    if (Array.isArray(juecesIds)) mesa.juecesIds = juecesIds.filter(Boolean);
    if (lotes !== undefined) mesa.lotes = lotes;
    if (jaulaDesde !== undefined) mesa.jaulaDesde = jaulaDesde;
    if (jaulaHasta !== undefined) mesa.jaulaHasta = jaulaHasta;

    if (operadorDni) {
      let operador = await User.findOne({ dni: operadorDni });
      if (!operador) {
        const passwordHash = await User.hashPassword(operadorPassword || operadorDni);
        operador = await User.create({ dni: operadorDni, passwordHash, role: 'operador' });
      } else {
        operador.role = 'operador';
        await operador.save();
      }
      mesa.operadorId = operador._id;
    }

    await mesa.save();
    const populated = await Mesa.findById(mesa._id)
      .populate('juecesIds', 'nombre apellido codigo')
      .populate('operadorId', 'dni');
    res.json(populated);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const mesa = await Mesa.findByIdAndDelete(req.params.id);
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json({ message: 'Mesa eliminada' });
  } catch (err) { next(err); }
};

// Pantalla de jura: inscripciones del rango de jaulas del operador
exports.getJuraData = async (req, res, next) => {
  try {
    const mesa = await Mesa.findById(req.params.id)
      .populate('competenciaId', 'nombre estadoInscripcion')
      .populate('juecesIds', 'nombre apellido');

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    // Verificar que el operador autenticado es el de esta mesa
    if (req.user.role === 'operador' &&
        mesa.operadorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'No tiene acceso a esta mesa' });
    }

    // Filtro: lotes asignados O rango de jaulas
    const filter = { competenciaId: mesa.competenciaId._id };

    if (mesa.lotes && mesa.lotes.length > 0) {
      const codigos = mesa.lotes.map(l => l.codigoNomenclador);
      filter.codigoNomenclador = { $in: codigos };
    } else if (mesa.jaulaDesde && mesa.jaulaHasta) {
      filter.numJaula = { $gte: mesa.jaulaDesde, $lte: mesa.jaulaHasta };
    }

    const inscripciones = await Inscripcion.find(filter)
      .populate('socioId', 'nombre apellido anilloCriador')
      .sort({ numJaula: 1, lote: 1 });

    res.json({ mesa, inscripciones });
  } catch (err) { next(err); }
};

/**
 * Actualiza el estado de un lote de la mesa.
 *
 * Reglas de transición:
 *   operador          : abierto → cerrado  |  abierto → jurado
 *   admin_sociedad /
 *   admin_general     : abierto → cerrado  |  abierto → jurado  |  cualquier → abierto
 *                       (no se permite cerrado → jurado ni jurado → cerrado directamente)
 *
 * Body: { loteKey: string, estado: 'abierto'|'cerrado'|'jurado' }
 */
exports.actualizarEstadoLote = async (req, res, next) => {
  try {
    const { loteKey, estado } = req.body;
    const ESTADOS_VALIDOS = ['abierto', 'cerrado', 'jurado'];
    if (!loteKey || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'loteKey y estado (abierto|cerrado|jurado) son requeridos' });
    }

    const mesa = await Mesa.findById(req.params.id);
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    const estadoActual = mesa.estadoLotes?.get(loteKey) || 'abierto';
    const esAdmin = req.user.role === 'admin_general' || req.user.role === 'admin_sociedad';

    if (req.user.role === 'operador') {
      if (mesa.operadorId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'No tiene acceso a esta mesa' });
      }
      // Operador: jurado es terminal para él; solo puede avanzar desde abierto
      if (estadoActual === 'jurado') {
        return res.status(403).json({ error: 'Un lote jurado no puede cambiar de estado' });
      }
      if (estadoActual !== 'abierto') {
        return res.status(403).json({ error: 'El operador solo puede cambiar lotes que están abiertos' });
      }
      if (estado === 'abierto') {
        return res.status(403).json({ error: 'Solo el administrador puede reabrir un lote' });
      }
    } else if (esAdmin) {
      // Admin: transiciones permitidas:
      //   abierto  → cerrado | jurado
      //   cerrado  → abierto
      //   jurado   → abierto
      // Bloqueado: cerrado → jurado  |  jurado → cerrado  (salvo pasar por abierto)
      const transicionBloqueada =
        (estadoActual === 'cerrado' && estado === 'jurado') ||
        (estadoActual === 'jurado'  && estado === 'cerrado');
      if (transicionBloqueada) {
        return res.status(400).json({
          error: `No se puede cambiar directamente de "${estadoActual}" a "${estado}". Primero reabrir el lote.`
        });
      }
    }

    mesa.estadoLotes.set(loteKey, estado);
    mesa.markModified('estadoLotes');
    await mesa.save();

    res.json({ loteKey, estado });
  } catch (err) { next(err); }
};

/**
 * Cambia el estado de todos los lotes de todas las mesas de una competencia.
 * Body: { estado: 'abierto' | 'cerrado' | 'jurado' }  (default: 'abierto')
 * Solo administradores.
 */
exports.abrirTodosLotes = async (req, res, next) => {
  try {
    const { competenciaId } = req.params;
    const { estado = 'abierto' } = req.body;
    const ESTADOS_VALIDOS = ['abierto', 'cerrado', 'jurado'];

    if (!mongoose.Types.ObjectId.isValid(competenciaId)) {
      return res.status(400).json({ error: 'ID de competencia inválido' });
    }

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'estado debe ser abierto, cerrado o jurado' });
    }

    const mesas = await Mesa.find({
      competenciaId: new mongoose.Types.ObjectId(competenciaId)
    });

    const updates = mesas.map(mesa => {
      // Iterar sobre todos los lotes asignados
      for (const lote of (mesa.lotes || [])) {
        const loteKey = `${lote.codigoNomenclador} - ${(lote.tipoPresentacion || 'todos').toUpperCase()}`;
        const estadoActual = mesa.estadoLotes.get(loteKey) || 'abierto';
        if (estadoActual !== 'jurado') {
          mesa.estadoLotes.set(loteKey, estado);
        }
      }
      // También actualizar claves ya en el mapa (lotes anteriores), respetando jurado
      for (const [key, val] of mesa.estadoLotes.entries()) {
        if (val !== 'jurado') {
          mesa.estadoLotes.set(key, estado);
        }
      }
      mesa.markModified('estadoLotes');
      return mesa.save();
    });
    await Promise.all(updates);

    res.json({ message: `${mesas.length} mesa(s) actualizadas a "${estado}"` });
  } catch (err) { next(err); }
};

// Devuelve la mesa asignada al operador autenticado.
// Prioriza la mesa cuya competencia esté abierta o cerrada (no juzgada/finalizada).
// Si hay varias, devuelve la más reciente.
exports.getMiMesa = async (req, res, next) => {
  try {
    // Trae todas las mesas del operador con su competencia populada
    const mesas = await Mesa.find({ operadorId: req.user._id })
      .populate('competenciaId', 'nombre estadoInscripcion estadoCompetencia')
      .sort({ updatedAt: -1 })
      .lean();

    if (!mesas.length) return res.status(404).json({ error: 'No tiene una mesa asignada' });

    // Priorizar la primera mesa de una competencia abierta o cerrada
    const activa = mesas.find(m =>
      m.competenciaId &&
      ['abierta', 'cerrada'].includes(m.competenciaId.estadoInscripcion)
    );

    res.json(activa || mesas[0]);
  } catch (err) { next(err); }
};

exports.guardarPuntaje = async (req, res, next) => {
  try {
    const { inscripcionId, puntaje, premios } = req.body;
    const mesa = await Mesa.findById(req.params.id);
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    if (req.user.role === 'operador' &&
        mesa.operadorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'No tiene acceso a esta mesa' });
    }

    const inscripcion = await Inscripcion.findById(inscripcionId);
    if (!inscripcion) return res.status(404).json({ error: 'Inscripción no encontrada' });

    if (puntaje !== undefined) {
      if (puntaje !== null && (typeof puntaje !== 'number' || puntaje < 0 || puntaje > 100)) {
        return res.status(400).json({ error: 'El puntaje debe ser un número entre 0 y 100' });
      }
      inscripcion.puntaje = puntaje;
    }
    if (premios !== undefined) inscripcion.premios = premios;
    await inscripcion.save();

    res.json(inscripcion);
  } catch (err) { next(err); }
};

// Devuelve el conjunto de loteKeys (formato "codigo - tipoPresentacion") que
// tienen estado 'jurado' en cualquiera de las mesas de la competencia.
// Accesible para todos los roles autenticados.
exports.getLotesJurados = async (req, res, next) => {
  try {
    const { competenciaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(competenciaId)) {
      return res.status(400).json({ error: 'ID de competencia inválido' });
    }

    const mesas = await Mesa.find({
      competenciaId: new mongoose.Types.ObjectId(competenciaId)
    }).select('estadoLotes').lean();
    const lotesJurados = [];
    for (const mesa of mesas) {
      if (!mesa.estadoLotes) continue;
      // Tras .lean() el Map queda como objeto plano
      for (const [key, estado] of Object.entries(mesa.estadoLotes)) {
        if (estado === 'jurado') lotesJurados.push(key);
      }
    }
    res.json({ lotesJurados: [...new Set(lotesJurados)] });
  } catch (err) { next(err); }
};
