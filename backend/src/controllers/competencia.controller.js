const mongoose = require('mongoose');
const Competencia = require('../models/Competencia');
const Inscripcion = require('../models/Inscripcion');
const Socio       = require('../models/Socio');
const Sociedad    = require('../models/Sociedad');
const Federacion  = require('../models/Federacion');

/**
 * Construye el filtro de visibilidad de competencias según el rol del usuario.
 *
 * admin_general : ve todo.
 * admin_sociedad: ve las competencias propias + abierto/mundial de cualquier sociedad
 *                 + nacionales de su federación (si tiene).
 * otros         : sin filtro (acceso controlado por rutas).
 *
 * Se recibe la federación de la sociedad del usuario para evitar una consulta extra
 * en cada request; se pasa null cuando no se conoce aún.
 */
const buildCompetenciaFilter = (user, federacionPropia = null) => {
  if (user.role !== 'admin_sociedad') return {};

  const sid = user.sociedadId;

  // Siempre ve sus propias competencias
  const condiciones = [{ sociedadId: sid }];

  // Ve abierto y mundial de cualquier sociedad
  condiciones.push({ tipoCompetencia: { $in: ['abierto', 'mundial'] } });

  // Ve nacionales de su federación (si tiene una)
  if (federacionPropia) {
    condiciones.push({
      tipoCompetencia: 'nacional',
      _sociedadFederacion: federacionPropia  // se resuelve vía lookup; ver getAll
    });
  }

  return { $or: condiciones };
};

/**
 * Devuelve el filtro Mongoose para listar competencias visibles para el usuario.
 *
 * admin_sociedad ve:
 *   - Competencias propias (clasica/abierto de su sociedad)
 *   - Todas las de tipo 'abierto' (cualquier sociedad)
 *   - Todas las de tipo 'mundial'
 *   - Nacionales cuya federacionId coincide con la federación de su sociedad
 */
const getCompetenciaFilter = async (user, extraFilters = {}) => {
  if (user.role !== 'admin_sociedad') return { ...extraFilters };

  const sid = user.sociedadId;

  const condiciones = [
    { sociedadId: sid },
    { tipoCompetencia: 'abierto' },
    { tipoCompetencia: 'mundial' }
  ];

  // Nacionales: buscar la Federacion doc cuyo codigo coincide con la federación de la sociedad
  const sociedadUsuario = await Sociedad.findById(sid).select('federacion').lean();
  const fedCodigo = sociedadUsuario?.federacion?.trim().toUpperCase();
  if (fedCodigo) {
    const fedDoc = await Federacion.findOne({
      codigo: { $regex: new RegExp(`^${fedCodigo}$`, 'i') }
    }).select('_id').lean();
    if (fedDoc) {
      condiciones.push({ tipoCompetencia: 'nacional', federacionId: fedDoc._id });
    }
  }

  return { $or: condiciones, ...extraFilters };
};

/**
 * Verifica si un admin_sociedad puede acceder a una competencia concreta.
 *
 * - abierto / mundial : siempre
 * - clasica           : solo si es su propia sociedad
 * - nacional          : si la federacionId de la competencia coincide con la federación de su sociedad
 */
const adminSociedadPuedeAcceder = async (competencia, user) => {
  const tipo = competencia.tipoCompetencia;

  if (tipo === 'abierto' || tipo === 'mundial') return true;

  // Competencia propia (clasica u abierto de su sociedad)
  const orgId = competencia.sociedadId?._id ?? competencia.sociedadId;
  if (orgId?.toString() === user.sociedadId?.toString()) return true;

  if (tipo === 'nacional') {
    const fedId = competencia.federacionId?._id ?? competencia.federacionId;
    if (!fedId) return false;
    const [fedDoc, socUser] = await Promise.all([
      Federacion.findById(fedId).select('codigo').lean(),
      Sociedad.findById(user.sociedadId).select('federacion').lean()
    ]);
    const codFed = fedDoc?.codigo?.trim().toUpperCase();
    const codSoc = socUser?.federacion?.trim().toUpperCase();
    return !!(codFed && codFed === codSoc);
  }

  return false;
};

// ─── Helpers para cerrar inscripción ────────────────────────────────────────

/**
 * Fisher-Yates shuffle in-place.
 */
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

/**
 * Agrupa las inscripciones por lote (codigoNomenclador + tipoPresentacion).
 * Orden: tipoNomenclador (color=0, forma=1) → codigoNomenclador alfabético
 *        → tipoPresentacion (individual=0, duos=1, cuartetos=2).
 *
 * Ejemplo: "BL Blanco Individuales", "BL Blanco Dúos", "BL Blanco Cuartetos".
 */
const TIPO_PRES_ORD = { individual: 0, duos: 1, cuartetos: 2 };

