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

    // Agregar bandera de participación en competencias
    const ids = ejemplares.map(e => e._id);
    // No hay referencia directa en Inscripcion a Ejemplar; la participación
    // se detecta comparando numAnillo + socioId en Inscripcion
    const anillos = [...new Set(ejemplares.map(e => e.numAnillo))];
    const inscripciones = await Inscripcion.find({
      socioId,
      numAnillo: { $in: anillos }
    }).select('numAnillo competenciaId').lean();

    const anillosParticipantes = new Set(inscripciones.map(i => i.numAnillo));

    const result = ejemplares.map(e => ({
      ...e.toObject(),
      participoEnCompetencia: anillosParticipantes.has(e.numAnillo)
    }));

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
      fechaNacimiento, fechaAnillado, estado, jaula, observaciones
    } = req.body;

    const ejemplar = await Ejemplar.create({
      socioId, numAnillo, sexo, tipoCanario, codigoNomenclador, nombreNomenclador,
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
      fechaNacimiento, fechaAnillado, estado, jaula, observaciones
    } = req.body;

    const ejemplar = await Ejemplar.findOneAndUpdate(
      { _id: req.params.id, socioId },
      {
        numAnillo, sexo, tipoCanario, codigoNomenclador, nombreNomenclador,
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

exports.remove = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const ejemplar = await Ejemplar.findOneAndDelete({ _id: req.params.id, socioId });
    if (!ejemplar) return res.status(404).json({ error: 'Ejemplar no encontrado' });
    res.json({ message: 'Ejemplar eliminado' });
  } catch (err) { next(err); }
};
