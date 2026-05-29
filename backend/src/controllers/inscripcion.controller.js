const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const Inscripcion = require("../models/Inscripcion");
const Competencia = require("../models/Competencia");
const Socio = require("../models/Socio");
const NomencladorColor = require("../models/NomencladorColor");
const NomencladorForma = require("../models/NomencladorForma");
const Sociedad   = require("../models/Sociedad");
const Federacion = require("../models/Federacion");

const getNomenclador = async (tipo, codigo) => {
  const Model = tipo === "color" ? NomencladorColor : NomencladorForma;
  return Model.findOne({ codigo: codigo.toUpperCase() });
};

/**
 * Cuenta grupos (presentaciones) de un tipo ya inscriptos por un socio
 * para una competencia y código de nomenclador específicos.
 * Un dúo o cuarteto cuenta como 1 grupo sin importar cuántos anillos tenga.
 */
const contarGrupos = async (competenciaId, socioId, tipoPresentacion, codigoNomenclador) => {
  const result = await Inscripcion.aggregate([
    {
      $match: {
        competenciaId: new mongoose.Types.ObjectId(competenciaId),
        socioId,
        tipoPresentacion,
        codigoNomenclador: codigoNomenclador.toUpperCase(),
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$grupoPresentacion", "$_id"] },
      },
    },
    { $count: "total" },
  ]);
  return result[0]?.total || 0;
};

/**
 * Valida que el socio no supere el máximo de grupos por tipo de presentación
 * dentro de la misma combinación competencia + socio + tipo + codigoNomenclador.
 */
const validarMaximos = async (competencia, socioId, tipoPresentacion, codigoNomenclador) => {
  const maxField = {
    individual: competencia.maxIndividuales,
    duos: competencia.maxDuos,
    cuartetos: competencia.maxCuartetos,
  }[tipoPresentacion];
  if (!maxField || maxField === "libre") return null;

  const max = parseInt(maxField);
  const grupos = await contarGrupos(competencia._id, socioId, tipoPresentacion, codigoNomenclador);
  if (grupos >= max) {
    return `El socio ya alcanzó el máximo de ${max} presentación/es de tipo "${tipoPresentacion}" para el código de lote "${codigoNomenclador}"`;
  }
  return null;
};

/**
 * Construye el array canónico de anillos a inscribir a partir del body.
 * Filtra blancos, normaliza a mayúsculas y aplica padding de ceros a la izquierda (4 dígitos).
 * Devuelve [{ numAnillo, esSuplente }]
 */
const construirAnillos = (numAnillo, anillosAdicionales, tipoPresentacion) => {
  const principal = numAnillo?.trim() ? normalizarNumAnillo(numAnillo) : null;
  const adicionales = (anillosAdicionales || [])
    .filter((a) => a.numAnillo?.trim())
    .map((a) => ({
      numAnillo: normalizarNumAnillo(a.numAnillo),
      esSuplente: !!a.esSuplente,
    }));

  const anillos = [];
  if (principal) anillos.push({ numAnillo: principal, esSuplente: false });
  anillos.push(...adicionales);
  return anillos;
};

/**
 * Normaliza un número de anillo: máximo 4 caracteres, relleno con ceros a la izquierda.
 * Ejemplo: "7" → "0007", "45" → "0045", "1234" → "1234".
 */
const normalizarNumAnillo = (valor) => {
  const limpio = String(valor).trim().toUpperCase().slice(0, 4);
  return limpio.padStart(4, "0");
};

/**
 * Valida que la cantidad de anillos requeridos (no suplentes) sea la correcta según el tipo.
 */
const validarCantidadAnillos = (anillos, tipoPresentacion) => {
  const requeridos = anillos.filter((a) => !a.esSuplente).length;
  if (tipoPresentacion === "individual" && requeridos !== 1) {
    return "Individual requiere exactamente 1 anillo";
  }
  if (tipoPresentacion === "duos" && requeridos !== 2) {
    return "Dúos requiere exactamente 2 anillos";
  }
  if (tipoPresentacion === "cuartetos" && requeridos !== 4) {
    return "Cuartetos requiere exactamente 4 anillos (el suplente es opcional)";
  }
  return null;
};

// ─── EXPORTS ────────────────────────────────────────────────────────────────