const agruparPorLote = (inscripciones) => {
  const mapa = new Map();
  for (const insc of inscripciones) {
    const tipoNomenOrd = insc.tipoNomenclador === 'color' ? '0' : '1';
    const tipoPresOrd  = TIPO_PRES_ORD[insc.tipoPresentacion] ?? 0;
    const key = `${tipoNomenOrd}:${insc.codigoNomenclador}:${tipoPresOrd}`;
    if (!mapa.has(key)) {
      mapa.set(key, {
        tipoNomenclador: insc.tipoNomenclador,
        codigoNomenclador: insc.codigoNomenclador,
        tipoPresentacion: insc.tipoPresentacion,
        inscripciones: []
      });
    }
    mapa.get(key).inscripciones.push(insc);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, lote]) => lote);
};

/**
 * Construye las "unidades" de un lote.
 * - Individual: cada inscripción es una unidad de tamaño 1.
 * - Dúo / Cuarteto: todas las inscripciones del mismo grupoPresentacion
 *   forman una unidad que recibe números consecutivos.
 *   Dentro del grupo: no-suplentes primero, luego por numAnillo.
 */
const construirUnidades = (inscripciones) => {
  const gruposMapa = new Map();
  const individuales = [];

  for (const insc of inscripciones) {
    if (insc.grupoPresentacion) {
      if (!gruposMapa.has(insc.grupoPresentacion)) {
        gruposMapa.set(insc.grupoPresentacion, []);
      }
      gruposMapa.get(insc.grupoPresentacion).push(insc);
    } else {
      individuales.push(insc);
    }
  }

  const unidades = [];

  for (const insc of individuales) {
    unidades.push({
      socioKey: insc.socioId?.toString() || insc.numCriador,
      esGrupo: false,
      inscripciones: [insc]
    });
  }

  for (const [, grupo] of gruposMapa) {
    grupo.sort((a, b) => {
      if (a.esSuplente !== b.esSuplente) return a.esSuplente ? 1 : -1;
      return a.numAnillo.localeCompare(b.numAnillo);
    });
    unidades.push({
      socioKey: grupo[0].socioId?.toString() || grupo[0].numCriador,
      esGrupo: true,
      inscripciones: grupo
    });
  }

  return unidades;
};

/**
 * Evita que dos unidades de tipo grupo (dúo/cuarteto) del mismo socio
 * queden en posiciones consecutivas.
 * Estrategia: múltiples pasadas de intercambio hasta que no haya conflictos
 * o se agoten los intentos (edge case: imposible separar con los candidatos disponibles).
 */
const separarGruposConsecutivos = (unidades) => {
  const MAX_PASADAS = unidades.length + 5;

  for (let pasada = 0; pasada < MAX_PASADAS; pasada++) {
    let huboCambio = false;

    for (let i = 0; i < unidades.length - 1; i++) {
      const actual = unidades[i];
      const siguiente = unidades[i + 1];

      if (!actual.esGrupo || !siguiente.esGrupo) continue;
      if (actual.socioKey !== siguiente.socioKey) continue;

      // Buscar el primer j > i+1 cuyo socioKey sea distinto al conflictivo
      let j = i + 2;
      while (j < unidades.length && unidades[j].esGrupo && unidades[j].socioKey === actual.socioKey) {
        j++;
      }

      if (j < unidades.length) {
        [unidades[i + 1], unidades[j]] = [unidades[j], unidades[i + 1]];
        huboCambio = true;
      }
      // Si no hay candidato disponible (todos son del mismo socio), se deja como está.
    }

    if (!huboCambio) break;
  }
};

/**
 * Histórico: competencias juzgadas, filtrables por año y sociedad.
 * Accesible por admin_general, admin_sociedad y socio.
 */
/**
 * Competencias en las que el socio autenticado tiene inscripciones.
 */
exports.getMisCompetencias = async (req, res, next) => {
  try {
    const socio = await Socio.findOne({ userId: req.user._id }).select('_id').lean();
    if (!socio) return res.status(403).json({ error: 'Socio no encontrado' });

    const inscripciones = await Inscripcion.find({ socioId: socio._id })
      .select('competenciaId')
      .lean();

    const ids = [...new Set(inscripciones.map(i => i.competenciaId.toString()))];

    const competencias = await Competencia.find({ _id: { $in: ids } })
      .populate('sociedadId',   'nombre codigo')
      .populate('federacionId', 'nombre codigo')
      .sort({ fecha: -1 });

    res.json(competencias);
  } catch (err) { next(err); }
};

