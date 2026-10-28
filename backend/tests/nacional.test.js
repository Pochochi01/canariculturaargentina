const request = require('supertest');
const app = require('../src/app');
const Inscripcion = require('../src/models/Inscripcion');
const AuditoriaComposicion = require('../src/models/AuditoriaComposicion');
const { conectar, desconectar, limpiar, escenario, competencia, inscribir } = require('./helpers');

let e, clasica, nacional;
const P1 = [{ tipo: '1°' }];
beforeAll(() => conectar());
afterAll(() => desconectar());
beforeEach(async () => {
  await limpiar();
  e = await escenario();
  clasica = await competencia({ sociedadId: e.socA._id, estadoInscripcion: 'juzgada', estadoCompetencia: 'finalizada' });
  nacional = await competencia({ nombre: 'Nacional FED1', tipoCompetencia: 'nacional', federacionId: e.fed1._id });
});

const listar = (tok = e.t.adminA, comp = clasica) =>
  request(app).get(`/api/competencias/${comp._id}/aves-nacional`).set('Authorization', tok);
const enviar = (inscripcionIds, tok = e.t.adminA, comp = clasica) =>
  request(app).post(`/api/competencias/${comp._id}/aves-nacional`).set('Authorization', tok).send({ inscripcionIds });

describe('Tarea 9 — premiadas', () => {
  test('lista solo aves premiadas con socio, categoría, premio y puntos', async () => {
    await inscribir(clasica, e.s1, ['0001'], { premios: P1 });
    await inscribir(clasica, e.s1, ['0002']);                       // no premiada
    await inscribir(clasica, e.s1, ['0003', '0004'], { tipo: 'duos', grupo: 'g', premios: [{ tipo: '2°' }] });
    const r = await listar();
    expect(r.status).toBe(200);
    expect(r.body.nacional.nombre).toBe('Nacional FED1');
    expect(r.body.aves.map(a => a.numAnillo).sort()).toEqual(['0001', '0003', '0004']);
    const a1 = r.body.aves.find(a => a.numAnillo === '0001');
    expect(a1).toMatchObject({ categoria: 'L1', premios: ['1°'], puntos: 10, enviada: false });
    expect(a1.socio.nombre).toBe('UNO, Ana');
    expect(r.body.aves.find(a => a.numAnillo === '0003').puntos).toBe(10); // 2° en dúos
  });

  test('solo clásica finalizada', async () => {
    const enCurso = await competencia({ sociedadId: e.socA._id });
    expect((await listar(e.t.adminA, enCurso)).status).toBe(400);
  });
});

describe('Tarea 11/13 — envío al Nacional', () => {
  test('envía, conserva datos y reporta "N aves agregadas · 0 errores"', async () => {
    const aves = await inscribir(clasica, e.s1, ['0001', '0002'], { premios: P1 });
    const r = await enviar(aves.map(a => a._id));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ agregadas: 2, omitidas: 0, errores: 0 });
    expect(r.body.mensaje).toBe('2 aves agregadas al Nacional · 0 errores');
    const copia = await Inscripcion.findOne({ competenciaId: nacional._id, numAnillo: '0001' }).lean();
    expect(copia).toMatchObject({ numCriador: 'AA01', codigoNomenclador: 'L1', tipoPresentacion: 'individual', puntaje: null });
    expect(copia.socioId.toString()).toBe(e.s1._id.toString());
    expect(copia.origenInscripcionId.toString()).toBe(aves[0]._id.toString());
    expect(copia.premiosOrigen[0].tipo).toBe('1°');
    expect(copia.premios).toEqual([]);
    expect(await AuditoriaComposicion.countDocuments({ accion: 'ENVIAR_AL_NACIONAL' })).toBe(1);
  });

  test('reenvío: omite duplicados y detalla los casos', async () => {
    const aves = await inscribir(clasica, e.s1, ['0001', '0002'], { premios: P1 });
    await enviar([aves[0]._id]);
    const r = await enviar(aves.map(a => a._id));
    expect(r.body).toMatchObject({ agregadas: 1, omitidas: 1 });
    expect(r.body.mensaje).toBe('1 agregadas · 1 omitidas por duplicidad');
    expect(r.body.detalleOmitidas[0].numAnillo).toBe('0001');
    expect(await Inscripcion.countDocuments({ competenciaId: nacional._id })).toBe(2);
    const lista = await listar();
    expect(lista.body.aves.every(a => a.enviada)).toBe(true);
  });

  test('seleccionar un integrante de un dúo envía el dúo completo con nuevo grupo', async () => {
    const duo = await inscribir(clasica, e.s1, ['0003', '0004'], { tipo: 'duos', grupo: 'g', premios: P1 });
    const r = await enviar([duo[0]._id]);
    expect(r.body.agregadas).toBe(2);
    const copias = await Inscripcion.find({ competenciaId: nacional._id });
    expect(new Set(copias.map(c => c.grupoPresentacion)).size).toBe(1);
    expect(copias[0].grupoPresentacion).not.toBe('g');
  });

  test('nacional inexistente → mensaje exacto', async () => {
    nacional.estadoInscripcion = 'cerrada'; await nacional.save();
    const aves = await inscribir(clasica, e.s1, ['0001'], { premios: P1 });
    const r = await enviar([aves[0]._id]);
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('No existe una competencia nacional vigente para esta federación.');
  });

  test('no usa el Nacional de otra federación', async () => {
    nacional.federacionId = e.fed2._id; await nacional.save();
    const aves = await inscribir(clasica, e.s1, ['0001'], { premios: P1 });
    expect((await enviar([aves[0]._id])).status).toBe(404);
  });

  test('rechaza aves no premiadas o de otra competencia', async () => {
    const [noPremiada] = await inscribir(clasica, e.s1, ['0002']);
    expect((await enviar([noPremiada._id])).status).toBe(400);
  });

  test('rollback completo si falla una escritura', async () => {
    const aves = await inscribir(clasica, e.s1, ['0001', '0002', '0003'], { premios: P1 });
    const spy = jest.spyOn(AuditoriaComposicion, 'create').mockRejectedValueOnce(new Error('fallo simulado'));
    const r = await enviar(aves.map(a => a._id));
    spy.mockRestore();
    expect(r.status).toBe(500);
    expect(await Inscripcion.countDocuments({ competenciaId: nacional._id })).toBe(0);
  });
});

describe('Tarea 14 — permisos', () => {
  test.each([
    ['adminB (otra sociedad)', 'adminB', 403],
    ['adminC (otra federación)', 'adminC', 403],
    ['socio', 'socio', 403],
    ['operador / juez', 'operador', 403],
    ['admin general', 'general', 200],
    ['admin de la sociedad organizadora', 'adminA', 200]
  ])('%s → %i', async (_n, quien, esperado) => {
    const aves = await inscribir(clasica, e.s1, ['0001'], { premios: P1 });
    expect((await enviar([aves[0]._id], e.t[quien])).status).toBe(esperado);
  });

  test('sin token → 401', async () => {
    expect((await request(app).get(`/api/competencias/${clasica._id}/aves-nacional`)).status).toBe(401);
  });
});
