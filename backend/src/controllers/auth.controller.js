const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Sociedad = require('../models/Sociedad');
const Socio = require('../models/Socio');
const Mesa = require('../models/Mesa');

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, sociedadId: user.sociedadId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

exports.login = async (req, res, next) => {
  try {
    const { dni, password } = req.body;
    if (!dni || !password) {
      return res.status(400).json({ error: 'DNI y contraseña son requeridos' });
    }

    const user = await User.findOne({ dni: dni.trim(), activo: true });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'DNI o contraseña incorrectos' });
    }

    const token = generateToken(user);

    let perfil = null;
    let mesaId = null;

    if (user.role === 'socio') {
      perfil = await Socio.findOne({ userId: user._id }).populate('sociedadId', 'nombre codigo');
    } else if (user.role === 'admin_sociedad') {
      perfil = await Sociedad.findById(user.sociedadId);
    } else if (user.role === 'operador') {
      const mesa = await Mesa.findOne({ operadorId: user._id }).select('_id');
      mesaId = mesa?._id ?? null;
    }

    res.json({
      token,
      user: {
        id: user._id,
        dni: user.dni,
        role: user.role,
        sociedadId: user.sociedadId,
        mesaId,
        perfil
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    let perfil = null;
    let mesaId = null;
    if (req.user.role === 'socio') {
      perfil = await Socio.findOne({ userId: req.user._id }).populate('sociedadId', 'nombre codigo');
    } else if (req.user.role === 'admin_sociedad') {
      perfil = await Sociedad.findById(req.user.sociedadId);
    } else if (req.user.role === 'operador') {
      const mesa = await Mesa.findOne({ operadorId: req.user._id }).select('_id');
      mesaId = mesa?._id ?? null;
    }
    res.json({ user: { ...req.user.toObject(), perfil, mesaId } });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ error: 'Se requieren contraseña actual y nueva' });
    }
    if (passwordNueva.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(passwordActual))) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    user.passwordHash = await User.hashPassword(passwordNueva);
    await user.save();
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
};
