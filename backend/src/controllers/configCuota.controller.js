const ConfigCuota = require('../models/ConfigCuota');
const Sociedad = require('../models/Sociedad');

// GET /api/gestion/config?año=2024
exports.get = async (req, res, next) => {
  try {
    const sociedadId = req.user.sociedadId;
    const año = parseInt(req.query.año) || new Date().getFullYear();
    let config = await ConfigCuota.findOne({ sociedadId, año });
    if (!config) {
      config = { sociedadId, año, montoCuotaMensual: 0, montoCuotaAnual: 0, montoDerechoJaula: 0 };
    }
    res.json(config);
  } catch (err) { next(err); }
};

// PUT /api/gestion/config
exports.upsert = async (req, res, next) => {
  try {
    const sociedadId = req.user.sociedadId;
    const { año, montoCuotaMensual, montoCuotaAnual, montoDerechoJaula } = req.body;
    const config = await ConfigCuota.findOneAndUpdate(
      { sociedadId, año },
      { montoCuotaMensual, montoCuotaAnual, montoDerechoJaula },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(config);
  } catch (err) { next(err); }
};

// GET /api/gestion/sociedad  — datos de la sociedad del admin
exports.getSociedad = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findById(req.user.sociedadId);
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });
    res.json(sociedad);
  } catch (err) { next(err); }
};

// POST /api/gestion/logo — upload logo (multer handles file)
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const sociedad = await Sociedad.findByIdAndUpdate(
      req.user.sociedadId,
      { logo: req.file.filename },
      { new: true }
    );
    res.json({ logo: sociedad.logo });
  } catch (err) { next(err); }
};
