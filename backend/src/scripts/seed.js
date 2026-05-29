require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const NomencladorColor = require('../models/NomencladorColor');
const NomencladorForma = require('../models/NomencladorForma');

const coloresSeed = [
  { codigo: 'AM', nombreLinea: 'Amarillo' },
  { codigo: 'BL', nombreLinea: 'Blanco' },
  { codigo: 'RO', nombreLinea: 'Rojo' },
  { codigo: 'NA', nombreLinea: 'Naranja' },
  { codigo: 'VE', nombreLinea: 'Verde' },
  { codigo: 'AZ', nombreLinea: 'Azul' },
  { codigo: 'LI', nombreLinea: 'Lila' },
  { codigo: 'ME', nombreLinea: 'Melanico' },
  { codigo: 'IS', nombreLinea: 'Isabel' },
  { codigo: 'AG', nombreLinea: 'Ágata' },
];

const formasSeed = [
  { codigo: 'GL', nombreLinea: 'Gloster' },
  { codigo: 'BE', nombreLinea: 'Belgian' },
  { codigo: 'BO', nombreLinea: 'Border' },
  { codigo: 'FR', nombreLinea: 'Frill' },
  { codigo: 'LI', nombreLinea: 'Lizard' },
  { codigo: 'YO', nombreLinea: 'Yorkshire' },
  { codigo: 'NO', nombreLinea: 'Norwich' },
  { codigo: 'SC', nombreLinea: 'Scotch Fancy' },
  { codigo: 'CT', nombreLinea: 'Crested' },
  { codigo: 'FI', nombreLinea: 'Fife Fancy' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');

  const adminExists = await User.findOne({ dni: '00000000' });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 12);
    await User.create({ dni: '00000000', passwordHash, role: 'admin_general' });
    console.log('Admin general creado - DNI: 00000000 / Clave: admin123');
  } else {
    console.log('Admin general ya existe');
  }

  for (const c of coloresSeed) {
    await NomencladorColor.findOneAndUpdate({ codigo: c.codigo }, c, { upsert: true });
  }
  console.log(`${coloresSeed.length} colores de nomenclador cargados`);

  for (const f of formasSeed) {
    await NomencladorForma.findOneAndUpdate({ codigo: f.codigo }, f, { upsert: true });
  }
  console.log(`${formasSeed.length} formas de nomenclador cargadas`);

  await mongoose.disconnect();
  console.log('Seed completado exitosamente');
}

seed().catch(err => { console.error(err); process.exit(1); });
