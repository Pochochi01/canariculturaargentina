const { randomUUID } = require('crypto');
const Inscripcion = require('../models/Inscripcion');
const Socio = require('../models/Socio');
const AuditoriaComposicion = require('../models/AuditoriaComposicion');
const { ejecutarTransaccion } = require('../utils/transaccion');
const { puedeAcceder, puedeAdministrar } = require('./competenciaAcceso.service');

/**
 * Composición de presentaciones: individual / dúo / cuarteto (+ suplente opcional).
 * Cada ave es un documento Inscripcion; los integrantes de un grupo comparten
 * grupoPresentacion. Toda escritura es atómica y queda auditada.
 */

const TAMANIO = { individual: 1, duos: 2, cuartetos: 4 };
const MAX_CAMPO = { individual: 'maxIndividuales', duos: 'maxDuos', cuartetos: 'maxCuartetos' };

class ErrorNegocio extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

const id = (v) => (v?._id ?? v)?.toString();

// ── Permisos ────────────────────────────────────────────────────────────────
// Organizador: cualquier inscripción. Participante (admin de otra sociedad con acceso):
// solo inscripciones de socios de su propia sociedad.
async function verificarGestion(competencia, socioId, user) {
  if (puedeAdministrar(competencia, user)) return;
  if (user.role === 'admin_sociedad' && await puedeAcceder(competencia, user)) {
    const socio = await Socio.findById(socioId).select('sociedadId').lean();
    if (socio && id(socio.sociedadId) === id(user.sociedadId)) return;
  }
  throw new ErrorNegocio(403, 'No tiene permisos para modificar estas inscripciones');
}

// ── Lectura ─────────────────────────────────────────────────────────────────
/** Agrupa inscripciones en unidades { tipo, grupo, codigo, titulares[], suplente } */
function agruparUnidades(inscripciones) {
  const mapa = new Map();
  for (const i of inscripciones) {
    const clave = i.grupoPresentacion || id(i._id);
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        tipo: i.grupoPresentacion ? i.tipoPresentacion : 'individual',
        grupo: i.grupoPresentacion || null,
        codigo: i.codigoNomenclador,
        nombre: i.nombreNomenclador,
        titulares: [],
        suplente: null
      });
    }
    const u = mapa.get(clave);
    if (i.esSuplente) u.suplente = i; else u.titulares.push(i);
  }
  return [...mapa.values()];
}

const resumen = (unidades) => unidades.map(u => ({
  tipo: u.tipo,
  grupo: u.grupo,
  anillos: u.titulares.map(t => t.numAnillo),
  suplente: u.suplente?.numAnillo || null
}));

async function composicionDeSocio(competenciaId, socioId) {
  const inscripciones = await Inscripcion.find({ competenciaId, socioId })
    .select('numAnillo tipoPresentacion grupoPresentacion esSuplente codigoNomenclador nombreNomenclador numJaula premios puntaje')
    .sort({ codigoNomenclador: 1, numAnillo: 1 })
    .lean();
  return agruparUnidades(inscripciones);
}

// ── Validaciones compartidas ───────────────────────────────────────────────
/**
 * Verifica los máximos por socio/lote/tipo tras la operación.
 * unidadesNuevas: [{ tipo, codigo }]; idsAfectados: inscripciones que dejan su unidad actual.
 */
async function validarMaximos(competencia, socioId, idsAfectados, unidadesNuevas) {
  const afectados = new Set(idsAfectados.map(String));
  const restantes = (await Inscripcion.find({ competenciaId: competencia._id, socioId })
    .select('tipoPresentacion grupoPresentacion codigoNomenclador esSuplente').lean())
    .filter(i => !afectados.has(id(i._id)));
  const conteo = new Map();
  const sumar = (tipo, codigo, clave) => {
    const k = `${tipo}|${codigo}`;
    if (!conteo.has(k)) conteo.set(k, new Set());
    conteo.get(k).add(clave);
  };
  for (const i of restantes) sumar(i.grupoPresentacion ? i.tipoPresentacion : 'individual', i.codigoNomenclador, i.grupoPresentacion || id(i._id));
  unidadesNuevas.forEach((u, n) => sumar(u.tipo, u.codigo, `nueva-${n}`));

  for (const [k, claves] of conteo) {
    const [tipo, codigo] = k.split('|');
    const max = competencia[MAX_CAMPO[tipo]];
    if (max && max !== 'libre' && claves.size > parseInt(max)) {
      throw new ErrorNegocio(400,
        `La operación supera el máximo de ${max} presentación/es de tipo "${tipo}" para el lote "${codigo}".`);
    }
  }
}