exports.getHistorico = async (req, res, next) => {
  try {
    const { anio, sociedadId } = req.query;
    const filter = { estadoCompetencia: 'finalizada' };

    if (req.user.role === 'admin_sociedad') {
      // Mostrar todas las competencias de la misma federación
      const sociedadUsuario = await Sociedad.findById(req.user.sociedadId).select('federacion').lean();
      const federacion = sociedadUsuario?.federacion;
      if (federacion) {
        const sociedadesFed = await Sociedad.find({ federacion }).select('_id').lean();
        filter.sociedadId = { $in: sociedadesFed.map(s => s._id) };
      } else {
        filter.sociedadId = req.user.sociedadId;
      }
    } else if (req.user.role === 'admin_general' && sociedadId) {
      filter.sociedadId = new mongoose.Types.ObjectId(sociedadId);
    }

    if (anio) {
      const y = parseInt(anio);
      filter.fecha = { $gte: new Date(`${y}-01-01`), $lte: new Date(`${y}-12-31`) };
    }

    const competencias = await Competencia.find(filter)
      .populate('sociedadId', 'nombre codigo')
      .populate('juezId', 'nombre apellido codigo')
      .sort({ fecha: -1 });

    res.json(competencias);
  } catch (err) { next(err); }
};

exports.finalizarCompetencia = async (req, res, next) => {
  try {
    const competencia = await Competencia.findById(req.params.id);
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    if (req.user.role === 'admin_sociedad' &&
        competencia.sociedadId.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
    }

    competencia.estadoCompetencia = 'finalizada';
    await competencia.save();
    res.json(competencia);
  } catch (err) { next(err); }
};

exports.reabrirCompetencia = async (req, res, next) => {
  try {
    const competencia = await Competencia.findById(req.params.id);
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    if (req.user.role === 'admin_sociedad' &&
        competencia.sociedadId.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
    }

    competencia.estadoCompetencia = 'en_curso';
    await competencia.save();
    res.json(competencia);
  } catch (err) { next(err); }
};

/**
 * Resultados detallados de una competencia juzgada.
 * Los socios solo ven sus propios resultados; admins ven todo.
 */
exports.getResultadosHistorico = async (req, res, next) => {
  try {
    const { competenciaId } = req.params;

    const competencia = await Competencia.findById(competenciaId)
      .populate('sociedadId', 'nombre codigo')
      .populate('juezId', 'nombre apellido');
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    const filter = { competenciaId: competencia._id };

    // Socios solo ven sus propios registros
    if (req.user.role === 'socio' && req.user.socioId) {
      filter.socioId = req.user.socioId;
    }

    const inscripciones = await Inscripcion.find(filter)
      .populate('socioId', 'nombre apellido anilloCriador')
      .sort({ lote: 1, numJaula: 1 });

    res.json({ competencia, inscripciones });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const extra = {};
    if (req.query.sociedadId && req.user.role === 'admin_general') {
      extra.sociedadId = req.query.sociedadId;
    }
    if (req.query.estadoInscripcion) extra.estadoInscripcion = req.query.estadoInscripcion;

    const filter = await getCompetenciaFilter(req.user, extra);

    const competencias = await Competencia.find(filter)
      .populate('sociedadId',   'nombre codigo')
      .populate('federacionId', 'nombre codigo')
      .populate('juezId',       'nombre apellido codigo')
      .sort({ fecha: -1, createdAt: -1 });
    res.json(competencias);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const competencia = await Competencia.findById(req.params.id)
      .populate('sociedadId',   'nombre codigo provincia')
      .populate('federacionId', 'nombre codigo')
      .populate('juezId',       'nombre apellido codigo');
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    if (req.user.role === 'admin_sociedad') {
      const puedeAcceder = await adminSociedadPuedeAcceder(competencia, req.user);
      if (!puedeAcceder) {
        return res.status(403).json({ error: 'Sin acceso a esta competencia' });
      }
    }

    // Socio: solo puede ver competencias en las que participó
    if (req.user.role === 'socio') {
      const socio = await Socio.findOne({ userId: req.user._id }).select('_id').lean();
      if (!socio) return res.status(403).json({ error: 'Socio no encontrado' });
      const participo = await Inscripcion.exists({ competenciaId: competencia._id, socioId: socio._id });
      if (!participo) return res.status(403).json({ error: 'Sin acceso a esta competencia' });
    }

    res.json(competencia);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      nombre, descripcion, fecha, lugar,
      tipoCompetencia, maxIndividuales, maxDuos, maxCuartetos
    } = req.body;

    const esNacMun = ['nacional', 'mundial'].includes(tipoCompetencia);

    const sociedadId = esNacMun ? null : (
      req.user.role === 'admin_sociedad'
        ? req.user.sociedadId
        : (req.body.sociedadId || null)
    );
    const federacionId = esNacMun ? (req.body.federacionId || null) : null;

    const competencia = await Competencia.create({
      nombre, descripcion, fecha, lugar,
      sociedadId, federacionId,
      tipoCompetencia, maxIndividuales, maxDuos, maxCuartetos
    });
    res.status(201).json(competencia);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const {
      nombre, descripcion, fecha, lugar, estadoInscripcion,
      tipoCompetencia, maxIndividuales, maxDuos, maxCuartetos
    } = req.body;

    const competencia = await Competencia.findById(req.params.id);
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    if (req.user.role === 'admin_sociedad' &&
        competencia.sociedadId?.toString() !== req.user.sociedadId?.toString()) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
    }

    if (nombre            !== undefined) competencia.nombre            = nombre;
    if (descripcion       !== undefined) competencia.descripcion       = descripcion;
    if (lugar             !== undefined) competencia.lugar             = lugar;
    if (tipoCompetencia   !== undefined) competencia.tipoCompetencia   = tipoCompetencia;
    if (maxIndividuales   !== undefined) competencia.maxIndividuales   = maxIndividuales;
    if (maxDuos           !== undefined) competencia.maxDuos           = maxDuos;
    if (maxCuartetos      !== undefined) competencia.maxCuartetos      = maxCuartetos;
    if (estadoInscripcion !== undefined) competencia.estadoInscripcion = estadoInscripcion;
    // fecha: solo asignar si viene un valor no vacío para evitar cast error de Mongoose
    if (fecha) competencia.fecha = fecha;
    else if (fecha === '') competencia.fecha = null;

    if (req.user.role === 'admin_general') {
      const esNacMun = ['nacional', 'mundial'].includes(tipoCompetencia);
      if (esNacMun) {
        competencia.federacionId = req.body.federacionId || null;
        competencia.sociedadId   = null;
      } else {
        competencia.sociedadId   = req.body.sociedadId || null;
        competencia.federacionId = null;
      }
    }

    await competencia.save();
    res.json(competencia);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const competencia = await Competencia.findById(req.params.id);
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    if (req.user.role === 'admin_sociedad' &&
        competencia.sociedadId.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
    }

    await Competencia.findByIdAndDelete(req.params.id);
    res.json({ message: 'Competencia eliminada' });
  } catch (err) { next(err); }
};

