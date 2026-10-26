const User = require('../models/User');
const Socio = require('../models/Socio');
const Sociedad = require('../models/Sociedad');
const Mesa = require('../models/Mesa');

const ROLES_VALIDOS = ['admin_general', 'admin_sociedad', 'socio', 'operador'];

const normalizarRoles = (roles) =>
  [...new Set((roles || []).filter(r => ROLES_VALIDOS.includes(r)))];

const buscarPorId = (id) =>
  User.findById(id).populate('sociedadId', 'nombre codigo').select('-passwordHash');

// ── GET /api/usuarios ─────────────────────────────────────────────────────────
exports.listar = async (req, res, next) => {
  try {
    const usuarios = await User.find()
      .populate('sociedadId', 'nombre codigo')
      .select('-passwordHash')
      .sort({ dni: 1 });
    res.json(usuarios);
  } catch (err) { next(err); }
};

// ── GET /api/usuarios/:id ─────────────────────────────────────────────────────
exports.obtener = async (req, res, next) => {
  try {
    const usuario = await buscarPorId(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) { next(err); }
};

// ── POST /api/usuarios ────────────────────────────────────────────────────────
exports.crear = async (req, res, next) => {
  try {
    const { dni, password, sociedadId } = req.body;
    const roles = normalizarRoles(req.body.roles);
    if (!dni?.trim() || !password)
      return res.status(400).json({ error: 'DNI y contraseña son requeridos' });
    if (!roles.length)
      return res.status(400).json({ error: 'Debe asignar al menos un rol' });

    if (await User.exists({ dni: dni.trim() }))
      return res.status(409).json({ error: 'Ya existe un usuario con ese DNI' });

    const nuevo = await User.create({
      dni: dni.trim(),
      passwordHash: await User.hashPassword(password),
      role: roles[0],
      roles,
      sociedadId: sociedadId || null,
      activo: true
    });
    res.status(201).json(await buscarPorId(nuevo._id));
  } catch (err) { next(err); }
};

// ── PUT /api/usuarios/:id ─────────────────────────────────────────────────────
exports.actualizar = async (req, res, next) => {
  try {
    const { dni, password, sociedadId, activo } = req.body;
    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (dni?.trim() && dni.trim() !== usuario.dni) {
      if (await User.exists({ dni: dni.trim(), _id: { $ne: usuario._id } }))
        return res.status(409).json({ error: 'Ya existe un usuario con ese DNI' });
      usuario.dni = dni.trim();
    }
    if (password) usuario.passwordHash = await User.hashPassword(password);
    if (sociedadId !== undefined) usuario.sociedadId = sociedadId || null;
    if (activo !== undefined) usuario.activo = activo;
    if (req.body.roles !== undefined) {
      const roles = normalizarRoles(req.body.roles);
      if (!roles.length) return res.status(400).json({ error: 'Debe asignar al menos un rol' });
      usuario.roles = roles;
      usuario.role = roles[0];
    }

    await usuario.save();
    res.json(await buscarPorId(usuario._id));
  } catch (err) { next(err); }
};

// ── DELETE /api/usuarios/:id (eliminación definitiva) ────────────────────────
// Borra el usuario y quita sus vínculos (socio, admin de sociedad, operador de mesa).
exports.eliminar = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ error: 'No puede eliminar su propia cuenta' });

    const usuario = await User.findByIdAndDelete(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    await Promise.all([
      Socio.updateMany({ userId: usuario._id }, { $set: { userId: null } }),
      Sociedad.updateMany({ adminId: usuario._id }, { $set: { adminId: null } }),
      Mesa.updateMany({ operadorId: usuario._id }, { $set: { operadorId: null } })
    ]);
    res.json({ message: 'Usuario eliminado definitivamente' });
  } catch (err) { next(err); }
};