exports.getAll = async (req, res, next) => {
  try {
    const { competenciaId, lote, numCriador, groupByLote } = req.query;
    if (!competenciaId)
      return res.status(400).json({ error: "competenciaId es requerido" });

    const filter = { competenciaId };
    if (lote) filter.lote = lote.toUpperCase();
    if (numCriador) filter.numCriador = numCriador.toUpperCase();

    // Socios solo ven sus propias inscripciones
    if (req.user.role === "socio") {
      const socio = await Socio.findOne({ userId: req.user._id }).select("_id").lean();
      if (!socio) return res.status(403).json({ error: "Socio no encontrado" });
      filter.socioId = socio._id;
    }

    if (groupByLote === "true") {
      const matchStage = { competenciaId: new mongoose.Types.ObjectId(competenciaId) };
      if (filter.socioId) matchStage.socioId = filter.socioId;

      const grouped = await Inscripcion.aggregate([
        { $match: matchStage },
        { $sort: { numJaula: 1, lote: 1, numCriador: 1 } },
        {
          $group: {
            _id: "$lote",
            nombreNomenclador: { $first: "$nombreNomenclador" },
            tipoNomenclador: { $first: "$tipoNomenclador" },
            items: { $push: "$$ROOT" },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      return res.json(grouped);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const [inscripciones, total] = await Promise.all([
      Inscripcion.find(filter)
        .populate("socioId", "nombre apellido anilloCriador")
        .sort({ numJaula: 1, lote: 1, numCriador: 1 })
        .skip(skip)
        .limit(limit),
      Inscripcion.countDocuments(filter),
    ]);

    res.json({ inscripciones, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const inscripcion = await Inscripcion.findById(req.params.id)
      .populate("socioId", "nombre apellido anilloCriador")
      .populate("competenciaId", "nombre estadoInscripcion");
    if (!inscripcion)
      return res.status(404).json({ error: "Inscripción no encontrada" });
    res.json(inscripcion);
  } catch (err) {
    next(err);
  }
};

exports.buscarSocio = async (req, res, next) => {
  try {
    const { q, sociedadId } = req.query;
    if (!q || q.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Ingrese al menos 2 caracteres para buscar" });
    }

    const terminos = q.trim().toUpperCase().split(/\s+/).filter(Boolean);
    const filter = { activo: true };

    if (req.user.role === "admin_sociedad") {
      filter.sociedadId = req.user.sociedadId;
    } else if (sociedadId) {
      filter.sociedadId = new mongoose.Types.ObjectId(sociedadId);
    }

    // Si es un único término, buscar por anillo exacto primero
    if (terminos.length === 1) {
      const socios = await Socio.find({ ...filter, anilloCriador: terminos[0] })
        .populate("sociedadId", "nombre codigo federacion")
        .limit(5);
      if (socios.length > 0) return res.json(socios);
    }

    // Búsqueda AND: cada término debe aparecer en apellido, nombre o anillo
    const andConditions = terminos.map(t => {
      const regex = new RegExp(t, "i");
      return { $or: [{ apellido: regex }, { nombre: regex }, { anilloCriador: regex }] };
    });

    const socios = await Socio.find({ ...filter, $and: andConditions })
      .populate("sociedadId", "nombre codigo federacion")
      .limit(10);

    res.json(socios);
  } catch (err) {
    next(err);
  }
};

/**
 * Crea un registro independiente por cada anillo ingresado.
 * Todos los anillos del mismo dúo/cuarteto comparten grupoPresentacion.
 *
 * Respuesta: { creados: [...], rechazados: [{ numAnillo, motivo }] }
 */
exports.create = async (req, res, next) => {
  try {
    const {
      competenciaId,
      numCriador,
      tipoNomenclador,
      codigoNomenclador,
      numAnillo,
      anillosAdicionales,
      tipoPresentacion,
      observaciones,
      anioAnillo,
    } = req.body;

    // 1. Validar competencia
    const competencia = await Competencia.findById(competenciaId);
    if (!competencia)
      return res.status(404).json({ error: "Competencia no encontrada" });
    if (competencia.estadoInscripcion !== "abierta") {
      return res
        .status(400)
        .json({ error: "La competencia no está abierta para inscripciones" });
    }

    // Verificar acceso del admin_sociedad según tipo de competencia:
    //   abierto / mundial → cualquier admin_sociedad puede inscribir
    //   nacional          → solo admins cuya sociedad pertenece a la federacionId de la competencia
    //   clasica           → solo el admin de la sociedad organizadora
    if (req.user.role === "admin_sociedad") {
      const tipo = competencia.tipoCompetencia;

      if (tipo === "abierto" || tipo === "mundial") {
        // acceso universal — no se necesita verificación adicional
      } else if (tipo === "clasica") {
        if (competencia.sociedadId?.toString() !== req.user.sociedadId?.toString()) {
          return res.status(403).json({ error: "Sin acceso a esta competencia" });
        }
      } else if (tipo === "nacional") {
        const fedId = competencia.federacionId?._id ?? competencia.federacionId;
        if (!fedId) {
          return res.status(403).json({ error: "Competencia nacional sin federación asignada" });
        }
        const [fedDoc, socUser] = await Promise.all([
          Federacion.findById(fedId).select("codigo").lean(),
          Sociedad.findById(req.user.sociedadId).select("federacion").lean()
        ]);
        const codFed  = fedDoc?.codigo?.trim().toUpperCase();
        const codSoc  = socUser?.federacion?.trim().toUpperCase();
        if (!(codFed && codFed === codSoc)) {
          return res.status(403).json({
            error: "Sin acceso a esta competencia: no pertenece a la federación organizadora"
          });
        }
      } else {
        return res.status(403).json({ error: "Sin acceso a esta competencia" });
      }
    }
    const esAccesoUniversal = ["abierto", "mundial"].includes(competencia.tipoCompetencia);

    // 2. Validar nomenclador
    const nomen = await getNomenclador(tipoNomenclador, codigoNomenclador);
    if (!nomen)
      return res.status(400).json({ error: "Código de nomenclador no existe" });

    // 3. Validar socio (obligatorio)
    const socio = await Socio.findOne({
      anilloCriador: numCriador.trim().toUpperCase(),
    });
    if (!socio) {
      return res.status(400).json({
        error: `El criador "${numCriador.trim().toUpperCase()}" no está registrado en la base de datos`,
      });
    }
    // En eventos abiertos/mundiales el admin puede inscribir socios de cualquier sociedad.
    if (
      req.user.role === "admin_sociedad" &&
      !esAccesoUniversal &&
      socio.sociedadId.toString() !== req.user.sociedadId.toString()
    ) {
      return res
        .status(403)
        .json({ error: "El criador no pertenece a su sociedad" });
    }

    // 4. Validar elegibilidad del socio según tipo de competencia
    //    - clasica  : el socio debe pertenecer a la sociedad organizadora
    //    - nacional : el socio debe pertenecer a una sociedad de la misma federación que la organizadora
    //    - abierto / mundial: sin restricción
    const tipoComp = competencia.tipoCompetencia;
    if (tipoComp === "clasica") {
      const orgId = competencia.sociedadId?._id ?? competencia.sociedadId;
      if (!orgId || socio.sociedadId.toString() !== orgId.toString()) {
        return res.status(403).json({
          error: "El socio no pertenece a la sociedad organizadora del evento. Solo pueden inscribirse socios de esa sociedad."
        });
      }
    } else if (tipoComp === "nacional") {
      // Obtener el código de federación de la competencia:
      // - Ruta nueva: federacionId → Federacion.codigo
      // - Ruta antigua (compatibilidad): sociedadId → Sociedad.federacion
      let fedCodigoOrg = null;
      const fedId = competencia.federacionId?._id ?? competencia.federacionId;
      if (fedId) {
        const fedDoc = await Federacion.findById(fedId).select("codigo").lean();
        fedCodigoOrg = fedDoc?.codigo?.trim().toUpperCase() || null;
      } else if (competencia.sociedadId) {
        const socOrg = await Sociedad.findById(competencia.sociedadId).select("federacion").lean();
        fedCodigoOrg = socOrg?.federacion?.trim().toUpperCase() || null;
      }

      if (!fedCodigoOrg) {
        return res.status(400).json({
          error: "La competencia nacional no tiene federación asignada. No se puede validar el evento."
        });
      }

      const sociedadSocio = await Sociedad.findById(socio.sociedadId).select("federacion").lean();
      const fedCodigoSocio = sociedadSocio?.federacion?.trim().toUpperCase() || null;

      if (fedCodigoSocio !== fedCodigoOrg) {
        return res.status(403).json({
          error: `El socio no pertenece a la federación organizadora (${fedCodigoOrg}). Solo pueden inscribirse socios de sociedades de esa federación.`
        });
      }
    }
    // abierto y mundial: no requieren validación adicional

    // 5. Validar año del anillo (debe ser el año anterior al de la competencia)
    const anioAnilloNum = anioAnillo ? parseInt(anioAnillo) : null;
    if (anioAnilloNum) {
      const anioCompetencia = competencia.fecha
        ? new Date(competencia.fecha).getFullYear()
        : new Date().getFullYear();
      const anioEsperado = anioCompetencia - 1;
      if (anioAnilloNum !== anioEsperado) {
        return res.status(400).json({
          error: `Los anillos deben ser del año ${anioEsperado} (año anterior a la competencia ${anioCompetencia})`,
        });
      }
    }

    // 6. Construir lista de anillos filtrando vacíos
    const tipo = tipoPresentacion || "individual";
    const anillos = construirAnillos(numAnillo, anillosAdicionales, tipo);

    if (anillos.length === 0) {
      return res
        .status(400)
        .json({ error: "Debe ingresar al menos un número de anillo" });
    }

    // Validar que ningún anillo requerido sea "0000"
    const anillosCero = anillos.filter(a => !a.esSuplente && a.numAnillo === '0000');
    if (anillosCero.length > 0) {
      return res.status(400).json({ error: 'El número de anillo 0000 no es válido' });
    }

    // 7. Validar cantidad según tipo de presentación
    const errorCantidad = validarCantidadAnillos(anillos, tipo);
    if (errorCantidad) return res.status(400).json({ error: errorCantidad });

    // 8. Validar máximo de grupos por tipo para este socio y código de lote
    const errorMax = await validarMaximos(competencia, socio._id, tipo, codigoNomenclador);
    if (errorMax) return res.status(400).json({ error: errorMax });

    // 9. Detectar duplicados dentro de esta competencia (mismo socio)
    //    El mismo anillo SÍ puede participar en diferentes competencias del año.

    const numAnillos = anillos.map((a) => a.numAnillo);
    const yaEnCompetencia = await Inscripcion.find({
      competenciaId,
      numAnillo: { $in: numAnillos },
    }).select("numAnillo socioId");

    // Solo nos interesa saber cuáles están inscriptos por el mismo socio
    const dupePropio = new Set(
      yaEnCompetencia
        .filter((i) => i.socioId?.toString() === socio._id.toString())
        .map((i) => i.numAnillo),
    );

    // Para grupos (duos/cuartetos): si CUALQUIER anillo requerido es duplicado → rechazar TODO el grupo
    if (tipo !== 'individual' && dupePropio.size > 0) {
      const anillosRequeridos = anillos.filter(a => !a.esSuplente);
      const hayDuplicadoRequerido = anillosRequeridos.some(a => dupePropio.has(a.numAnillo));
      if (hayDuplicadoRequerido) {
        const rechazados = anillosRequeridos.map(a => ({
          numAnillo: a.numAnillo,
          motivo: dupePropio.has(a.numAnillo)
            ? 'El anillo ya está inscripto por este socio en esta competencia'
            : 'Grupo rechazado: otro anillo del grupo está duplicado',
        }));
        return res.status(409).json({
          error: 'No se puede inscribir el grupo: uno o más anillos ya están inscriptos en esta competencia.',
          rechazados,
        });
      }
    }

    // Para individual: separar a crear vs rechazados normalmente
    const aCrear = [];
    const rechazados = [];

    for (const a of anillos) {
      if (dupePropio.has(a.numAnillo)) {
        rechazados.push({
          numAnillo: a.numAnillo,
          motivo: 'El anillo ya está inscripto por este socio en esta competencia',
        });
      } else {
        aCrear.push(a);
      }
    }

    if (aCrear.length === 0) {
      return res.status(409).json({
        error: 'Ningún anillo pudo inscribirse',
        rechazados,
      });
    }

    // 10. Crear registros — uno por anillo, compartiendo grupoPresentacion si son >1
    const grupoPresentacion = aCrear.length > 1 ? randomUUID() : null;
    const base = {
      competenciaId,
      numCriador: socio.anilloCriador,
      socioId: socio._id,
      tipoNomenclador,
      codigoNomenclador: codigoNomenclador.toUpperCase(),
      nombreNomenclador: nomen.nombreLinea,
      tipoPresentacion: tipo,
      lote: codigoNomenclador.toUpperCase(),
      observaciones,
      grupoPresentacion,
      anioAnillo: anioAnilloNum,
    };

    const creados = await Inscripcion.insertMany(
      aCrear.map((a) => ({
        ...base,
        numAnillo: a.numAnillo,
        esSuplente: a.esSuplente,
      })),
    );

    res.status(201).json({
      creados,
      rechazados,
      mensaje:
        rechazados.length > 0
          ? `${creados.length} anillo/s inscripto/s. ${rechazados.length} rechazado/s por duplicado.`
          : `${creados.length} anillo/s inscripto/s correctamente.`,
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const {
      puntaje,
      premios,
      observaciones,
      tipoNomenclador,
      codigoNomenclador,
      numAnillo,
    } = req.body;

    const inscripcion = await Inscripcion.findById(req.params.id);
    if (!inscripcion)
      return res.status(404).json({ error: "Inscripción no encontrada" });

    if (codigoNomenclador && tipoNomenclador) {
      const nomen = await getNomenclador(tipoNomenclador, codigoNomenclador);
      if (!nomen)
        return res
          .status(400)
          .json({ error: "Código de nomenclador no existe" });
      inscripcion.tipoNomenclador = tipoNomenclador;
      inscripcion.codigoNomenclador = codigoNomenclador.toUpperCase();
      inscripcion.nombreNomenclador = nomen.nombreLinea;
      inscripcion.lote = codigoNomenclador.toUpperCase();
    }
    if (numAnillo) inscripcion.numAnillo = numAnillo.toUpperCase();
    if (puntaje !== undefined) inscripcion.puntaje = puntaje;
    if (premios !== undefined) inscripcion.premios = premios;
    if (observaciones !== undefined) inscripcion.observaciones = observaciones;

    await inscripcion.save();
    res.json(inscripcion);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const inscripcion = await Inscripcion.findByIdAndDelete(req.params.id);
    if (!inscripcion)
      return res.status(404).json({ error: "Inscripción no encontrada" });
    res.json({ message: "Inscripción eliminada" });
  } catch (err) {
    next(err);
  }
};

// DELETE /inscripciones/grupo/:grupoPresentacion?competenciaId=
// Elimina TODAS las inscripciones que pertenecen a un mismo grupo (duos/cuartetos).
exports.removeGrupo = async (req, res, next) => {
  try {
    const { grupoPresentacion } = req.params;
    const { competenciaId } = req.query;
    if (!competenciaId)
      return res.status(400).json({ error: "competenciaId requerido" });

    const result = await Inscripcion.deleteMany({ grupoPresentacion, competenciaId });
    res.json({ eliminadas: result.deletedCount });
  } catch (err) {
    next(err);
  }
};

/**
 * Verifica qué anillos de una lista ya están inscriptos para un socio en una competencia.
 * GET /inscripciones/verificar-anillos?competenciaId=X&numCriador=Y&anillos=0001,0002
 * Respuesta: { duplicados: string[] }
 */
exports.verificarAnillos = async (req, res, next) => {
  try {
    const { competenciaId, numCriador, anillos } = req.query;
    if (!competenciaId || !numCriador || !anillos) return res.json({ duplicados: [] });

    const anillosArr = String(anillos).split(',')
      .map(a => a.trim().toUpperCase().padStart(4, '0'))
      .filter(Boolean);

    const socio = await Socio.findOne({ anilloCriador: numCriador.trim().toUpperCase() }).select('_id').lean();
    if (!socio) return res.json({ duplicados: [] });

    const found = await Inscripcion.find({
      competenciaId,
      socioId: socio._id,
      numAnillo: { $in: anillosArr },
    }).select('numAnillo').lean();

    res.json({ duplicados: found.map(f => f.numAnillo) });
  } catch (err) { next(err); }
};

exports.getLotes = async (req, res, next) => {
  try {
    const { competenciaId } = req.params;
    const lotes = await Inscripcion.aggregate([
      { $match: { competenciaId: new mongoose.Types.ObjectId(competenciaId) } },
      {
        $group: {
          _id: { lote: '$lote', tipoPresentacion: '$tipoPresentacion' },
          nombreNomenclador: { $first: '$nombreNomenclador' },
          tipoNomenclador: { $first: '$tipoNomenclador' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.tipoNomenclador': 1, '_id.lote': 1, '_id.tipoPresentacion': 1 } },
    ]);
    res.json(lotes);
  } catch (err) {
    next(err);
  }
};