// ── Escritura atómica con auditoría ─────────────────────────────────────────
/**
 * Aplica { actualizaciones: [{ ids, set }], eliminar: [ids], auditorias: [...] }
 * dentro de una transacción. En MongoDB standalone restaura el snapshot si algo falla.
 */
async function aplicar({ snapshotIds, actualizaciones, eliminar, auditorias }) {
  const snapshot = await Inscripcion.find({ _id: { $in: snapshotIds } }).lean();
  const operacionId = randomUUID();

  return ejecutarTransaccion(async (session) => {
    for (const { ids, set } of actualizaciones) {
      if (ids.length) await Inscripcion.updateMany({ _id: { $in: ids } }, { $set: set }, { session });
    }
    if (eliminar.length) await Inscripcion.deleteMany({ _id: { $in: eliminar } }, { session });
    if (auditorias.length) {
      await AuditoriaComposicion.insertMany(
        auditorias.map(a => ({ ...a, detalle: [a.detalle, `op:${operacionId}`].filter(Boolean).join(' ') })),
        { session }
      );
    }
    return { operacionId };
  }, async () => {
    await Inscripcion.deleteMany({ _id: { $in: snapshotIds } });
    if (snapshot.length) await Inscripcion.insertMany(snapshot);
    await AuditoriaComposicion.deleteMany({ detalle: new RegExp(`op:${operacionId}$`) });
  });
}

const auditoriaBase = (user, competencia, socioId) => ({
  usuarioId: user._id,
  usuarioDni: user.dni,
  rol: user.role,
  sociedadId: user.sociedadId || competencia.sociedadId || null,
  competenciaId: competencia._id,
  socioId
});

// ── Recomposición (Tarea 4 / 6) ─────────────────────────────────────────────
/**
 * grupos: [{ tipo: 'individual'|'duos'|'cuartetos', titulares: [inscripcionId], suplente?: inscripcionId }]
 * eliminar: [inscripcionId]
 * Todas las aves afectadas deben ser del mismo socio y competencia, aparecer una sola vez,
 * y si pertenecen a un dúo/cuarteto, deben incluirse todos sus integrantes.
 */
