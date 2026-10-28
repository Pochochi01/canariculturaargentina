const mongoose = require('mongoose');

// Códigos que indican que el servidor no soporta transacciones (MongoDB standalone)
const SIN_TRANSACCIONES = /Transaction numbers are only allowed|replica set|IllegalOperation/i;

/**
 * Ejecuta `fn(session)` de forma atómica.
 *
 * - Con replica set / Atlas: transacción real de MongoDB (commit o abort).
 * - Con MongoDB standalone (sin soporte de transacciones): ejecuta `fn(null)` y, si falla,
 *   llama a `compensar()` para deshacer lo escrito (rollback manual). `compensar` debe
 *   restaurar el estado previo a partir de datos capturados antes de escribir.
 *
 * Así ninguna operación deja registros parciales en ninguno de los dos entornos.
 */
async function ejecutarTransaccion(fn, compensar) {
  let session;
  try {
    session = await mongoose.startSession();
    let resultado;
    await session.withTransaction(async () => { resultado = await fn(session); });
    return resultado;
  } catch (err) {
    if (!SIN_TRANSACCIONES.test(err?.message || '') && err?.code !== 20) throw err;
  } finally {
    await session?.endSession();
  }

  // Modo compensación (standalone)
  try {
    return await fn(null);
  } catch (err) {
    if (compensar) await compensar();
    throw err;
  }
}

module.exports = { ejecutarTransaccion };
