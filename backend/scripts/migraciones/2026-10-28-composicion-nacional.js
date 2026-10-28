#!/usr/bin/env node
/**
 * Migración 2026-10-28 — composición de presentaciones y "Aves al Nacional".
 *
 * 1. Crea los índices nuevos:
 *    - inscripcions { competenciaId, origenInscripcionId } único parcial (evita reenvíos duplicados)
 *    - auditoriacomposicions { competenciaId, fecha }
 * 2. Audita la integridad de los datos existentes (solo informa, no modifica):
 *    - dúos/cuartetos con cantidad incorrecta de titulares
 *    - grupos con lotes mezclados
 *    - competencias finalizadas con la inscripción abierta
 *    - inscripciones de competencias inexistentes (huérfanas)
 *
 * Uso:  node scripts/migraciones/2026-10-28-composicion-nacional.js            (solo informe)
 *       node scripts/migraciones/2026-10-28-composicion-nacional.js --aplicar  (crea índices)
 * Los campos nuevos de Inscripcion son opcionales: no requieren completar datos existentes.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Inscripcion = require('../../src/models/Inscripcion');
const Competencia = require('../../src/models/Competencia');
const AuditoriaComposicion = require('../../src/models/AuditoriaComposicion');

const APLICAR = process.argv.includes('--aplicar');
const TAMANIO = { duos: 2, cuartetos: 4 };

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Migración composición/nacional — modo ${APLICAR ? 'APLICAR' : 'INFORME'}\n`);

  if (APLICAR) {
    await Inscripcion.createIndexes();
    await AuditoriaComposicion.createIndexes();
    console.log('✔ Índices creados\n');
  } else {
    console.log('· Índices: se crearán con --aplicar (o automáticamente al iniciar el servidor)\n');
  }

  const grupos = await Inscripcion.aggregate([
    { $match: { grupoPresentacion: { $ne: null } } },
    { $group: {
      _id: { c: '$competenciaId', g: '$grupoPresentacion' },
      tipo: { $first: '$tipoPresentacion' },
      titulares: { $sum: { $cond: ['$esSuplente', 0, 1] } },
      lotes: { $addToSet: '$codigoNomenclador' },
      anillos: { $push: '$numAnillo' }
    } }
  ]);
  const malTamanio = grupos.filter(g => TAMANIO[g.tipo] && g.titulares !== TAMANIO[g.tipo]);
  const lotesMezclados = grupos.filter(g => g.lotes.length > 1);
  const finalizadasAbiertas = await Competencia.find({ estadoCompetencia: 'finalizada', estadoInscripcion: 'abierta' }).select('nombre').lean();
  const idsComp = (await Competencia.find().select('_id').lean()).map(c => c._id);
  const huerfanas = await Inscripcion.countDocuments({ competenciaId: { $nin: idsComp } });

  const informe = (titulo, lista, fmt) => {
    console.log(`${lista.length ? '⚠' : '✔'} ${titulo}: ${lista.length}`);
    lista.slice(0, 20).forEach(x => console.log(`    - ${fmt(x)}`));
  };
  informe('Dúos/cuartetos con cantidad incorrecta', malTamanio, g => `${g.tipo} [${g.anillos.join(', ')}] titulares=${g.titulares} (competencia ${g._id.c})`);
  informe('Grupos con lotes mezclados', lotesMezclados, g => `[${g.anillos.join(', ')}] lotes ${g.lotes.join('/')}`);
  informe('Competencias finalizadas con inscripción abierta', finalizadasAbiertas, c => c.nombre);
  console.log(`${huerfanas ? '⚠' : '✔'} Inscripciones huérfanas: ${huerfanas}`);
  console.log('\nLos casos marcados con ⚠ deben revisarse manualmente (este script no los modifica).');

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