async function recomponer({ competencia, socioId, grupos = [], eliminar = [], user }) {
  if (competencia.tipoCompetencia !== 'clasica')
    throw new ErrorNegocio(400, 'La edición de composición solo está disponible en competencias clásicas.');
  if (competencia.estadoInscripcion !== 'abierta')
    throw new ErrorNegocio(400, 'La composición solo puede modificarse con la inscripción abierta (las jaulas ya fueron asignadas).');
  await verificarGestion(competencia, socioId, user);

  // Unicidad absoluta: cada ave en un único destino
  const destinos = [
    ...grupos.flatMap(g => [...(g.titulares || []), ...(g.suplente ? [g.suplente] : [])]),
    ...eliminar
  ].map(String);
  if (!destinos.length) throw new ErrorNegocio(400, 'No se indicaron aves a modificar.');
  const repetidas = destinos.filter((x, i) => destinos.indexOf(x) !== i);
  if (repetidas.length)
    throw new ErrorNegocio(400, 'Un ave no puede quedar en más de una presentación a la vez.', { repetidas: [...new Set(repetidas)] });

  const inscripciones = await Inscripcion.find({ _id: { $in: destinos }, competenciaId: competencia._id, socioId }).lean();
  if (inscripciones.length !== destinos.length)
    throw new ErrorNegocio(400, 'Algunas aves no pertenecen a este socio o a esta competencia.');
  const porId = new Map(inscripciones.map(i => [id(i._id), i]));

  // Grupos de origen completos
  const gruposOrigen = [...new Set(inscripciones.map(i => i.grupoPresentacion).filter(Boolean))];
  const integrantesOrigen = gruposOrigen.length
    ? await Inscripcion.find({ competenciaId: competencia._id, grupoPresentacion: { $in: gruposOrigen } }).lean()
    : [];
  const faltantes = integrantesOrigen.filter(i => !porId.has(id(i._id)));
  if (faltantes.length)
    throw new ErrorNegocio(400, 'Debe incluir a todos los integrantes de los dúos/cuartetos que modifica.', {
      faltantes: faltantes.map(f => f.numAnillo)
    });

  // Validar cada grupo destino
  for (const g of grupos) {
    const n = TAMANIO[g.tipo];
    if (!n) throw new ErrorNegocio(400, `Tipo de presentación inválido: ${g.tipo}`);
    if ((g.titulares || []).length !== n)
      throw new ErrorNegocio(400, `${g.tipo === 'individual' ? 'Un individual' : g.tipo === 'duos' ? 'Un dúo' : 'Un cuarteto'} requiere exactamente ${n} ave/s titular/es.`);
    if (g.suplente && g.tipo !== 'cuartetos')
      throw new ErrorNegocio(400, 'Solo los cuartetos admiten suplente.');
    const codigos = new Set([...g.titulares, ...(g.suplente ? [g.suplente] : [])].map(x => porId.get(String(x)).codigoNomenclador));
    if (codigos.size > 1)
      throw new ErrorNegocio(400, 'Todas las aves de un dúo/cuarteto deben ser del mismo lote (código de nomenclador).');
  }

  const antes = agruparUnidades(inscripciones);
  await validarMaximos(competencia, socioId, destinos,
    grupos.map(g => ({ tipo: g.tipo, codigo: porId.get(String(g.titulares[0])).codigoNomenclador })));

  // Construcción de escrituras
  const actualizaciones = [];
  const despues = [];
  for (const g of grupos) {
    const grupo = g.tipo === 'individual' ? null : randomUUID();
    actualizaciones.push({ ids: g.titulares, set: { tipoPresentacion: g.tipo, grupoPresentacion: grupo, esSuplente: false } });
    if (g.suplente) actualizaciones.push({ ids: [g.suplente], set: { tipoPresentacion: g.tipo, grupoPresentacion: grupo, esSuplente: true } });
    despues.push({
      tipo: g.tipo, grupo,
      titulares: g.titulares.map(x => porId.get(String(x))),
      suplente: g.suplente ? porId.get(String(g.suplente)) : null
    });
  }

  const acciones = derivarAcciones(antes, despues, eliminar.map(x => porId.get(String(x))));
  if (!acciones.length) throw new ErrorNegocio(400, 'La composición indicada no produce cambios.');

  const base = auditoriaBase(user, competencia, socioId);
  const estadoAnterior = resumen(antes);
  const estadoNuevo = resumen(despues);
  await aplicar({
    snapshotIds: destinos,
    actualizaciones,
    eliminar: eliminar.map(String),
    auditorias: acciones.map(a => ({ ...base, accion: a.accion, detalle: a.detalle, estadoAnterior, estadoNuevo }))
  });
  return { acciones: acciones.map(a => a.accion), composicion: await composicionDeSocio(competencia._id, socioId) };
}

const firma = (u) => [...u.titulares.map(t => id(t._id)).sort(), `s:${u.suplente ? id(u.suplente._id) : ''}`, u.tipo].join(',');

