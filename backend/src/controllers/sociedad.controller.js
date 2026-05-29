const Sociedad = require('../models/Sociedad');
const User = require('../models/User');

exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.activa !== undefined) filter.activa = req.query.activa === 'true';
    const sociedades = await Sociedad.find(filter)
      .populate('adminId', 'dni role')
      .sort({ nombre: 1 });
    res.json(sociedades);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findById(req.params.id).populate('adminId', 'dni role');
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });
    res.json(sociedad);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { codigo, nombre, provincia, direccion, telefono, mail, federacion } = req.body;
    const sociedad = await Sociedad.create({ codigo, nombre, provincia, direccion, telefono, mail, federacion });
    res.status(201).json(sociedad);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findById(req.params.id);
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });

    const campos = ['codigo', 'nombre', 'provincia', 'direccion', 'telefono', 'mail', 'activa'];
    for (const c of campos) {
      if (req.body[c] !== undefined) sociedad[c] = req.body[c];
    }

    // federacion se normaliza a mayúsculas; cadena vacía = sin federación
    const fedRaw = req.body.federacion;
    if (fedRaw !== undefined) {
      sociedad.federacion = typeof fedRaw === 'string' ? fedRaw.trim().toUpperCase() : '';
    }

    await sociedad.save();
    res.json(sociedad);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findByIdAndUpdate(
      req.params.id,
      { activa: false },
      { new: true }
    );
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });
    res.json({ message: 'Sociedad desactivada correctamente' });
  } catch (err) { next(err); }
};

exports.asignarAdmin = async (req, res, next) => {
  try {
    const { dni, password } = req.body;
    const sociedad = await Sociedad.findById(req.params.id);
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });

    let adminUser = await User.findOne({ dni });
    if (!adminUser) {
      const passwordHash = await User.hashPassword(password || dni);
      adminUser = await User.create({
        dni,
        passwordHash,
        role: 'admin_sociedad',
        sociedadId: sociedad._id
      });
    } else {
      adminUser.role = 'admin_sociedad';
      adminUser.sociedadId = sociedad._id;
      await adminUser.save();
    }

    sociedad.adminId = adminUser._id;
    await sociedad.save();
    res.json({ message: 'Administrador asignado', adminId: adminUser._id });
  } catch (err) { next(err); }
};
