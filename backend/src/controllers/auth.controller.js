const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Sociedad = require('../models/Sociedad');
const Socio = require('../models/Socio');
const Mesa = require('../models/Mesa');

// ── Token completo con rol activo seleccionado ────────────────────────────────
const generateToken = (user, activeRole) =>
  jwt.sign(
    { id: user._id, role: activeRole, roles: user.effectiveRoles(), sociedadId: user.sociedadId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ── Token temporal (5 min) para el paso de selección de rol ──────────────────
const generateTempToken = (userId, roles) =>
  jwt.sign(
    { id: userId, pendingRoles: roles, pendingAuth: true },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

// ── Construye la respuesta de sesión con perfil según el rol activo ───────────
const buildUserResponse = async (user, activeRole) => {
  const token = generateToken(user, activeRole);
  let perfil = null;
  let mesaId = null;

  if (activeRole === 'socio') {
    perfil = await Socio.findOne({ userId: user._id }).populate('sociedadId', 'nombre codigo');
  } else if (activeRole === 'admin_sociedad') {
    perfil = await Sociedad.findById(user.sociedadId);
  } else if (activeRole === 'operador') {
    const mesa = await Mesa.findOne({ operadorId: user._id }).select('_id');
    mesaId = mesa?._id ?? null;
  }

  return {
    token,
    user: {
      id: user._id,
      dni: user.dni,
      role: activeRole,
      roles: user.effectiveRoles(),
      sociedadId: user.sociedadId,
      mesaId,
      perfil
    }
  };
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { dni, password } = req.body;
    if (!dni || !password)
      return res.status(400).json({ error: 'DNI y contraseña son requeridos' });

    const user = await User.findOne({ dni: dni.trim(), activo: true });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'DNI o contraseña incorrectos' });

    // Completa roles que el usuario tiene de hecho pero no figuran guardados
    // (p. ej. datos anteriores donde un rol pisaba a otro)
    const [esSocio, esAdminSociedad] = await Promise.all([
      Socio.exists({ userId: user._id }),
      Sociedad.exists({ adminId: user._id })
    ]);
    const antes = user.effectiveRoles().length;
    if (esSocio) user.addRole('socio');
    if (esAdminSociedad) user.addRole('admin_sociedad');
    if (user.effectiveRoles().length !== antes) await user.save();

    const roles = user.effectiveRoles();
    if (roles.length === 0)
      return res.status(403).json({ error: 'El usuario no tiene roles asignados' });

    // Si tiene más de un rol, el cliente debe elegir cuál usar en esta sesión
    if (roles.length > 1) {
      return res.json({
        requiresRoleSelection: true,
        roles,
        tempToken: generateTempToken(user._id, roles)
      });
    }

    res.json(await buildUserResponse(user, roles[0]));
  } catch (err) { next(err); }
};

// ── POST /api/auth/select-role ────────────────────────────────────────────────
// Recibe el tempToken en Authorization + el rol elegido en el body.
exports.selectRole = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Token temporal no proporcionado' });

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token temporal inválido o expirado' });
    }

    if (!decoded.pendingAuth)
      return res.status(400).json({ error: 'Token no válido para selección de rol' });

    const { role } = req.body;
    if (!role || !decoded.pendingRoles.includes(role))
      return res.status(400).json({ error: 'Rol no válido para este usuario' });

    const user = await User.findById(decoded.id);
    if (!user || !user.activo)
      return res.status(401).json({ error: 'Usuario no autorizado' });

    res.json(await buildUserResponse(user, role));
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
exports.me = async (req, res, next) => {
  try {
    const activeRole = req.user.role;
    let perfil = null;
    let mesaId = null;

    if (activeRole === 'socio') {
      perfil = await Socio.findOne({ userId: req.user._id }).populate('sociedadId', 'nombre codigo');
    } else if (activeRole === 'admin_sociedad') {
      perfil = await Sociedad.findById(req.user.sociedadId);
    } else if (activeRole === 'operador') {
      const mesa = await Mesa.findOne({ operadorId: req.user._id }).select('_id');
      mesaId = mesa?._id ?? null;
    }

    res.json({
      user: {
        ...req.user.toObject(),
        role: activeRole,
        roles: req.user.effectiveRoles(),
        perfil,
        mesaId
      }
    });
  } catch (err) { next(err); }
};

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    if (!passwordActual || !passwordNueva)
      return res.status(400).json({ error: 'Se requieren contraseña actual y nueva' });
    if (passwordNueva.length < 6)
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(passwordActual)))
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    user.passwordHash = await User.hashPassword(passwordNueva);
    await user.save();
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) { next(err); }
};
