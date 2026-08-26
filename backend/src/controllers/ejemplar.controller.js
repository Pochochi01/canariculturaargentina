const Ejemplar = require('../models/Ejemplar');
const Socio = require('../models/Socio');
const Inscripcion = require('../models/Inscripcion');

/** Obtiene el socioId del usuario autenticado (rol socio). */
async function getSocioId(user) {
  const socio = await Socio.findOne({ userId: user._id }).select('_id').lean();
  return socio?._id ?? null;
}

exports.getAll = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const filter = { socioId, activo: true };
    const ejemplares = await Ejemplar.find(filter).sort({ numAnillo: 1 });

    const anillos = [...new Set(ejemplares.map(e => e.numAnillo))];
    const inscripciones = await Inscripcion.find({
      socioId,
      numAnillo: { $in: anillos }
    }).populate('competenciaId', 'fecha').select('numAnillo competenciaId').lean();

    // Build map: numAnillo -> competition years
    const anilloCompYears = {};
    for (const insc of inscripciones) {
      const compYear = insc.competenciaId?.fecha
        ? new Date(insc.competenciaId.fecha).getFullYear()
        : null;
      if (!anilloCompYears[insc.numAnillo]) anilloCompYears[insc.numAnillo] = [];
      if (compYear) anilloCompYears[insc.numAnillo].push(compYear);
    }

    const result = ejemplares.map(e => {
      const compYears = anilloCompYears[e.numAnillo] || [];
      const temporada = e.temporadaAnillado;
      // Only flag as participant if competition year is at least one year after anillado season
      const participoEnCompetencia = temporada
        ? compYears.some(y => y >= temporada + 1)
        : compYears.length > 0;
      return { ...e.toObject(), participoEnCompetencia };
    });

    res.json(result);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const ejemplar = await Ejemplar.findOne({ _id: req.params.id, socioId, activo: true });
    if (!ejemplar) return res.status(404).json({ error: 'Ejemplar no encontrado' });
    res.json(ejemplar);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const {
      numAnillo, sexo, tipoCanario, codigoNomenclador, nombreNomenclador,
      fechaNacimiento, fechaAnillado, estado, jaula, observaciones,
      temporadaAnillado, procedenciaTipo, procedenciaApellido, procedenciaNombre
    } = req.body;

    const procedencia = (req.body.procedencia || '').toUpperCase().replace(/\s/g, '');

    // Duplicate check: numAnillo + temporadaAnillado + procedencia globally unique
    if (numAnillo && procedencia && temporadaAnillado) {
      const existe = await Ejemplar.findOne({
        numAnillo,
        procedencia,
        temporadaAnillado: Number(temporadaAnillado),
        activo: true
      }).lean();
      if (existe) return res.status(409).json({
        error: `Ya existe un ejemplar con anillo ${numAnillo}, procedencia ${procedencia} y temporada ${temporadaAnillado}.`
      });
    }

    const ejemplar = await Ejemplar.create({
      socioId, numAnillo, sexo, tipoCanario, codigoNomenclador, nombreNomenclador,
      procedencia,
      temporadaAnillado: temporadaAnillado ? Number(temporadaAnillado) : null,
      procedenciaTipo: procedenciaTipo || 'propio',
      procedenciaApellido: procedenciaApellido || '',
      procedenciaNombre: procedenciaNombre || '',
      fechaNacimiento: fechaNacimiento || null,
      fechaAnillado: fechaAnillado || null,
      estado, jaula, observaciones
    });
    res.status(201).json(ejemplar);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const {
      numAnillo, sexo, tipoCanario, codigoNomenclador, nombreNomenclador,
      fechaNacimiento, fechaAnillado, estado, jaula, observaciones,
      temporadaAnillado, procedenciaTipo, procedenciaApellido, procedenciaNombre
    } = req.body;

    const procedencia = (req.body.procedencia || '').toUpperCase().replace(/\s/g, '');

    // Duplicate check excluding self
    if (numAnillo && procedencia && temporadaAnillado) {
      const existe = await Ejemplar.findOne({
        _id: { $ne: req.params.id },
        numAnillo,
        procedencia,
        temporadaAnillado: Number(temporadaAnillado),
        activo: true
      }).lean();
      if (existe) return res.status(409).json({
        error: `Ya existe un ejemplar con anillo ${numAnillo}, procedencia ${procedencia} y temporada ${temporadaAnillado}.`
      });
    }

    const ejemplar = await Ejemplar.findOneAndUpdate(
      { _id: req.params.id, socioId },
      {
        numAnillo, sexo, tipoCanario, codigoNomenclador, nombreNomenclador,
        procedencia,
        temporadaAnillado: temporadaAnillado ? Number(temporadaAnillado) : null,
        procedenciaTipo: procedenciaTipo || 'propio',
        procedenciaApellido: procedenciaApellido || '',
        procedenciaNombre: procedenciaNombre || '',
        fechaNacimiento: fechaNacimiento || null,
        fechaAnillado: fechaAnillado || null,
        estado, jaula, observaciones
      },
      { new: true, runValidators: true }
    );
    if (!ejemplar) return res.status(404).json({ error: 'Ejemplar no encontrado' });
    res.json(ejemplar);
  } catch (err) { next(err); }
};

exports.verificarDuplicado = async (req, res, next) => {
  try {
    const { numAnillo, temporadaAnillado, procedencia, excludeId } = req.query;
    if (!numAnillo || !temporadaAnillado || !procedencia) return res.json({ existe: false });

    const filter = {
      numAnillo,
      temporadaAnillado: Number(temporadaAnillado),
      procedencia: procedencia.toUpperCase().replace(/\s/g, ''),
      activo: true,
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const existe = await Ejemplar.exists(filter);
    res.json({ existe: !!existe });
  } catch (err) { next(err); }
};

exports.buscarPorProcedencia = async (req, res, next) => {
  try {
    const procedencia = (req.params.codigo || '').toUpperCase().replace(/\s/g, '');
    if (!procedencia) return res.status(400).json({ error: 'Código requerido' });

    const ejemplar = await Ejemplar.findOne({
      procedencia,
      activo: true,
      $or: [{ procedenciaApellido: { $ne: '' } }, { procedenciaNombre: { $ne: '' } }]
    }).select('procedencia procedenciaApellido procedenciaNombre').lean();

    if (!ejemplar) return res.status(404).json({ error: 'Criador no encontrado' });

    res.json({
      procedencia: ejemplar.procedencia,
      apellido: ejemplar.procedenciaApellido || '',
      nombre: ejemplar.procedenciaNombre || '',
    });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const ejemplar = await Ejemplar.findOneAndDelete({ _id: req.params.id, socioId });
    if (!ejemplar) return res.status(404).json({ error: 'Ejemplar no encontrado' });
    res.json({ message: 'Ejemplar eliminado' });
  } catch (err) { next(err); }
};