/**
 * Cerrar inscripción: asigna números de jaula con orden de lotes fijo y posición aleatoria
 * dentro de cada lote. Los dúos/cuartetos reciben números consecutivos; grupos del mismo
 * socio no quedan consecutivos entre sí.
 *
 * Numeración: global 1..N, procesando los lotes en orden (color→forma, luego código).
 */
exports.cerrarInscripcion = async (req, res, next) => {
  try {
    const competencia = await Competencia.findById(req.params.id);
    if (!competencia) return res.status(404).json({ error: 'Competencia no encontrada' });

    if (req.user.role === 'admin_sociedad' &&
        competencia.sociedadId.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
    }

    if (competencia.estadoInscripcion === 'juzgada') {
      return res.status(400).json({ error: 'La competencia ya fue juzgada' });
    }

    const inscripciones = await Inscripcion.find({ competenciaId: competencia._id })
      .select('_id tipoNomenclador codigoNomenclador grupoPresentacion numAnillo esSuplente socioId numCriador tipoPresentacion');

    if (inscripciones.length === 0) {
      competencia.estadoInscripcion = 'cerrada';
      await competencia.save();
      return res.json({ message: 'Inscripción cerrada. Sin jaulas a numerar.', totalJaulas: 0 });
    }

    // 1. Agrupar por lote respetando el orden del nomenclador
    const lotes = agruparPorLote(inscripciones);

    // 2. Por lote: construir unidades → mezclar → separar grupos mismos socio
    const bulkOps = [];
    let jaulaGlobal = 1;

    for (const lote of lotes) {
      const unidades = construirUnidades(lote.inscripciones);

      // Mezcla aleatoria de las unidades del lote
      shuffle(unidades);

      // Separar grupos (dúo/cuarteto) del mismo socio para que no queden consecutivos
      separarGruposConsecutivos(unidades);

      // Asignar numeración global consecutiva dentro del lote
      for (const unidad of unidades) {
        for (const insc of unidad.inscripciones) {
          bulkOps.push({
            updateOne: {
              filter: { _id: insc._id },
              update: { $set: { numJaula: jaulaGlobal++ } }
            }
          });
        }
      }
    }

    if (bulkOps.length > 0) {
      await Inscripcion.bulkWrite(bulkOps);
    }

    competencia.estadoInscripcion = 'cerrada';
    await competencia.save();

    res.json({
      message: `Inscripción cerrada. ${bulkOps.length} jaulas numeradas.`,
      totalJaulas: bulkOps.length
    });
  } catch (err) { next(err); }
};
