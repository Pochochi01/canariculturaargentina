const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../help');
let cache = null;

// Carga perezosa: se lee una sola vez y queda en memoria
function cargar() {
  if (cache) return cache;
  const leer = (f, def) => {
    const p = path.join(DIR, f);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : def;
  };
  const index = leer('index.json', { articulos: [], rutas: {}, roles: {} });
  cache = { ...index, sinonimos: leer('sinonimos.json', []) };
  return cache;
}

const puedeVer = (articulo, rol) =>
  (articulo.rolesEjecucion?.length ? articulo.rolesEjecucion : articulo.rolesPermitidos || []).includes(rol);

// Base de conocimiento visible para un rol: nunca incluye módulos sin acceso
exports.paraRol = (rol) => {
  const { articulos, rutas, roles, sinonimos, generado } = cargar();
  const visibles = articulos
    .filter(a => puedeVer(a, rol))
    .map(a => {
      // Los endpoints internos solo se exponen al administrador general
      if (rol === 'admin_general') return a;
      const { permisos, ...resto } = a;
      return resto;
    });
  const ids = new Set(visibles.map(a => a.id));
  for (const a of visibles) a.relacionados = (a.relacionados || []).filter(id => ids.has(id));

  const modulos = new Set(visibles.map(a => a.modulo));
  return {
    generado,
    roles,
    sinonimos,
    rutas: Object.fromEntries(Object.entries(rutas).filter(([, m]) => modulos.has(m))),
    articulos: visibles
  };
};

exports.recargar = () => { cache = null; return cargar().articulos.length; };
