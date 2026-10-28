// Organización del listado de competencias (admin de sociedad)

export const FILTROS = [
  { valor: 'todas',      label: 'Todas' },
  { valor: 'propias',    label: 'Propias' },
  { valor: 'federacion', label: 'Federación' },
  { valor: 'nacional',   label: 'Nacionales' },
  { valor: 'mundial',    label: 'Mundiales' },
  { valor: 'abierto',    label: 'Abiertos' }
];

const idDe = (v) => (v?._id ?? v)?.toString();

export const esPropia = (c, user) => !!c.sociedadId && idDe(c.sociedadId) === idDe(user?.sociedadId);

export function filtrar(competencias, filtro, user) {
  switch (filtro) {
    case 'propias':    return competencias.filter(c => esPropia(c, user));
    case 'federacion': return competencias.filter(c => !esPropia(c, user));
    case 'nacional':
    case 'mundial':
    case 'abierto':    return competencias.filter(c => c.tipoCompetencia === filtro);
    default:           return competencias;
  }
}

// Activa = inscripción abierta y no finalizada. Todo lo demás es historial.
export const esActiva = (c) => c.estadoInscripcion === 'abierta' && c.estadoCompetencia !== 'finalizada';

const tiempo = (c) => (c.fecha ? new Date(c.fecha).getTime() : null);

/**
 * Activas: la más próxima primero (fecha ascendente; sin fecha al final).
 * Historial: la más reciente primero (fecha descendente; sin fecha al final).
 */
export function agrupar(competencias) {
  const activas = competencias.filter(esActiva).sort((a, b) => (tiempo(a) ?? Infinity) - (tiempo(b) ?? Infinity));
  const historial = competencias.filter(c => !esActiva(c)).sort((a, b) => (tiempo(b) ?? -Infinity) - (tiempo(a) ?? -Infinity));
  return { activas, historial };
}

export const MSG_FINALIZAR_ABIERTA =
  'No es posible finalizar la competencia mientras la inscripción permanezca abierta. Debe cerrar la inscripción previamente.';
