// Borrador local de la composición de un socio (individual / dúo / cuarteto).
// Las operaciones son puras: devuelven un borrador nuevo. El backend revalida todo.

export const TAMANIO = { individual: 1, duos: 2, cuartetos: 4 };
export const TIPO_LABEL = { individual: 'Individual', duos: 'Dúo', cuartetos: 'Cuarteto' };

let secuencia = 0;
const nuevaClave = () => `nueva-${++secuencia}`;

const ave = (i) => ({ _id: i._id, numAnillo: i.numAnillo, codigo: i.codigoNomenclador, nombre: i.nombreNomenclador });

/** Unidades del servidor → borrador { unidades: [...], eliminadas: [] } */
export function desdeServidor(unidades) {
  return {
    unidades: unidades.map(u => ({
      clave: u.grupo || u.titulares[0]._id,
      tipo: u.tipo,
      titulares: u.titulares.map(ave),
      suplente: u.suplente ? ave(u.suplente) : null
    })),
    eliminadas: []
  };
}

const miembros = (u) => [...u.titulares, ...(u.suplente ? [u.suplente] : [])];

/** Saca aves de sus unidades. Si sale un titular de cuarteto con suplente, el suplente sube. */
function quitar(unidades, ids) {
  const set = new Set(ids);
  return unidades
    .map(u => {
      const titulares = u.titulares.filter(t => !set.has(t._id));
      let suplente = u.suplente && !set.has(u.suplente._id) ? u.suplente : null;
      if (u.tipo === 'cuartetos' && suplente && titulares.length < 4) {
        titulares.push(suplente);
        suplente = null;
      }
      return { ...u, titulares, suplente };
    })
    .filter(u => u.titulares.length || u.suplente);
}

function avesPorId(borrador, ids) {
  const todas = borrador.unidades.flatMap(miembros);
  return ids.map(id => todas.find(a => a._id === id)).filter(Boolean);
}

/** Forma un dúo o cuarteto con las aves seleccionadas (suplenteId opcional para cuarteto) */
export function formar(borrador, ids, tipo, suplenteId = null) {
  const titularesIds = ids.filter(id => id !== suplenteId);
  if (titularesIds.length !== TAMANIO[tipo])
    throw new Error(`${TIPO_LABEL[tipo]} requiere exactamente ${TAMANIO[tipo]} aves titulares.`);
  if (suplenteId && tipo !== 'cuartetos') throw new Error('Solo los cuartetos admiten suplente.');
  const aves = avesPorId(borrador, ids);
  if (new Set(aves.map(a => a.codigo)).size > 1)
    throw new Error('Todas las aves deben ser del mismo lote.');
  return {
    ...borrador,
    unidades: [
      ...quitar(borrador.unidades, ids),
      {
        clave: nuevaClave(), tipo,
        titulares: avesPorId(borrador, titularesIds),
        suplente: suplenteId ? avesPorId(borrador, [suplenteId])[0] : null
      }
    ]
  };
}

/** Pasa las aves seleccionadas a individuales */
export function aIndividual(borrador, ids) {
  const aves = avesPorId(borrador, ids);
  return {
    ...borrador,
    unidades: [
      ...quitar(borrador.unidades, ids),
      ...aves.map(a => ({ clave: nuevaClave(), tipo: 'individual', titulares: [a], suplente: null }))
    ]
  };
}

/** Elimina definitivamente las aves seleccionadas */
export function eliminar(borrador, ids) {
  return {
    unidades: quitar(borrador.unidades, ids),
    eliminadas: [...borrador.eliminadas, ...avesPorId(borrador, ids)]
  };
}

/** Problemas que impiden guardar: dúos/cuartetos incompletos */
export function validar(borrador) {
  return borrador.unidades
    .filter(u => u.titulares.length !== TAMANIO[u.tipo])
    .map(u => ({
      clave: u.clave,
      mensaje: `${TIPO_LABEL[u.tipo]} incompleto (${u.titulares.length}/${TAMANIO[u.tipo]}): ${u.titulares.map(t => t.numAnillo).join(', ')}. Conviértalo o elimínelo.`
    }));
}

const firma = (u) => `${u.tipo}|${u.titulares.map(t => t._id).sort().join(',')}|${u.suplente?._id || ''}`;

/** Diferencia original → borrador en el formato de POST /inscripciones/composicion */
export function construirPayload(original, borrador) {
  const firmasOriginales = new Set(original.unidades.map(firma));
  const cambiadas = borrador.unidades.filter(u => !firmasOriginales.has(firma(u)));
  return {
    grupos: cambiadas.map(u => ({
      tipo: u.tipo,
      titulares: u.titulares.map(t => t._id),
      ...(u.suplente ? { suplente: u.suplente._id } : {})
    })),
    eliminar: borrador.eliminadas.map(a => a._id)
  };
}

export const hayCambios = (original, borrador) => {
  const p = construirPayload(original, borrador);
  return p.grupos.length > 0 || p.eliminar.length > 0;
};
