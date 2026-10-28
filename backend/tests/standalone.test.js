// MongoDB sin replica set (como el servidor actual): sin transacciones nativas,
// el rollback debe hacerse por compensación sin dejar registros parciales.
const request = require('supertest');
const app = require('../src/app');
const Inscripcion = require('../src/models/Inscripcion');
const AuditoriaComposicion = require('../src/models/AuditoriaComposicion');
const { ejecutarTransaccion } = require('../src/utils/transaccion');
const { conectar, desconectar, limpiar, escenario, competencia, inscribir } = require('./helpers');

let e;
beforeAll(() => conectar({ replSet: false }));
afterAll(() => desconectar());
beforeEach(async () => { await limpiar(); e = await escenario(); });

test('ejecutarTransaccion usa compensación y la invoca ante un fallo', async () => {
  const compensar = jest.fn();
  const fn = async (session) => {
    await Inscripcion.countDocuments({}, { session }); // en standalone, con sesión transaccional falla
    throw new Error('x');
  };
  await expect(ejecutarTransaccion(fn, compensar)).rejects.toThrow('x');
  expect(compensar).toHaveBeenCalledTimes(1);
  await expect(ejecutarTransaccion(async () => 42)).resolves.toBe(42);
});

test('envío al Nacional: rollback por compensación', async () => {
  const clasica = await competencia({ sociedadId: e.socA._id, estadoInscripcion: 'juzgada', estadoCompetencia: 'finalizada' });
  const nacional = await competencia({ tipoCompetencia: 'nacional', federacionId: e.fed1._id });
  const aves = await inscribir(clasica, e.s1, ['0001', '0002'], { premios: [{ tipo: '1°' }] });
  const spy = jest.spyOn(AuditoriaComposicion, 'create').mockRejectedValueOnce(new Error('fallo'));
  const r = await request(app).post(`/api/competencias/${clasica._id}/aves-nacional`)
    .set('Authorization', e.t.adminA).send({ inscripcionIds: aves.map(a => a._id) });
  spy.mockRestore();
  expect(r.status).toBe(500);
  expect(await Inscripcion.countDocuments({ competenciaId: nacional._id })).toBe(0);

  const ok = await request(app).post(`/api/competencias/${clasica._id}/aves-nacional`)
    .set('Authorization', e.t.adminA).send({ inscripcionIds: aves.map(a => a._id) });
  expect(ok.body.agregadas).toBe(2);
});

test('recomposición: restaura el estado previo si falla la auditoría', async () => {
  const comp = await competencia({ sociedadId: e.socA._id });
  const duo = await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g' });
  const spy = jest.spyOn(AuditoriaComposicion, 'insertMany').mockRejectedValueOnce(new Error('fallo'));
  const r = await request(app).post('/api/inscripciones/composicion').set('Authorization', e.t.adminA).send({
    competenciaId: comp._id, socioId: e.s1._id,
    grupos: duo.map(d => ({ tipo: 'individual', titulares: [d._id] }))
  });
  spy.mockRestore();
  expect(r.status).toBe(500);
  const docs = await Inscripcion.find({ competenciaId: comp._id });
  expect(docs).toHaveLength(2);
  expect(docs.every(d => d.grupoPresentacion === 'g' && d.tipoPresentacion === 'duos')).toBe(true);
});
