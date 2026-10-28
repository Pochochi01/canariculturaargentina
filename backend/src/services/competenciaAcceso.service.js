const Sociedad   = require('../models/Sociedad');
const Federacion = require('../models/Federacion');

const idDe = (v) => (v?._id ?? v)?.toString() || null;

/**
 * Federación de una sociedad: { codigo, federacionId } (ambos null si no tiene).
 * La sociedad guarda el código; las competencias nacionales/mundiales guardan el _id.
 */
async function federacionDeSociedad(sociedadId) {
  if (!sociedadId) return { codigo: null, federacionId: null };
  const soc = await Sociedad.findById(sociedadId).select('federacion').lean();
  const codigo = soc?.federacion?.trim().toUpperCase() || null;
  if (!codigo) return { codigo: null, federacionId: null };
  const fed = await Federacion.findOne({ codigo }).select('_id').lean();
  return { codigo, federacionId: fed?._id || null };
}

/**
 * Filtro de competencias visibles.
 * admin_sociedad: propias + (nacionales, mundiales y abiertos) de SU federación.
 * Nunca competencias de federaciones ajenas.
 */
async function filtroVisibilidad(user, extra = {}) {
  if (user.role !== 'admin_sociedad') return { ...extra };

  const condiciones = [{ sociedadId: user.sociedadId }];
  const { codigo, federacionId } = await federacionDeSociedad(user.sociedadId);
  if (federacionId) {
    condiciones.push({ tipoCompetencia: { $in: ['nacional', 'mundial'] }, federacionId });
  }
  if (codigo) {
    const sociedadesFed = await Sociedad.find({ federacion: codigo }).select('_id').lean();
    condiciones.push({ tipoCompetencia: 'abierto', sociedadId: { $in: sociedadesFed.map(s => s._id) } });
  }
  return { $or: condiciones, ...extra };
}

/** ¿El admin_sociedad puede ver/participar de esta competencia? */
async function puedeAcceder(competencia, user) {
  if (user.role === 'admin_general') return true;
  if (user.role !== 'admin_sociedad') return false;
  if (idDe(competencia.sociedadId) === idDe(user.sociedadId)) return true;

  const { codigo, federacionId } = await federacionDeSociedad(user.sociedadId);
  const tipo = competencia.tipoCompetencia;
  if (tipo === 'nacional' || tipo === 'mundial') {
    return !!federacionId && idDe(competencia.federacionId) === federacionId.toString();
  }
  if (tipo === 'abierto' && codigo && competencia.sociedadId) {
    const org = await Sociedad.findById(idDe(competencia.sociedadId)).select('federacion').lean();
    return org?.federacion?.trim().toUpperCase() === codigo;
  }
  return false;
}

/** ¿Puede administrarla (organizador)? admin_general o admin de la sociedad organizadora */
function puedeAdministrar(competencia, user) {
  if (user.role === 'admin_general') return true;
  return user.role === 'admin_sociedad' &&
    !!competencia.sociedadId && idDe(competencia.sociedadId) === idDe(user.sociedadId);
}

module.exports = { federacionDeSociedad, filtroVisibilidad, puedeAcceder, puedeAdministrar };