/** Traduce el cambio antes→después a acciones de auditoría */
function derivarAcciones(antes, despues, eliminadas) {
  const acciones = [];
  const firmasDespues = new Set(despues.map(firma));
  const firmasAntes = new Set(antes.map(firma));
  const unidadDe = new Map();
  antes.forEach(u => [...u.titulares, ...(u.suplente ? [u.suplente] : [])].forEach(i => unidadDe.set(id(i._id), u)));
  const anillos = (u) => u.titulares.map(t => t.numAnillo).join(', ');

  for (const u of antes) {
    if (u.tipo === 'individual' || firmasDespues.has(firma(u))) continue;
    const todosEliminados = [...u.titulares, ...(u.suplente ? [u.suplente] : [])].every(i => eliminadas.some(e => id(e._id) === id(i._id)));
    acciones.push({
      accion: todosEliminados ? 'ELIMINAR_COMPOSICION' : u.tipo === 'duos' ? 'DESARMAR_DUO' : 'DESARMAR_CUARTETO',
      detalle: `${u.tipo} [${anillos(u)}]`
    });
  }
  for (const u of despues) {
    if (firmasAntes.has(firma(u))) continue;
    if (u.tipo === 'individual') {
      if (unidadDe.get(id(u.titulares[0]._id))?.tipo !== 'individual')
        acciones.push({ accion: 'CONVERTIR_A_INDIVIDUAL', detalle: `anillo ${u.titulares[0].numAnillo}` });
      continue;
    }
    const venianDeDuo = u.tipo === 'cuartetos' && u.titulares.some(t => unidadDe.get(id(t._id))?.tipo === 'duos');
    acciones.push({
      accion: u.tipo === 'duos' ? 'CREAR_DUO' : venianDeDuo ? 'TRANSFORMAR_DUO_CUARTETO' : 'CREAR_CUARTETO',
      detalle: `${u.tipo} [${anillos(u)}]${u.suplente ? ` suplente ${u.suplente.numAnillo}` : ''}`
    });
  }
  for (const e of eliminadas) {
    if (unidadDe.get(id(e._id))?.tipo === 'individual')
      acciones.push({ accion: 'ELIMINAR_INDIVIDUAL', detalle: `anillo ${e.numAnillo}` });
  }
  return acciones;
}

// ── Quitar un ave (Tarea 5) ─────────────────────────────────────────────────
const OPCIONES_DUO = [
  { valor: 'individual', label: 'Convertir en Individual' },
  { valor: 'eliminar', label: 'Eliminar Definitivamente' }
];
const OPCIONES_CUARTETO = [
  { valor: 'individuales', label: 'Convertir a Individuales' },
  { valor: 'eliminar', label: 'Eliminar Definitivamente' }
];

/**
 * Elimina un ave respetando la integridad de su presentación:
 * - individual o suplente: se elimina.
 * - integrante de dúo: requiere resolucion 'individual' | 'eliminar'.
 * - titular de cuarteto: si hay suplente, sube automáticamente; si no,
 *   requiere resolucion 'individuales' | 'eliminar'.
 * Sin resolución válida responde 409 con las opciones disponibles.
 */
