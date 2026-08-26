const User = require('../models/User');

// ── GET /api/admin-sociedad ───────────────────────────────────────────────────
exports.listar = async (req, res, next) => {
  try {
    const admins = await User.find({
      $or: [{ role: 'admin_sociedad' }, { roles: 'admin_sociedad' }]
    })
      .populate('sociedadId', 'nombre codigo')
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json(admins);
  } catch (err) { next(err); }
};

// ── GET /api/admin-sociedad/:id ───────────────────────────────────────────────
exports.obtener = async (req, res, next) => {
  try {
    const admin = await User.findById(req.params.id)
      .populate('sociedadId', 'nombre codigo')
      .select('-passwordHash');

    if (!admin) return res.status(404).json({ error: 'Administrador no encontrado' });
    res.json(admin);
  } catch (err) { next(err); }
};

// ── POST /api/admin-sociedad ──────────────────────────────────────────────────
exports.crear = async (req, res, next) => {
  try {
    const { dni, password, sociedadId } = req.body;
    if (!dni || !password)
      return res.status(400).json({ error: 'DNI y contraseña son requeridos' });

    // Si el usuario ya existe, agregar el rol admin_sociedad
    const existe = await User.findOne({ dni: dni.trim() });
    if (existe) {
      const currentRoles = existe.effectiveRoles();
      if (currentRoles.includes('admin_sociedad'))
        return res.status(409).json({ error: 'El usuario ya es administrador de sociedad' });

      existe.roles = [...new Set([...currentRoles, 'admin_sociedad'])];
      if (sociedadId) existe.sociedadId = sociedadId;
      await existe.save();

      const updated = await User.findById(existe._id)
        .populate('sociedadId', 'nombre codigo')
        .select('-passwordHash');
      return res.status(201).json(updated);
    }

    const passwordHash = await User.hashPassword(password);
    const nuevo = await User.create({
      dni: dni.trim(),
      passwordHash,
      role: 'admin_sociedad',
      roles: ['admin_sociedad'],
      sociedadId: sociedadId || null,
      activo: true
    });

    const populated = await User.findById(nuevo._id)
      .populate('sociedadId', 'nombre codigo')
      .select('-passwordHash');

    res.status(201).json(populated);
  } catch (err) { next(err); }
};

// ── PUT /api/admin-sociedad/:id ───────────────────────────────────────────────
exports.actualizar = async (req, res, next) => {
  try {
    const { dni, password, sociedadId, activo, roles } = req.body;

    const admin = await User.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Administrador no encontrado' });

    if (dni)              admin.dni        = dni.trim();
    if (password)         admin.passwordHash = await User.hashPassword(password);
    if (sociedadId !== undefined) admin.sociedadId = sociedadId || null;
    if (activo  !== undefined)    admin.activo     = activo;
    if (roles && roles.length > 0) {
      admin.roles = roles;
      admin.role  = roles[0];
    }

    await admin.save();

    const updated = await User.findById(admin._id)
      .populate('sociedadId', 'nombre codigo')
      .select('-passwordHash');

    res.json(updated);
  } catch (err) { next(err); }
};

// ── DELETE /api/admin-sociedad/:id (hard delete) ─────────────────────────────
exports.eliminar = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ error: 'No puede eliminar su propia cuenta' });

    const admin = await User.findByIdAndDelete(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Administrador no encontrado' });

    res.json({ message: 'Administrador eliminado permanentemente' });
  } catch (err) { next(err); }
};
