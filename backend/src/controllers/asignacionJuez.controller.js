const AsignacionJuez = require('../models/AsignacionJuez');

// GET /asignaciones-juez?competenciaId=xxx
exports.getByCompetencia = async (req, res, next) => {
  try {
    const { competenciaId } = req.query;
    if (!competenciaId) return res.status(400).json({ error: 'competenciaId requerido' });
    const asignaciones = await AsignacionJuez.find({ competenciaId })
      .populate('juecesIds', 'nombre apellido codigo')
      .sort({ codigoNomenclador: 1, tipoPresentacion: 1 });
    res.json(asignaciones);
  } catch (err) { next(err); }
};

// GET /asignaciones-juez/:id
exports.getById = async (req, res, next) => {
  try {
    const asignacion = await AsignacionJuez.findById(req.params.id)
      .populate('juecesIds', 'nombre apellido codigo');
    if (!asignacion) return res.status(404).json({ error: 'Asignación no encontrada' });
    res.json(asignacion);
  } catch (err) { next(err); }
};

// PUT /asignaciones-juez/upsert
// Body: { competenciaId, codigoNomenclador, tipoPresentacion, juecesIds }
// Crea si no existe; actualiza si ya existe. Devuelve el registro poblado.
exports.upsert = async (req, res, next) => {
  try {
    const { competenciaId, codigoNomenclador, tipoPresentacion, juecesIds } = req.body;
    if (!competenciaId || !codigoNomenclador || !tipoPresentacion) {
      return res.status(400).json({ error: 'competenciaId, codigoNomenclador y tipoPresentacion son requeridos' });
    }

    const asignacion = await AsignacionJuez.findOneAndUpdate(
      { competenciaId, codigoNomenclador: codigoNomenclador.toUpperCase(), tipoPresentacion },
      { juecesIds: Array.isArray(juecesIds) ? juecesIds.filter(Boolean) : [] },
      { upsert: true, new: true, runValidators: true }
    ).populate('juecesIds', 'nombre apellido codigo');

    res.json(asignacion);
  } catch (err) { next(err); }
};

// DELETE /asignaciones-juez/:id  (borrado definitivo)
exports.remove = async (req, res, next) => {
  try {
    const asignacion = await AsignacionJuez.findByIdAndDelete(req.params.id);
    if (!asignacion) return res.status(404).json({ error: 'Asignación no encontrada' });
    res.json({ message: 'Asignación eliminada' });
  } catch (err) { next(err); }
};
