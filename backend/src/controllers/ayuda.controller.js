const fs = require('fs');
const path = require('path');
const ayuda = require('../services/ayuda.service');

// ── GET /api/ayuda ────────────────────────────────────────────────────────────
exports.obtener = (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, max-age=300');
    res.json(ayuda.paraRol(req.user.role));
  } catch (err) { next(err); }
};

// ── POST /api/ayuda/regenerar ─────────────────────────────────────────────────
// Reconstruye la base desde el código fuente (requiere el frontend en el servidor)
exports.regenerar = (req, res, next) => {
  try {
    if (!fs.existsSync(path.resolve(__dirname, '../../../frontend/src/router/AppRouter.jsx')))
      return res.status(409).json({ error: 'El código fuente del frontend no está disponible en este servidor. Ejecute "npm run ayuda:generar" en desarrollo y despliegue la carpeta src/help.' });

    const script = require.resolve('../../scripts/generar-ayuda');
    delete require.cache[script];
    const { generar, escribir } = require(script);
    const categorias = escribir(generar());
    res.json({ message: 'Base de conocimiento regenerada', articulos: ayuda.recargar(), categorias });
  } catch (err) { next(err); }
};
