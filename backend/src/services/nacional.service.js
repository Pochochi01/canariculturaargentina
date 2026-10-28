const { randomUUID } = require('crypto');
const Competencia = require('../models/Competencia');
const Inscripcion = require('../models/Inscripcion');
const Premio = require('../models/Premio');
const AuditoriaComposicion = require('../models/AuditoriaComposicion');
const { ejecutarTransaccion } = require('../utils/transaccion');
const { federacionDeSociedad, puedeAdministrar } = require('./competenciaAcceso.service');
const { ErrorNegocio, auditoriaBase } = require('./composicion.service');

const MSG_SIN_NACIONAL = 'No existe una competencia nacional vigente para esta federación.';
const CAMPO_PUNTOS = { individual: 'puntosIndividual', duos: 'puntosDuos', cuartetos: 'puntosCuartetos' };
const id = (v) => (v?._id ?? v)?.toString();

/** Valida que la competencia admita "Aves al Nacional" y que el usuario pueda usarlo */
function validarOrigen(competencia, user) {
  if (!puedeAdministrar(competencia, user))
    throw new ErrorNegocio(403, 'No tiene permisos para enviar aves al Nacional desde esta competencia.');
  if (competencia.tipoCompetencia !== 'clasica' || competencia.estadoCompetencia !== 'finalizada')
    throw new ErrorNegocio(400, '"Aves al Nacional" solo está disponible en competencias clásicas finalizadas.');
}

/**
 * Nacional vigente de la federación de la sociedad organizadora:
 * tipo nacional, en curso y con inscripción abierta. Si hay varias, la de fecha más próxima.
 */
async function buscarNacionalVigente(competencia) {
  const { federacionId } = await federacionDeSociedad(competencia.sociedadId);
  if (!federacionId) return null;
  const candidatas = await Competencia.find({
    tipoCompetencia: 'nacional',
    federacionId,
    estadoCompetencia: 'en_curso',
    estadoInscripcion: 'abierta'
  }).populate('federacionId', 'codigo nombre').lean();
  const hoy = Date.now();
  const clave = (c) => (c.fecha ? Math.abs(new Date(c.fecha).getTime() - hoy) : Number.MAX_SAFE_INTEGER);
  return candidatas.sort((a, b) => clave(a) - clave(b))[0] || null;
}

/** Aves premiadas de la competencia, con puntos y si ya fueron enviadas */
async function listarPremiadas(competencia, user) {
  validarOrigen(competencia, user);
  const [premiadas, tablaPremios, nacional] = await Promise.all([
    Inscripcion.find({ competenciaId: competencia._id, 'premios.0': { $exists: true } })
      .populate('socioId', 'nombre apellido anilloCriador')
      .sort({ codigoNomenclador: 1, numJaula: 1 })
      .lean(),
    Premio.find().lean(),
    buscarNacionalVigente(competencia)
  ]);
  const puntosPorTipo = new Map(tablaPremios.map(p => [p.tipo, p]));
  const enviadas = nacional
    ? new Set((await Inscripcion.find({ competenciaId: nacional._id, origenInscripcionId: { $in: premiadas.map(p => p._id) } })
        .select('origenInscripcionId').lean()).map(i => id(i.origenInscripcionId)))
    : new Set();

  return {
    nacional: nacional && { _id: nacional._id, nombre: nacional.nombre, fecha: nacional.fecha, federacion: nacional.federacionId },
    aves: premiadas.map(i => ({
      _id: i._id,
      numAnillo: i.numAnillo,
      numJaula: i.numJaula,
      nombre: i.nombreNomenclador,
      categoria: i.codigoNomenclador,
      tipoPresentacion: i.tipoPresentacion,
      grupoPresentacion: i.grupoPresentacion,
      esSuplente: i.esSuplente,
      socio: i.socioId && {
        _id: i.socioId._id,
        nombre: [i.socioId.apellido, i.socioId.nombre].filter(Boolean).join(', '),
        anilloCriador: i.socioId.anilloCriador
      },
      premios: i.premios.map(p => p.tipo),
      puntaje: i.puntaje,
      puntos: i.premios.reduce((s, p) => s + (puntosPorTipo.get(p.tipo)?.[CAMPO_PUNTOS[i.tipoPresentacion] || 'puntosIndividual'] || 0), 0),
      enviada: enviadas.has(id(i._id))
    }))
  };
}

/**
 * Envía aves premiadas al Nacional vigente en una única transacción.
 * Un ave de dúo/cuarteto arrastra a su grupo completo para no romper la composición.
 * Omite (sin abortar) las que ya estaban en el Nacional; cualquier otro fallo hace rollback total.
 */
