const request = require('supertest');
const app = require('../src/app');
const Competencia = require('../src/models/Competencia');
const { conectar, desconectar, limpiar, escenario, competencia } = require('./helpers');

let e;
beforeAll(() => conectar());
afterAll(() => desconectar());
beforeEach(async () => { await limpiar(); e = await escenario(); });

describe('Tarea 1 — finalizar con inscripción abierta', () => {
  test('bloquea la finalización (API directa) con mensaje claro', async () => {
    const c = await competencia({ sociedadId: e.socA._id });
    const r = await request(app).put(`/api/competencias/${c._id}/finalizar`).set('Authorization', e.t.adminA);
    expect(r.status).toBe(409);
    expect(r.body.codigo).toBe('INSCRIPCION_ABIERTA');
    expect(r.body.error).toMatch(/inscripción permanezca abierta/);
    expect((await Competencia.findById(c._id)).estadoCompetencia).toBe('en_curso');
  });

  test('también bloquea al admin general', async () => {
    const c = await competencia({ sociedadId: e.socA._id });
    const r = await request(app).put(`/api/competencias/${c._id}/finalizar`).set('Authorization', e.t.general);
    expect(r.status).toBe(409);
  });

  test('permite finalizar con la inscripción cerrada', async () => {
    const c = await competencia({ sociedadId: e.socA._id, estadoInscripcion: 'cerrada' });
    const r = await request(app).put(`/api/competencias/${c._id}/finalizar`).set('Authorization', e.t.adminA);
    expect(r.status).toBe(200);
    expect(r.body.estadoCompetencia).toBe('finalizada');
  });

  test('no permite reabrir la inscripción de una competencia finalizada vía PUT', async () => {
    const c = await competencia({ sociedadId: e.socA._id, estadoInscripcion: 'cerrada', estadoCompetencia: 'finalizada' });
    const r = await request(app).put(`/api/competencias/${c._id}`).set('Authorization', e.t.adminA).send({ estadoInscripcion: 'abierta' });
    expect(r.status).toBe(409);
  });

  test('admin de otra sociedad no puede finalizar (403) y una nacional no rompe con 500', async () => {
    const c = await competencia({ sociedadId: e.socA._id, estadoInscripcion: 'cerrada' });
    expect((await request(app).put(`/api/competencias/${c._id}/finalizar`).set('Authorization', e.t.adminB)).status).toBe(403);
    const nac = await competencia({ tipoCompetencia: 'nacional', federacionId: e.fed1._id, estadoInscripcion: 'cerrada' });
    expect((await request(app).put(`/api/competencias/${nac._id}/finalizar`).set('Authorization', e.t.adminA)).status).toBe(403);
  });
});

describe('Tarea 3 — visibilidad por federación', () => {
  test('admin de sociedad ve propias + nacional/mundial/abierto de su federación y nunca ajenas', async () => {
    const propia   = await competencia({ nombre: 'propia', sociedadId: e.socA._id });
    const ajenaCla = await competencia({ nombre: 'clasica-B', sociedadId: e.socB._id });
    const abiertoB = await competencia({ nombre: 'abierto-B', tipoCompetencia: 'abierto', sociedadId: e.socB._id });
    const abiertoC = await competencia({ nombre: 'abierto-C', tipoCompetencia: 'abierto', sociedadId: e.socC._id });
    const nac1     = await competencia({ nombre: 'nac-1', tipoCompetencia: 'nacional', federacionId: e.fed1._id });
    const nac2     = await competencia({ nombre: 'nac-2', tipoCompetencia: 'nacional', federacionId: e.fed2._id });
    const mun1     = await competencia({ nombre: 'mun-1', tipoCompetencia: 'mundial', federacionId: e.fed1._id });
    const mun2     = await competencia({ nombre: 'mun-2', tipoCompetencia: 'mundial', federacionId: e.fed2._id });

    const r = await request(app).get('/api/competencias').set('Authorization', e.t.adminA);
    expect(r.status).toBe(200);
    const nombres = r.body.map(c => c.nombre).sort();
    expect(nombres).toEqual(['abierto-B', 'mun-1', 'nac-1', 'propia']);
    expect(nombres).not.toContain(ajenaCla.nombre);

    for (const c of [abiertoC, nac2, mun2, ajenaCla]) {
      expect((await request(app).get(`/api/competencias/${c._id}`).set('Authorization', e.t.adminA)).status).toBe(403);
    }
    for (const c of [propia, abiertoB, nac1, mun1]) {
      expect((await request(app).get(`/api/competencias/${c._id}`).set('Authorization', e.t.adminA)).status).toBe(200);
    }
  });

  test('sociedad sin federación solo ve sus competencias', async () => {
    e.socA.federacion = '';
    await e.socA.save();
    await competencia({ nombre: 'propia', sociedadId: e.socA._id });
    await competencia({ nombre: 'nac-1', tipoCompetencia: 'nacional', federacionId: e.fed1._id });
    const r = await request(app).get('/api/competencias').set('Authorization', e.t.adminA);
    expect(r.body.map(c => c.nombre)).toEqual(['propia']);
  });

  test('no puede inscribir en un abierto de otra federación', async () => {
    const abiertoC = await competencia({ tipoCompetencia: 'abierto', sociedadId: e.socC._id });
    const r = await request(app).post('/api/inscripciones').set('Authorization', e.t.adminA).send({
      competenciaId: abiertoC._id, numCriador: 'AA01', tipoNomenclador: 'color', codigoNomenclador: 'X', numAnillo: '1'
    });
    expect(r.status).toBe(403);
  });
});

describe('Tarea 14 — sesión', () => {
  test('si se quita el rol al usuario, el token deja de valer', async () => {
    const r1 = await request(app).get('/api/competencias').set('Authorization', e.t.adminA);
    expect(r1.status).toBe(200);
    e.adminA.roles = ['socio'];
    await e.adminA.save();
    const r2 = await request(app).get('/api/competencias').set('Authorization', e.t.adminA);
    expect(r2.status).toBe(401);
  });
});