async function quitarAve({ inscripcion, competencia, resolucion, user }) {
  await verificarGestion(competencia, inscripcion.socioId, user);
  const base = auditoriaBase(user, competencia, inscripcion.socioId);
  const quitadoId = id(inscripcion._id);

  if (!inscripcion.grupoPresentacion || inscripcion.esSuplente) {
    await aplicar({
      snapshotIds: [quitadoId], actualizaciones: [], eliminar: [quitadoId],
      auditorias: [{ ...base, accion: 'ELIMINAR_INDIVIDUAL', detalle: `anillo ${inscripcion.numAnillo}${inscripcion.esSuplente ? ' (suplente)' : ''}`,
        estadoAnterior: { anillo: inscripcion.numAnillo, tipo: inscripcion.tipoPresentacion }, estadoNuevo: null }]
    });
    return { resultado: 'eliminada' };
  }

  const grupo = await Inscripcion.find({ competenciaId: competencia._id, grupoPresentacion: inscripcion.grupoPresentacion }).lean();
  const [unidad] = agruparUnidades(grupo);
  const restantes = unidad.titulares.filter(t => id(t._id) !== quitadoId);
  const todos = grupo.map(g => id(g._id));
  const estadoAnterior = resumen([unidad]);

  // Cuarteto con suplente: el suplente ocupa el lugar del titular
  if (unidad.tipo === 'cuartetos' && unidad.suplente) {
    await aplicar({
      snapshotIds: todos,
      actualizaciones: [{ ids: [id(unidad.suplente._id)], set: { esSuplente: false } }],
      eliminar: [quitadoId],
      auditorias: [{ ...base, accion: 'PROMOVER_SUPLENTE',
        detalle: `sale ${inscripcion.numAnillo}, entra ${unidad.suplente.numAnillo}`,
        estadoAnterior,
        estadoNuevo: [{ tipo: 'cuartetos', grupo: unidad.grupo, anillos: [...restantes.map(r => r.numAnillo), unidad.suplente.numAnillo], suplente: null }] }]
    });
    return { resultado: 'suplente_promovido', suplente: unidad.suplente.numAnillo };
  }

  const opciones = unidad.tipo === 'duos' ? OPCIONES_DUO : OPCIONES_CUARTETO;
  if (!opciones.some(o => o.valor === resolucion)) {
    throw new ErrorNegocio(409,
      unidad.tipo === 'duos'
        ? `El dúo quedaría con 1 sola ave (${restantes.map(r => r.numAnillo).join(', ')}). Elija cómo continuar.`
        : `El cuarteto quedaría incompleto (${restantes.length} aves) y no tiene suplente. Elija cómo continuar.`,
      { codigo: 'REQUIERE_RESOLUCION', tipo: unidad.tipo, restantes: restantes.map(r => r.numAnillo), opciones });
  }

  if (resolucion === 'eliminar') {
    await aplicar({
      snapshotIds: todos, actualizaciones: [], eliminar: todos,
      auditorias: [{ ...base, accion: 'ELIMINAR_COMPOSICION', detalle: `${unidad.tipo} completo`, estadoAnterior, estadoNuevo: null }]
    });
    return { resultado: 'composicion_eliminada', eliminadas: todos.length };
  }

  // Convertir los restantes a individuales
  await validarMaximos(competencia, inscripcion.socioId, todos,
    restantes.map(() => ({ tipo: 'individual', codigo: unidad.codigo })));
  await aplicar({
    snapshotIds: todos,
    actualizaciones: [{ ids: restantes.map(r => id(r._id)), set: { tipoPresentacion: 'individual', grupoPresentacion: null, esSuplente: false } }],
    eliminar: [quitadoId],
    auditorias: [
      { ...base, accion: unidad.tipo === 'duos' ? 'DESARMAR_DUO' : 'DESARMAR_CUARTETO', detalle: `sale ${inscripcion.numAnillo}`, estadoAnterior,
        estadoNuevo: restantes.map(r => ({ tipo: 'individual', anillos: [r.numAnillo] })) },
      ...restantes.map(r => ({ ...base, accion: 'CONVERTIR_A_INDIVIDUAL', detalle: `anillo ${r.numAnillo}`, estadoAnterior,
        estadoNuevo: [{ tipo: 'individual', anillos: [r.numAnillo] }] }))
    ]
  });
  return { resultado: 'convertidas_a_individual', individuales: restantes.map(r => r.numAnillo) };
}

/** Elimina un dúo/cuarteto completo (auditado) */
async function eliminarGrupo({ competencia, grupoPresentacion, user }) {
  const grupo = await Inscripcion.find({ competenciaId: competencia._id, grupoPresentacion }).lean();
  if (!grupo.length) throw new ErrorNegocio(404, 'Grupo no encontrado');
  await verificarGestion(competencia, grupo[0].socioId, user);
  const todos = grupo.map(g => id(g._id));
  await aplicar({
    snapshotIds: todos, actualizaciones: [], eliminar: todos,
    auditorias: [{ ...auditoriaBase(user, competencia, grupo[0].socioId), accion: 'ELIMINAR_COMPOSICION',
      detalle: `${grupo[0].tipoPresentacion} completo`, estadoAnterior: resumen(agruparUnidades(grupo)), estadoNuevo: null }]
  });
  return { eliminadas: todos.length };
}

module.exports = {
  ErrorNegocio, agruparUnidades, composicionDeSocio, recomponer, quitarAve, eliminarGrupo,
  verificarGestion, derivarAcciones, auditoriaBase
};
