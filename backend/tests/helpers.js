process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Los errores simulados se registran en errorHandler; se silencian para un reporte legible
jest.spyOn(console, 'error').mockImplementation(() => {});

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet, MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const Sociedad = require('../src/models/Sociedad');
const Federacion = require('../src/models/Federacion');
const Socio = require('../src/models/Socio');
const Competencia = require('../src/models/Competencia');
const Inscripcion = require('../src/models/Inscripcion');
const Premio = require('../src/models/Premio');

let servidor;

/** replSet=true → transacciones reales; false → MongoDB standalone (rollback por compensación) */
async function conectar({ replSet = true } = {}) {
  servidor = replSet
    ? await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
    : await MongoMemoryServer.create();
  await mongoose.connect(servidor.getUri());
  await Promise.all(Object.values(mongoose.models).map(m => m.syncIndexes()));
}

async function desconectar() {
  await mongoose.disconnect();
  await servidor?.stop();
}

async function limpiar() {
  await Promise.all(Object.values(mongoose.connection.collections).map(c => c.deleteMany({})));
}

const token = (user, role) => `Bearer ${jwt.sign({ id: user._id, role }, process.env.JWT_SECRET)}`;

/**
 * Escenario base:
 *   FED1: sociedades A y B · FED2: sociedad C
 *   Usuarios: general, adminA, adminB, adminC, socio (del socio s1), operador
 */
async function escenario() {
  const [fed1, fed2] = await Federacion.create([{ codigo: 'FED1' }, { codigo: 'FED2' }]);
  const [socA, socB, socC] = await Sociedad.create([
    { codigo: 'SA', nombre: 'Sociedad A', federacion: 'FED1' },
    { codigo: 'SB', nombre: 'Sociedad B', federacion: 'FED1' },
    { codigo: 'SC', nombre: 'Sociedad C', federacion: 'FED2' }
  ]);
  const hash = 'x';
  const [general, adminA, adminB, adminC, socioUser, operador] = await User.create([
    { dni: '1', passwordHash: hash, roles: ['admin_general'] },
    { dni: '2', passwordHash: hash, roles: ['admin_sociedad'], sociedadId: socA._id },
    { dni: '3', passwordHash: hash, roles: ['admin_sociedad'], sociedadId: socB._id },
    { dni: '4', passwordHash: hash, roles: ['admin_sociedad'], sociedadId: socC._id },
    { dni: '5', passwordHash: hash, roles: ['socio'], sociedadId: socA._id },
    { dni: '6', passwordHash: hash, roles: ['operador'] }
  ]);
  const [s1, s2, sB] = await Socio.create([
    { anilloCriador: 'AA01', dni: '101', nombre: 'Ana', apellido: 'Uno', sociedadId: socA._id, userId: socioUser._id },
    { anilloCriador: 'AA02', dni: '102', nombre: 'Beto', apellido: 'Dos', sociedadId: socA._id },
    { anilloCriador: 'BB01', dni: '201', nombre: 'Caro', apellido: 'Tres', sociedadId: socB._id }
  ]);
  await Premio.create([
    { tipo: '1°', label: 'Primero', puntosIndividual: 10, puntosDuos: 20, puntosCuartetos: 40 },
    { tipo: '2°', label: 'Segundo', puntosIndividual: 5, puntosDuos: 10, puntosCuartetos: 20 }
  ]);
  const t = {
    general: token(general, 'admin_general'),
    adminA: token(adminA, 'admin_sociedad'),
    adminB: token(adminB, 'admin_sociedad'),
    adminC: token(adminC, 'admin_sociedad'),
    socio: token(socioUser, 'socio'),
    operador: token(operador, 'operador')
  };
  return { fed1, fed2, socA, socB, socC, s1, s2, sB, general, adminA, socioUser, t };
}

const competencia = (data) => Competencia.create({ nombre: 'Comp', fecha: new Date(), ...data });

/** Inscribe aves: individuales si grupo es null; tipo/grupo compartidos para dúos/cuartetos */
async function inscribir(comp, socio, anillos, { tipo = 'individual', grupo = null, suplente = null, codigo = 'L1', premios } = {}) {
  const docs = anillos.map(a => ({
    competenciaId: comp._id, socioId: socio._id, numCriador: socio.anilloCriador,
    tipoNomenclador: 'color', codigoNomenclador: codigo, nombreNomenclador: `Lote ${codigo}`,
    tipoPresentacion: tipo, grupoPresentacion: grupo, numAnillo: a, esSuplente: a === suplente,
    ...(premios ? { premios } : {})
  }));
  return Inscripcion.create(docs);
}

module.exports = { conectar, desconectar, limpiar, escenario, competencia, inscribir, token };
