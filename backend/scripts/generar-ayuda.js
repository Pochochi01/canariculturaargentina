#!/usr/bin/env node
/**
 * Generador de la base de conocimiento de Ayuda.
 *
 * Analiza el código fuente real del sistema y reconstruye backend/src/help/:
 *   - Rutas y roles      → frontend/src/router/AppRouter.jsx (allowedRoles)
 *   - Menú               → frontend/src/components/layout/Sidebar.jsx
 *   - Formularios        → <DialogTitle>/<CardTitle> + <Label> de cada página
 *   - Confirmaciones     → ConfirmDialog title="¿...?"
 *   - Acciones           → botones con title="..."
 *   - Endpoints/permisos → backend/src/app.js + routes/*.routes.js (authorize)
 *   - Errores frecuentes → mensajes { error: '...' } de cada controlador
 *
 * Los artículos de backend/src/help/manual/*.json se fusionan por id y
 * prevalecen sobre lo generado (correcciones manuales que sobreviven a la
 * regeneración). sinonimos.json se crea solo si no existe.
 *
 * Uso: npm run ayuda:generar   (desde backend/)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FRONT = path.join(ROOT, 'frontend/src');
const BACK = path.join(ROOT, 'backend/src');
const OUT = path.join(BACK, 'help');

const ROLES = ['admin_general', 'admin_sociedad', 'socio', 'operador'];
const ROLE_LABELS = {
  admin_general: 'Administrador General',
  admin_sociedad: 'Admin. de Sociedad',
  socio: 'Criador / Socio',
  operador: 'Operador de Jura'
};

// Primer segmento de ruta → módulo funcional
const SEGMENTOS = {
  dashboard:          { modulo: 'dashboard',     categoria: 'general',       entidad: 'panel principal' },
  socios:             { modulo: 'socios',        categoria: 'socios',        entidad: 'socio',        backend: 'socio' },
  sociedades:         { modulo: 'sociedades',    categoria: 'usuarios',      entidad: 'sociedad',     backend: 'sociedad' },
  jueces:             { modulo: 'jueces',        categoria: 'configuracion', entidad: 'juez',         backend: 'juez' },
  nomencladores:      { modulo: 'nomencladores', categoria: 'configuracion', entidad: 'nomenclador',  backend: 'nomenclador' },
  competencias:       { modulo: 'competencias',  categoria: 'concursos',     entidad: 'competencia',  backend: 'competencia' },
  mesas:              { modulo: 'jura',          categoria: 'concursos',     entidad: 'mesa',         backend: 'mesa' },
  historico:          { modulo: 'historico',     categoria: 'reportes',      entidad: 'histórico',    backend: 'competencia' },
  publicidades:       { modulo: 'publicidades',  categoria: 'reportes',      entidad: 'publicidad',   backend: 'publicidad' },
  'catalogo-digital': { modulo: 'catalogo',      categoria: 'reportes',      entidad: 'catálogo',     backend: 'revista' },
  gestion:            { modulo: 'gestion',       categoria: 'gestion',       entidad: 'pago',         backend: 'gestion' },
  'mi-cuenta':        { modulo: 'mi-cuenta',     categoria: 'gestion',       entidad: 'cuota',        backend: 'gestion' },
  'mis-competencias': { modulo: 'competencias',  categoria: 'concursos',     entidad: 'competencia',  backend: 'competencia' },
  'mi-criadero':      { modulo: 'criadero',      categoria: 'criaderos',     entidad: 'ejemplar',     backend: 'ejemplar' },
  'mi-perfil':        { modulo: 'perfil',        categoria: 'socios',        entidad: 'perfil',       backend: 'socio' },
  'admin/usuarios':        { modulo: 'usuarios',      categoria: 'usuarios',      entidad: 'usuario',       backend: 'usuario' },
  'admin/admins-sociedad': { modulo: 'usuarios',      categoria: 'usuarios',      entidad: 'administrador', backend: 'adminSociedad' },
  'admin/configuracion':   { modulo: 'configuracion', categoria: 'configuracion', entidad: 'configuración', backend: 'gestion' },
  'admin/premios':         { modulo: 'configuracion', categoria: 'configuracion', entidad: 'premio',        backend: 'premio' },
  'admin/dropdowns':       { modulo: 'configuracion', categoria: 'configuracion', entidad: 'opción',        backend: 'dropdown' }
};

// Palabra en el título de una operación → entidad concreta (páginas con varias entidades)
const ENTIDADES = [
  [/pich[oó]n|anill/i,       { entidad: 'anillo',       categoria: 'anillos',    backend: 'ejemplar' }],
  [/ejemplar/i,              { entidad: 'ejemplar',     categoria: 'ejemplares', backend: 'ejemplar' }],
  [/pareja/i,                { entidad: 'pareja',       categoria: 'criaderos',  backend: 'pareja' }],
  [/puesta/i,                { entidad: 'puesta',       categoria: 'criaderos',  backend: 'puesta' }],
  [/mesa/i,                  { entidad: 'mesa',         categoria: 'concursos',  backend: 'mesa' }],
  [/inscrip|calificaci/i,    { entidad: 'inscripción',  categoria: 'concursos',  backend: 'inscripcion' }],
  [/nomenclador/i,           { entidad: 'nomenclador',  categoria: 'configuracion', backend: 'nomenclador' }],
  [/planilla/i,              { entidad: 'planilla',     categoria: 'planillas',  backend: 'pdf' }],
  [/pdf|recibo|descargar|exportar|imprimir/i, { categoria: 'reportes', backend: 'pdf' }],
  [/movimiento/i,            { entidad: 'movimiento',   categoria: 'gestion',    backend: 'gestion' }],
  [/pago|cuota/i,            { entidad: 'pago',         categoria: 'gestion',    backend: 'gestion' }],
  [/revista/i,               { entidad: 'revista',      categoria: 'reportes',   backend: 'revista' }],
  [/administrador|admin\b/i, { entidad: 'administrador', categoria: 'usuarios',  backend: 'sociedad' }]
];

// Soluciones sugeridas según el texto real del error
const SOLUCIONES = [
  [/requerid|obligatori|vac[ií]o|debe (ingresar|completar|asignar|seleccionar)|solo n[uú]meros/i, 'Complete todos los campos marcados con * antes de guardar.'],
  [/ya existe|duplicad|ya tiene|ya es|ya est/i,  'El dato ya está registrado: busque el registro existente y edítelo en lugar de crear uno nuevo.'],
  [/no encontrad|no existe/i,                     'El registro pudo haber sido eliminado por otro usuario. Recargue la pantalla e intente nuevamente.'],
  [/permis|autoriz|propia cuenta/i,                    'Su rol no permite esta operación. Si cree que debería tenerla, solicítela al Administrador General.'],
  [/contraseñ|clave/i,                             'Verifique la contraseña (mínimo 6 caracteres) y que no tenga Bloq Mayús activado.'],
  [/cerrad|finalizad|inscripci[oó]n.*cerr/i,      'La competencia o inscripción está cerrada. Un administrador puede reabrirla si corresponde.'],
  [/imagen|archivo|csv|pdf/i,                      'Revise el formato y el tamaño del archivo seleccionado.'],
  [/fecha/i,                                       'Revise que las fechas ingresadas sean válidas y coherentes entre sí.'],
  [/l[ií]mite|m[aá]ximo|supera/i,                  'Se superó un límite configurado. Revise la configuración vigente o reduzca la cantidad.']
];

const STOP = new Set('de la el los las un una y o en a para por con del al se su sus que es nro n° como'.split(' '));

// ── utilidades ───────────────────────────────────────────────────────────────
const read = (p) => fs.readFileSync(p, 'utf8');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = (s) => s.replace(/\s+/g, ' ').replace(/[¿?]/g, '').trim();
const uniq = (a) => [...new Set(a.filter(Boolean))];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const conArticulo = (e) => `${/(a|i[oó]n|ad)$/.test(e) ? 'una' : 'un'} ${e}`;
const words = (s) => norm(s).split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !STOP.has(w));

// Textos visibles de un nodo JSX: literales entre comillas o texto plano
function textos(jsx) {
  const lits = [...jsx.matchAll(/'([^']{3,})'|"([^"]{3,})"|`([^`$]{3,})`/g)].map(m => m[1] || m[2] || m[3]);
  if (lits.length) return lits.map(clean);
  const plano = clean(jsx.replace(/\{[^}]*\}/g, ''));
  return plano ? [plano] : [];
}

// ── 1. Rutas del frontend ────────────────────────────────────────────────────
function parseRouter() {
  const src = read(path.join(FRONT, 'router/AppRouter.jsx'));
  const imports = {};
  for (const m of src.matchAll(/import\s+(\{[^}]+\}|\w+)\s+from\s+'@\/pages\/([^']+)'/g)) {
    const file = path.join(FRONT, 'pages', m[2] + '.jsx');
    const names = m[1].startsWith('{') ? m[1].slice(1, -1).split(',').map(s => s.trim()) : [m[1]];
    names.forEach(n => { imports[n] = file; });
  }
  const rutas = [];
  for (const m of src.matchAll(/path:\s*'([^']+)',\s*element:\s*(<ProtectedRoute(?:\s+allowedRoles=\{\[([^\]]*)\]\})?>\s*)?<(\w+)([^/>]*)\/>/g)) {
    const [, p, protegida, roles, comp, props] = m;
    if (!imports[comp]) continue;
    rutas.push({
      path: '/' + p.replace(/^\//, ''),
      roles: roles ? roles.match(/'(\w+)'/g).map(r => r.slice(1, -1)) : (protegida || p !== 'login' ? ROLES : []),
      componente: comp,
      props: props.trim(),
      archivo: imports[comp]
    });
  }
  return rutas;
}

// ── 2. Menú lateral ──────────────────────────────────────────────────────────
function parseSidebar() {
  const src = read(path.join(FRONT, 'components/layout/Sidebar.jsx'));
  const menu = {};
  let seccion = '';
  for (const linea of src.split('\n')) {
    const s = linea.match(/<NavSection title="([^"]+)"/);
    if (s) seccion = s[1];
    const n = linea.match(/<NavItem to="([^"]+)"[^>]*label="([^"]+)"/);
    if (n) menu[n[1]] = seccion ? `${seccion} › ${n[2]}` : n[2];
  }
  return menu;
}

// ── 3. Endpoints y permisos del backend ──────────────────────────────────────
function parseBackend() {
  const app = read(path.join(BACK, 'app.js'));
  const vars = {};
  for (const m of app.matchAll(/const\s+(\w+)\s*=\s*require\('\.\/routes\/([\w.]+)\.routes'\)/g)) vars[m[1]] = m[2];
  const modulos = {};
  for (const m of app.matchAll(/app\.use\('(\/api\/[^']+)',\s*(?:\w+,\s*)?(\w+)\)/g)) {
    const nombre = vars[m[2]];
    if (!nombre) continue;
    const src = read(path.join(BACK, 'routes', nombre + '.routes.js'));
    const ctrls = {};
    for (const c of src.matchAll(/const\s+(\w+)\s*=\s*require\('\.\.\/controllers\/([\w.]+)'\)/g))
      ctrls[c[1]] = read(path.join(BACK, 'controllers', c[2] + '.js'));
    const rolesDe = (s) => (s ? (s.match(/'(\w+)'/g) || []).map(r => r.slice(1, -1)) : null);
    const alias = {};
    for (const a of src.matchAll(/const\s+(\w+)\s*=\s*authorize\(([^)]*)\)/g)) alias[a[1]] = rolesDe(a[2]);
    const globales = src.match(/router\.use\(([^)]*\))\)?;/);
    const rolesArgs = (args) => {
      const auth = args.match(/authorize\(([^)]*)\)/);
      if (auth) return rolesDe(auth[1]);
      const ali = Object.keys(alias).find(k => new RegExp(`\b${k}\b`).test(args));
      return ali ? alias[ali] : null;
    };
    const endpoints = [];
    for (const r of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'([\s\S]*?)\);/g)) {
      const handler = r[3].match(/(\w+)\.(\w+)\s*$/);
      endpoints.push({
        metodo: r[1].toUpperCase(),
        ruta: m[1] + (r[2] === '/' ? '' : r[2]),
        local: r[2],
        roles: rolesArgs(r[3]) || (globales && rolesArgs(globales[1])) || ROLES,
        errores: handler && ctrls[handler[1]] ? erroresDe(ctrls[handler[1]], handler[2]) : []
      });
    }
    modulos[nombre] = endpoints;
  }
  return modulos;
}

function erroresDe(src, fn) {
  const ini = src.search(new RegExp(`exports\\.${fn}\\s*=`));
  if (ini < 0) return [];
  const resto = src.slice(ini + 1);
  const fin = resto.search(/\nexports\.\w+\s*=/);
  const cuerpo = fin < 0 ? resto : resto.slice(0, fin);
  return uniq([...cuerpo.matchAll(/error:\s*(['"`])((?:(?!\1).)+)\1/g)]
    .map(m => clean(m[2].replace(/\$\{[^}]*\}/g, '…'))));
}

// ── 4. Estructura de cada página ─────────────────────────────────────────────
const ACCIONES_GENERICAS = /^(editar|eliminar|guardar|cancelar|confirmar|cerrar|volver)$/i;

function parsePagina(archivo) {
  const src = read(archivo);
  const header = src.match(/<PageHeader[^>]*?title="([^"]+)"/);
  const marcas = [];
  for (const m of src.matchAll(/<(DialogTitle|CardTitle)[^>]*>([\s\S]*?)<\/\1>/g))
    marcas.push({ pos: m.index, tipo: 'titulo', textos: textos(m[2].replace(/<[^>]+>/g, '')) });
  for (const m of src.matchAll(/<Label[^>]*>([^<{]+)<\/Label>/g))
    marcas.push({ pos: m.index, tipo: 'campo', texto: clean(m[1]) });
  for (const m of src.matchAll(/title="(¿[^"]+\?)"/g))
    marcas.push({ pos: m.index, tipo: 'confirmacion', texto: clean(m[1]) });
  for (const m of src.matchAll(/<[Bb]utton\b(?:=>|[^>])*?\stitle=(?:"([^"]+)"|(\{[^}]*\}))/g)) {
    const t = m[1] ? clean(m[1]) : textos(m[2]).join(' / ');
    if (!t) continue;
    if (!ACCIONES_GENERICAS.test(t)) marcas.push({ pos: m.index, tipo: 'accion', texto: t });
  }
  marcas.sort((a, b) => a.pos - b.pos);

  const secciones = [];
  let actual = { titulos: [], campos: [] };
  const confirmaciones = [];
  const acciones = [];
  for (const mk of marcas) {
    if (mk.tipo === 'titulo') { secciones.push(actual); actual = { titulos: mk.textos, campos: [] }; }
    else if (mk.tipo === 'campo') actual.campos.push(mk.texto);
    else if (mk.tipo === 'confirmacion') confirmaciones.push(mk.texto);
    else acciones.push(mk.texto);
  }
  secciones.push(actual);
  return {
    titulo: header?.[1] || null,
    camposPagina: secciones[0].campos,
    secciones: secciones.slice(1).filter(s => s.titulos.length && s.campos.length),
    confirmaciones: uniq(confirmaciones),
    acciones: uniq(acciones)
  };
}

// ── 5. Construcción de artículos ─────────────────────────────────────────────
function segmentoDe(p) {
  const partes = p.split('/').filter(Boolean);
  const doble = partes.slice(0, 2).join('/');
  return SEGMENTOS[doble] ? doble : partes[0];
}

function entidadDe(texto, base) {
  if (norm(texto).includes(norm(base.entidad))) return base;
  for (const [re, info] of ENTIDADES) if (re.test(texto)) return { ...base, ...info, entidad: info.entidad || base.entidad };
  return base;
}

function tipoDe(titulo) {
  const t = norm(titulo);
  if (/^(nuev|registrar|publicar|anillar|agregar|crear|alta)/.test(t)) return 'crear';
  if (/^(editar|modificar)/.test(t)) return 'editar';
  if (/^eliminar/.test(t)) return 'eliminar';
  if (/^desactivar/.test(t)) return 'desactivar';
  if (/descargar|pdf|exportar|imprimir|recibo/.test(t)) return 'reporte';
  return 'accion';
}

const METODOS = {
  crear: ['POST'], editar: ['PUT', 'PATCH'], eliminar: ['DELETE'], desactivar: ['DELETE', 'PATCH'],
  reporte: ['GET'], accion: ['POST', 'PUT', 'PATCH', 'DELETE']
};
const raiz = (w) => w.slice(0, 4);

// Elige el endpoint que ejecuta la operación: método acorde + coincidencia de palabras
// claves: palabras del título (peso 3); contexto: palabras de la ruta (peso 1)
function endpointPara(tipo, claves, contexto, endpoints) {
  const k = new Set(claves.map(raiz));
  const c = new Set(contexto.map(raiz));
  let mejor = null, max = 0;
  for (const e of endpoints) {
    if (!METODOS[tipo].includes(e.metodo)) continue;
    const segs = words(e.local.replace(/:\w+/g, ''));
    let p = segs.filter(w => k.has(raiz(w))).length * 3 + segs.filter(w => c.has(raiz(w))).length;
    if (tipo === 'crear' && e.local === '/') p += 1;
    if (['editar', 'eliminar', 'desactivar'].includes(tipo) && e.local === '/:id') p += 1;
    if (segs.length && !segs.some(w => k.has(raiz(w)))) p -= 3; // subruta ajena a la operación
    if (p > max) { max = p; mejor = e; }
  }
  return mejor;
}

function tituloArticulo(tipo, titulo, entidad) {
  if (tipo === 'accion' || tipo === 'reporte') return `Cómo usar «${titulo}»`;
  // Títulos con verbo propio ("Registrar pago", "Anillar Pichón") se conservan
  if (tipo === 'crear' && !/^nuev/.test(norm(titulo))) return `Cómo ${titulo.charAt(0).toLowerCase()}${titulo.slice(1)}`;
  return `Cómo ${VERBOS[tipo]} ${conArticulo(entidad)}`;
}

const VERBOS = { crear: 'crear', editar: 'editar', eliminar: 'eliminar', desactivar: 'desactivar', reporte: 'descargar', accion: 'realizar' };
const KW_TIPO = {
  crear: ['crear', 'alta', 'nuevo', 'cargar', 'registrar', 'agregar'],
  editar: ['editar', 'modificar', 'cambiar', 'actualizar'],
  eliminar: ['eliminar', 'borrar', 'quitar'],
  desactivar: ['desactivar', 'baja', 'inactivo'],
  reporte: ['reporte', 'imprimir', 'pdf', 'descargar'],
  accion: []
};

function generar() {
  const rutas = parseRouter();
  const menu = parseSidebar();
  const backend = parseBackend();
  const articulos = new Map();
  const mapaRutas = {};
  const paginas = {};

  const navegacion = (ruta, tituloPagina) => {
    if (menu[ruta.path]) return `Ingrese desde el menú lateral a «${menu[ruta.path]}».`;
    const padre = Object.keys(menu).filter(k => k !== '/dashboard' && ruta.path.startsWith(k + '/')).sort((a, b) => b.length - a.length)[0];
    if (padre) return `Ingrese desde el menú lateral a «${menu[padre]}» y abra la opción correspondiente.`;
    return `Ingrese a la pantalla «${tituloPagina}».`;
  };

  const agregar = (art) => {
    const previo = articulos.get(art.id);
    if (previo) {
      previo.rutas = uniq([...previo.rutas, ...art.rutas]);
      previo.rolesPermitidos = uniq([...previo.rolesPermitidos, ...art.rolesPermitidos]);
      return;
    }
    articulos.set(art.id, art);
  };

  for (const ruta of rutas) {
    const seg = segmentoDe(ruta.path);
    const base = SEGMENTOS[seg] || { modulo: seg, categoria: 'general', entidad: seg };
    mapaRutas[ruta.path] = base.modulo;
    if (!fs.existsSync(ruta.archivo)) continue;
    const pag = paginas[ruta.archivo] ||= parsePagina(ruta.archivo);
    const tituloPagina = pag.titulo || cap(base.entidad);
    const nav = navegacion(ruta, tituloPagina);

    const crearArticulo = ({ titulo, tipo, campos = [], confirmacion, info, extra = [] }) => {
      const eps = uniq([info.backend, base.backend]).flatMap(b => backend[b] || []);
      const ep = endpointPara(tipo, words(titulo), words(ruta.path.replace(/:\w+/g, '')), eps);
      const rolesEjecucion = ep ? ruta.roles.filter(r => ep.roles.includes(r)) : ruta.roles;
      const errores = ep ? ep.errores : [];
      const pasos = [nav];
      if (tipo === 'crear') pasos.push(`Presione el botón «${titulo}» (o «Nuevo») para abrir el formulario.`);
      if (tipo === 'editar') pasos.push(`Ubique el registro y presione Editar (ícono de lápiz).`);
      if (tipo === 'eliminar' || tipo === 'desactivar') pasos.push(`Ubique el registro y presione el botón de ${tipo === 'eliminar' ? 'eliminar (ícono de papelera)' : 'desactivar'}.`);
      if (tipo === 'reporte' || tipo === 'accion') pasos.push(`Presione el botón «${titulo}».`);
      if (campos.length) pasos.push(`Complete los campos: ${campos.map(c => c.replace(/\s*\*$/, ' (obligatorio)')).join(', ')}.`);
      pasos.push(...extra);
      if (confirmacion) pasos.push(`Confirme la operación en el aviso «${confirmacion}».`);
      else if (campos.length) pasos.push('Presione Guardar para confirmar los cambios.');

      const soluciones = uniq(errores.map(e => SOLUCIONES.find(([re]) => re.test(e))?.[1]));
      agregar({
        id: slug(`${base.modulo}-${titulo}`),
        titulo: tituloArticulo(tipo, titulo, info.entidad),
        descripcion: `${cap(VERBOS[tipo])} ${tipo === 'accion' || tipo === 'reporte' ? `la operación «${titulo}»` : info.entidad} desde la pantalla «${tituloPagina}».`,
        categoria: info.categoria,
        modulo: base.modulo,
        tipo,
        rutas: [ruta.path],
        rolesPermitidos: ruta.roles,
        rolesEjecucion,
        permisos: ep ? [`${ep.metodo} ${ep.ruta}`] : [],
        keywords: uniq([...KW_TIPO[tipo], ...words(titulo), ...words(info.entidad || ''), base.modulo, ...campos.flatMap(words)]).slice(0, 25),
        pasos,
        erroresFrecuentes: errores.slice(0, 8),
        soluciones,
        relacionados: []
      });
    };

    // Formularios de página completa (/nuevo, /editar)
    const ult = ruta.path.split('/').pop();
    if (pag.camposPagina.length && /^(nuev[oa]|editar|admin)$/.test(ult)) {
      const tipo = ult === 'editar' ? 'editar' : ult === 'admin' ? 'accion' : 'crear';
      const titulo = ult === 'admin' ? `Asignar administrador` : `${tipo === 'crear' ? 'Nuevo' : 'Editar'} ${base.entidad}`;
      crearArticulo({ titulo, tipo, campos: pag.camposPagina, info: entidadDe(titulo, base) });
    }
    // Formularios en diálogos / tarjetas
    for (const sec of pag.secciones) {
      for (const t of sec.titulos) {
        const tipo = tipoDe(t);
        crearArticulo({ titulo: t, tipo: tipo === 'reporte' ? 'accion' : tipo, campos: sec.campos, info: entidadDe(t, base) });
      }
    }
    // Confirmaciones (eliminar, desactivar, finalizar…)
    for (const c of pag.confirmaciones) {
      const tipo = tipoDe(c);
      crearArticulo({ titulo: c, tipo, confirmacion: `¿${c}?`, info: entidadDe(c, base) });
    }
    // Acciones con botón propio (reportes, descargas, asignaciones)
    for (const a of pag.acciones) {
      if (pag.titulo && norm(a) === norm(pag.titulo)) continue;
      crearArticulo({ titulo: a, tipo: tipoDe(a), info: entidadDe(a, base) });
    }
  }

  // Relacionados: mismo módulo
  const lista = [...articulos.values()];
  for (const a of lista) a.relacionados = lista.filter(b => b.modulo === a.modulo && b.id !== a.id).map(b => b.id).slice(0, 6);

  // Fusión con artículos manuales
  const dirManual = path.join(OUT, 'manual');
  if (fs.existsSync(dirManual)) {
    for (const f of fs.readdirSync(dirManual).filter(f => f.endsWith('.json'))) {
      const items = [].concat(JSON.parse(read(path.join(dirManual, f))));
      for (const m of items) {
        const previo = articulos.get(m.id) || {};
        articulos.set(m.id, { ...previo, ...m, origen: 'manual' });
      }
    }
  }
  return { articulos: [...articulos.values()], mapaRutas };
}

// ── 6. Escritura ─────────────────────────────────────────────────────────────
function escribir({ articulos, mapaRutas }) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const d of fs.readdirSync(OUT, { withFileTypes: true })) {
    if (d.isDirectory() && d.name !== 'manual') fs.rmSync(path.join(OUT, d.name), { recursive: true });
  }
  const categorias = {};
  for (const a of articulos) {
    const dir = path.join(OUT, a.categoria);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, a.id + '.json'), JSON.stringify(a, null, 2) + '\n');
    categorias[a.categoria] = (categorias[a.categoria] || 0) + 1;
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
    generado: new Date().toISOString(),
    roles: ROLE_LABELS,
    rutas: mapaRutas,
    articulos
  }) + '\n');

  const sin = path.join(OUT, 'sinonimos.json');
  if (!fs.existsSync(sin)) fs.writeFileSync(sin, JSON.stringify(SINONIMOS_BASE, null, 2) + '\n');
  return categorias;
}

// Cada grupo: la primera palabra es la forma canónica
const SINONIMOS_BASE = [
  ['crear', 'cargar', 'alta', 'agregar', 'nuevo', 'nueva', 'registrar', 'ingresar', 'añadir', 'incorporar', 'dar'],
  ['editar', 'modificar', 'cambiar', 'actualizar', 'corregir'],
  ['eliminar', 'borrar', 'quitar', 'suprimir'],
  ['desactivar', 'baja', 'inactivar', 'suspender'],
  ['socio', 'miembro', 'asociado', 'afiliado', 'criador'],
  ['competencia', 'concurso', 'exposicion', 'torneo', 'muestra', 'campeonato'],
  ['ejemplar', 'pajaro', 'canario', 'ave'],
  ['anillo', 'anilla', 'anillado', 'anillar'],
  ['reporte', 'informe', 'listado', 'pdf', 'imprimir', 'descargar', 'exportar', 'ficha'],
  ['pago', 'cuota', 'cobro', 'mensualidad', 'abono', 'recibo'],
  ['usuario', 'cuenta', 'acceso', 'login'],
  ['contraseña', 'clave', 'password'],
  ['sociedad', 'club', 'asociacion', 'entidad'],
  ['juez', 'jurado', 'jueces'],
  ['mesa', 'jura', 'juzgamiento', 'calificacion', 'puntaje'],
  ['inscripcion', 'inscribir', 'anotar'],
  ['pareja', 'emparejamiento', 'cruza'],
  ['puesta', 'nido', 'huevos', 'nidada'],
  ['pichon', 'cria', 'polluelo'],
  ['nomenclador', 'codigo', 'clasificacion'],
  ['buscar', 'encontrar', 'consultar', 'ver', 'filtrar']
];

if (require.main === module) {
  const res = generar();
  const cats = escribir(res);
  console.log(`Ayuda generada: ${res.articulos.length} artículos`);
  for (const [c, n] of Object.entries(cats)) console.log(`  ${c.padEnd(14)} ${n}`);
}

module.exports = { generar, escribir };
