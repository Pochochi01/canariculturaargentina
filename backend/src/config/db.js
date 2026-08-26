const mongoose = require('mongoose');

/**
 * Fuerza la creación de la colección 'inscripciones' si no existe.
 * Evita el warning "ns does not exist" que MongoDB emite cuando Mongoose
 * intenta sincronizar índices sobre una colección que aún no fue creada.
 */
const ensureCollections = async () => {
  for (const col of ['inscripciones', 'socios']) {
    try {
      await mongoose.connection.db.createCollection(col);
      console.log(`Colección ${col} creada`);
    } catch (err) {
      if (err.code !== 48) {
        console.warn(`No se pudo crear colección ${col}:`, err.message);
      }
    }
  }
};

/**
 * Índices obsoletos por colección.
 * Cada entrada: { coleccion, matcher } donde matcher(key) devuelve true si el índice debe borrarse.
 *
 * inscripciones:
 *  - { socioId, numAnillo }         : unicidad global por socio+anillo (demasiado restrictivo)
 *  - { competenciaId, numAnillo }   : unicidad por competencia+anillo sin socioId
 *
 * socios:
 *  - { anilloCriador }              : unicidad global reemplazada por { anilloCriador, sociedadId }
 *  - { dni }                        : unicidad global reemplazada por { dni, sociedadId }
 *
 * ejemplares:
 *  - { socioId, numAnillo }         : reemplazado por unicidad global { numAnillo, temporadaAnillado, procedencia }
 *                                     para permitir el mismo n° de anillo con distinto criador
 */
const OBSOLETE_INDEXES = [
  {
    coleccion: 'inscripciones',
    matcher: (key) => key.socioId === 1 && key.numAnillo === 1 && !key.competenciaId
  },
  {
    coleccion: 'inscripciones',
    matcher: (key) => key.competenciaId === 1 && key.numAnillo === 1 && !key.socioId
  },
  {
    coleccion: 'socios',
    matcher: (key) => key.anilloCriador === 1 && !key.sociedadId
  },
  {
    coleccion: 'socios',
    matcher: (key) => key.dni === 1 && !key.sociedadId
  },
  {
    coleccion: 'ejemplares',
    matcher: (key) => key.socioId === 1 && key.numAnillo === 1 && !key.temporadaAnillado && !key.procedencia
  },
];

const dropObsoleteIndexes = async () => {
  for (const { coleccion, matcher } of OBSOLETE_INDEXES) {
    try {
      const col = mongoose.connection.collection(coleccion);
      const indexes = await col.indexes();
      for (const idx of indexes) {
        if (!idx.key) continue;
        if (matcher(idx.key)) {
          await col.dropIndex(idx.name);
          console.log(`Índice obsoleto "${idx.name}" eliminado de ${coleccion}`);
        }
      }
    } catch (err) {
      if (err.codeName !== 'IndexNotFound' && err.codeName !== 'NamespaceNotFound') {
        console.warn(`No se pudo verificar índices obsoletos en ${coleccion}:`, err.message);
      }
    }
  }
};

const connectDB = async () => {
  try {
    // autoIndex:false evita que Mongoose sincronice índices automáticamente en segundo plano.
    // Los sincronizamos manualmente después de limpiar los obsoletos.
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    console.log('MongoDB conectado correctamente');
    await ensureCollections();
    await dropObsoleteIndexes();
    // Sincronizar índices de todos los modelos cargados, en orden correcto
    await mongoose.syncIndexes();
    console.log('Índices sincronizados correctamente');
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
