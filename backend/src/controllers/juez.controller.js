const Juez = require('../models/Juez');

exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.activo !== undefined) filter.activo = req.query.activo === 'true';
    const jueces = await Juez.find(filter).sort({ apellido: 1, nombre: 1 });
    res.json(jueces);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const juez = await Juez.findById(req.params.id);
    if (!juez) return res.status(404).json({ error: 'Juez no encontrado' });
    res.json(juez);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { codigo, nombre, apellido, dni, federacion, tipoJuez } = req.body;
    const juez = await Juez.create({ codigo, nombre, apellido, dni, federacion, tipoJuez });
    res.status(201).json(juez);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { codigo, nombre, apellido, dni, federacion, tipoJuez, activo } = req.body;
    const juez = await Juez.findByIdAndUpdate(
      req.params.id,
      { codigo, nombre, apellido, dni, federacion, tipoJuez, activo },
      { new: true, runValidators: true }
    );
    if (!juez) return res.status(404).json({ error: 'Juez no encontrado' });
    res.json(juez);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const juez = await Juez.findByIdAndUpdate(req.params.id, { activo: false }, { new: true });
    if (!juez) return res.status(404).json({ error: 'Juez no encontrado' });
    res.json({ message: 'Juez desactivado correctamente' });
  } catch (err) { next(err); }
};
