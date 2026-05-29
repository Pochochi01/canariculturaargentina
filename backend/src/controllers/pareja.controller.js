const Pareja = require('../models/Pareja');
const Socio = require('../models/Socio');

async function getSocioId(user) {
  const socio = await Socio.findOne({ userId: user._id }).select('_id').lean();
  return socio?._id ?? null;
}

exports.getAll = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const parejas = await Pareja.find({ socioId, activo: true })
      .populate('machoId', 'numAnillo sexo tipoCanario nombreNomenclador estado')
      .populate('hembraId', 'numAnillo sexo tipoCanario nombreNomenclador estado')
      .sort({ fechaEmparejamiento: -1 });
    res.json(parejas);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const pareja = await Pareja.findOne({ _id: req.params.id, socioId, activo: true })
      .populate('machoId', 'numAnillo sexo tipoCanario nombreNomenclador')
      .populate('hembraId', 'numAnillo sexo tipoCanario nombreNomenclador');
    if (!pareja) return res.status(404).json({ error: 'Pareja no encontrada' });
    res.json(pareja);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const { machoId, hembraId, fechaEmparejamiento, numJaula, fechaPuestaNido, comentarios } = req.body;
    const pareja = await Pareja.create({
      socioId, machoId, hembraId,
      fechaEmparejamiento: fechaEmparejamiento || null,
      numJaula,
      fechaPuestaNido: fechaPuestaNido || null,
      comentarios
    });
    res.status(201).json(pareja);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const { machoId, hembraId, fechaEmparejamiento, numJaula, fechaPuestaNido, comentarios } = req.body;
    const pareja = await Pareja.findOneAndUpdate(
      { _id: req.params.id, socioId },
      {
        machoId, hembraId,
        fechaEmparejamiento: fechaEmparejamiento || null,
        numJaula,
        fechaPuestaNido: fechaPuestaNido || null,
        comentarios
      },
      { new: true, runValidators: true }
    );
    if (!pareja) return res.status(404).json({ error: 'Pareja no encontrada' });
    res.json(pareja);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const socioId = await getSocioId(req.user);
    if (!socioId) return res.status(403).json({ error: 'Socio no encontrado' });

    const pareja = await Pareja.findOneAndDelete({ _id: req.params.id, socioId });
    if (!pareja) return res.status(404).json({ error: 'Pareja no encontrada' });
    res.json({ message: 'Pareja eliminada' });
  } catch (err) { next(err); }
};
