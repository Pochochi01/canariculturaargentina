/**
 * Script puntual: asigna múltiples roles a usuarios existentes.
 * Ejecutar desde la carpeta backend:
 *   node scripts/asignar-multi-rol.js
 */
require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User     = require('../src/models/User');

// ── Usuarios a actualizar ─────────────────────────────────────────────────────
// Ajustar DNIs y roles según necesidad.
const ACTUALIZACIONES = [
  { dni: '27496807', roles: ['admin_sociedad', 'socio'] },
  { dni: '27713474', roles: ['admin_sociedad', 'socio'] }
];
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB\n');

  for (const { dni, roles } of ACTUALIZACIONES) {
    const user = await User.findOne({ dni });

    if (!user) {
      console.warn(`  [OMITIDO] DNI ${dni} — usuario no encontrado`);
      continue;
    }

    const previos = user.effectiveRoles();
    user.roles = roles;
    user.role  = roles[0]; // mantener campo legacy sincronizado
    await user.save();

    console.log(`  [OK] DNI ${dni}`);
    console.log(`       Antes : ${previos.join(', ')}`);
    console.log(`       Ahora : ${roles.join(', ')}\n`);
  }

  await mongoose.disconnect();
  console.log('Listo.');
}

main().catch(err => { console.error(err); process.exit(1); });
