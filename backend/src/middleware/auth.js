const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token no proporcionado' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Rechazar tokens temporales de selección de rol
    if (decoded.pendingAuth)
      return res.status(401).json({ error: 'Token no válido para autenticación' });

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user || !user.activo)
      return res.status(401).json({ error: 'Usuario no autorizado' });

    // Sobrescribir role con el rol activo elegido en el login (viene del JWT).
    // Mantiene compatibilidad con todo el código existente que lee req.user.role.
    user.role = decoded.role;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Verifica que el rol activo de la sesión esté en la lista de roles permitidos.
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'No tiene permisos para esta operación' });
  next();
};

module.exports = { authenticate, authorize };