async function enviarAlNacional({ competencia, inscripcionIds, user }) {
  validarOrigen(competencia, user);
  if (!Array.isArray(inscripcionIds) || !inscripcionIds.length)
    throw new ErrorNegocio(400, 'Debe seleccionar al menos un ave.');

  const nacional = await buscarNacionalVigente(competencia);
  if (!nacional) throw new ErrorNegocio(404, MSG_SIN_NACIONAL, { codigo: 'SIN_NACIONAL' });

  const seleccion = await Inscripcion.find({
    _id: { $in: inscripcionIds }, competenciaId: competencia._id, 'premios.0': { $exists: true }
  }).lean();
  if (seleccion.length !== new Set(inscripcionIds.map(String)).size)
    throw new ErrorNegocio(400, 'Algunas aves seleccionadas no existen o no fueron premiadas en esta competencia.');

  // Expandir a grupos completos
  const grupos = [...new Set(seleccion.map(s => s.grupoPresentacion).filter(Boolean))];
  const extra = grupos.length
    ? await Inscripcion.find({ competenciaId: competencia._id, grupoPresentacion: { $in: grupos } }).lean()
    : [];
  const candidatas = [...new Map([...seleccion, ...extra].map(i => [id(i._id), i])).values()];

  // Duplicados: ya enviada desde este origen, o mismo socio+anillo ya inscripto en el Nacional
  const existentes = await Inscripcion.find({
    competenciaId: nacional._id,
    $or: [
      { origenInscripcionId: { $in: candidatas.map(c => c._id) } },
      { $and: [{ socioId: { $in: candidatas.map(c => c.socioId).filter(Boolean) } }, { numAnillo: { $in: candidatas.map(c => c.numAnillo) } }] }
    ]
  }).select('origenInscripcionId socioId numAnillo').lean();
  const yaOrigen = new Set(existentes.map(e => id(e.origenInscripcionId)).filter(Boolean));
  const yaAnillo = new Set(existentes.map(e => `${id(e.socioId)}|${e.numAnillo}`));
  const esDuplicada = (c) => yaOrigen.has(id(c._id)) || yaAnillo.has(`${id(c.socioId)}|${c.numAnillo}`);

  // Un grupo con algún integrante duplicado se omite completo (no se parte la composición)
  const gruposDuplicados = new Set(candidatas.filter(c => c.grupoPresentacion && esDuplicada(c)).map(c => c.grupoPresentacion));
  const omitidas = [];
  const aEnviar = [];
  for (const c of candidatas) {
    if (esDuplicada(c) || gruposDuplicados.has(c.grupoPresentacion)) {
      omitidas.push({
        numAnillo: c.numAnillo,
        socio: c.numCriador,
        motivo: esDuplicada(c) ? 'El ave ya fue enviada / inscripta en el Nacional' : 'Otro integrante de su dúo/cuarteto ya está en el Nacional'
      });
    } else aEnviar.push(c);
  }

  const nuevoGrupo = new Map();
  const documentos = aEnviar.map(c => {
    if (c.grupoPresentacion && !nuevoGrupo.has(c.grupoPresentacion)) nuevoGrupo.set(c.grupoPresentacion, randomUUID());
    return {
      competenciaId: nacional._id,
      numCriador: c.numCriador,
      socioId: c.socioId,
      tipoNomenclador: c.tipoNomenclador,
      codigoNomenclador: c.codigoNomenclador,
      nombreNomenclador: c.nombreNomenclador,
      tipoPresentacion: c.tipoPresentacion,
      grupoPresentacion: c.grupoPresentacion ? nuevoGrupo.get(c.grupoPresentacion) : null,
      numAnillo: c.numAnillo,
      esSuplente: c.esSuplente,
      anioAnillo: c.anioAnillo,
      lote: c.lote || c.codigoNomenclador,
      observaciones: c.observaciones,
      origenInscripcionId: c._id,
      origenCompetenciaId: competencia._id,
      premiosOrigen: c.premios
    };
  });

  const loteEnvio = randomUUID();
  if (documentos.length) {
    await ejecutarTransaccion(async (session) => {
      await Inscripcion.insertMany(documentos, { session, ordered: true });
      await AuditoriaComposicion.create([{
        ...auditoriaBase(user, competencia, null),
        accion: 'ENVIAR_AL_NACIONAL',
        detalle: `envio:${loteEnvio}`,
        estadoAnterior: { competencia: competencia._id, anillos: aEnviar.map(a => a.numAnillo) },
        estadoNuevo: { nacional: nacional._id, agregadas: documentos.length, omitidas: omitidas.length }
      }], { session });
    }, async () => {
      // Rollback manual (standalone): elimina todo lo insertado en este envío
      await Inscripcion.deleteMany({ competenciaId: nacional._id, origenInscripcionId: { $in: aEnviar.map(a => a._id) } });
      await AuditoriaComposicion.deleteMany({ detalle: `envio:${loteEnvio}` });
    });
  }

  return {
    nacional: { _id: nacional._id, nombre: nacional.nombre },
    agregadas: documentos.length,
    omitidas: omitidas.length,
    errores: 0,
    detalleOmitidas: omitidas,
    mensaje: omitidas.length
      ? `${documentos.length} agregadas · ${omitidas.length} omitidas por duplicidad`
      : `${documentos.length} aves agregadas al Nacional · 0 errores`
  };
}

module.exports = { listarPremiadas, enviarAlNacional, buscarNacionalVigente, MSG_SIN_NACIONAL };
