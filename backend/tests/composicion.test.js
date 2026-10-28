const request = require('supertest');
const app = require('../src/app');
const Inscripcion = require('../src/models/Inscripcion');
const AuditoriaComposicion = require('../src/models/AuditoriaComposicion');
const { conectar, desconectar, limpiar, escenario, competencia, inscribir } = require('./helpers');

let e, comp;
beforeAll(() => conectar());
afterAll(() => desconectar());
beforeEach(async () => {
  await limpiar();
  e = await escenario();
  comp = await competencia({ sociedadId: e.socA._id });
});

const recomponer = (body, tok = e.t.adminA) =>
  request(app).post('/api/inscripciones/composicion').set('Authorization', tok)
    .send({ competenciaId: comp._id, socioId: e.s1._id, ...body });
const ids = (docs) => docs.map(d => d._id.toString());
const acciones = async () => (await AuditoriaComposicion.find().lean()).map(a => a.accion);

describe('Tarea 4/6 — recomposición', () => {
  test('dos individuales → dúo, sin dejar inscripciones individuales previas', async () => {
    const aves = await inscribir(comp, e.s1, ['0001', '0002']);
    const r = await recomponer({ grupos: [{ tipo: 'duos', titulares: ids(aves) }] });
    expect(r.status).toBe(200);
    expect(r.body.acciones).toEqual(['CREAR_DUO']);
    const docs = await Inscripcion.find({ competenciaId: comp._id });
    expect(docs).toHaveLength(2);
    expect(new Set(docs.map(d => d.grupoPresentacion)).size).toBe(1);
    expect(docs.every(d => d.tipoPresentacion === 'duos' && d.grupoPresentacion)).toBe(true);
  });

  test('cuatro individuales → cuarteto con suplente', async () => {
    const aves = await inscribir(comp, e.s1, ['0001', '0002', '0003', '0004', '0005']);
    const r = await recomponer({ grupos: [{ tipo: 'cuartetos', titulares: ids(aves).slice(0, 4), suplente: ids(aves)[4] }] });
    expect(r.status).toBe(200);
    expect(r.body.acciones).toEqual(['CREAR_CUARTETO']);
    expect(await Inscripcion.countDocuments({ esSuplente: true, tipoPresentacion: 'cuartetos' })).toBe(1);
  });

  test('dúo + 2 individuales → cuarteto (transformación)', async () => {
    const duo = await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g-duo' });
    const ind = await inscribir(comp, e.s1, ['0003', '0004']);
    const r = await recomponer({ grupos: [{ tipo: 'cuartetos', titulares: [...ids(duo), ...ids(ind)] }] });
    expect(r.status).toBe(200);
    expect(r.body.acciones.sort()).toEqual(['DESARMAR_DUO', 'TRANSFORMAR_DUO_CUARTETO']);
    expect(await Inscripcion.countDocuments({ grupoPresentacion: 'g-duo' })).toBe(0);
  });

  test('desarmar cuarteto → nuevo dúo + 2 individuales (cambio múltiple)', async () => {
    const q = await inscribir(comp, e.s1, ['0001', '0002', '0003', '0004'], { tipo: 'cuartetos', grupo: 'g-q' });
    const [a, b, c, d] = ids(q);
    const r = await recomponer({
      grupos: [{ tipo: 'duos', titulares: [a, b] }, { tipo: 'individual', titulares: [c] }, { tipo: 'individual', titulares: [d] }]
    });
    expect(r.status).toBe(200);
    expect(r.body.acciones.sort()).toEqual(['CONVERTIR_A_INDIVIDUAL', 'CONVERTIR_A_INDIVIDUAL', 'CREAR_DUO', 'DESARMAR_CUARTETO']);
    expect(await Inscripcion.countDocuments({ tipoPresentacion: 'individual', grupoPresentacion: null })).toBe(2);
  });

  test('desarmar dúo eliminando un participante', async () => {
    const duo = await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g' });
    const r = await recomponer({ grupos: [{ tipo: 'individual', titulares: [ids(duo)[0]] }], eliminar: [ids(duo)[1]] });
    expect(r.status).toBe(200);
    expect(await Inscripcion.countDocuments({})).toBe(1);
    expect(await acciones()).toEqual(expect.arrayContaining(['DESARMAR_DUO', 'CONVERTIR_A_INDIVIDUAL']));
  });

  test('intento de duplicar un ave en dos presentaciones → 400', async () => {
    const aves = await inscribir(comp, e.s1, ['0001', '0002', '0003']);
    const [a, b, c] = ids(aves);
    const r = await recomponer({ grupos: [{ tipo: 'duos', titulares: [a, b] }, { tipo: 'duos', titulares: [a, c] }] });
    expect(r.status).toBe(400);
    expect(r.body.repetidas).toEqual([a]);
    expect(await Inscripcion.countDocuments({ grupoPresentacion: { $ne: null } })).toBe(0);
  });

  test('no permite dejar un dúo partido (integrantes faltantes) → 400', async () => {
    const duo = await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g' });
    const r = await recomponer({ grupos: [{ tipo: 'individual', titulares: [ids(duo)[0]] }] });
    expect(r.status).toBe(400);
    expect(r.body.faltantes).toEqual(['0002']);
  });

  test('cantidad incorrecta y lotes mezclados → 400', async () => {
    const aves = await inscribir(comp, e.s1, ['0001', '0002', '0003']);
    expect((await recomponer({ grupos: [{ tipo: 'duos', titulares: ids(aves) }] })).status).toBe(400);
    const otro = await inscribir(comp, e.s1, ['0009'], { codigo: 'L2' });
    const r = await recomponer({ grupos: [{ tipo: 'duos', titulares: [ids(aves)[0], ids(otro)[0]] }] });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/mismo lote/);
  });

  test('respeta el máximo de dúos por socio y lote', async () => {
    comp.maxDuos = '2'; await comp.save();
    await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g1' });
    await inscribir(comp, e.s1, ['0003', '0004'], { tipo: 'duos', grupo: 'g2' });
    const ind = await inscribir(comp, e.s1, ['0005', '0006']);
    const r = await recomponer({ grupos: [{ tipo: 'duos', titulares: ids(ind) }] });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/máximo de 2/);
  });

  test('solo competencias clásicas con inscripción abierta', async () => {
    const aves = await inscribir(comp, e.s1, ['0001', '0002']);
    comp.estadoInscripcion = 'cerrada'; await comp.save();
    expect((await recomponer({ grupos: [{ tipo: 'duos', titulares: ids(aves) }] })).status).toBe(400);
    comp.estadoInscripcion = 'abierta'; comp.tipoCompetencia = 'abierto'; await comp.save();
    expect((await recomponer({ grupos: [{ tipo: 'duos', titulares: ids(aves) }] })).status).toBe(400);
  });

  test('permisos: admin de otra sociedad 403; socio y operador 403', async () => {
    const aves = await inscribir(comp, e.s1, ['0001', '0002']);
    const body = { grupos: [{ tipo: 'duos', titulares: ids(aves) }] };
    expect((await recomponer(body, e.t.adminB)).status).toBe(403);
    expect((await recomponer(body, e.t.socio)).status).toBe(403);
    expect((await recomponer(body, e.t.operador)).status).toBe(403);
    expect((await recomponer(body, e.t.general)).status).toBe(200);
  });

  test('auditoría registra usuario, sociedad, competencia y estados', async () => {
    const aves = await inscribir(comp, e.s1, ['0001', '0002']);
    await recomponer({ grupos: [{ tipo: 'duos', titulares: ids(aves) }] });
    const [a] = await AuditoriaComposicion.find().lean();
    expect(a).toMatchObject({ accion: 'CREAR_DUO', usuarioDni: '2', rol: 'admin_sociedad' });
    expect(a.sociedadId.toString()).toBe(e.socA._id.toString());
    expect(a.competenciaId.toString()).toBe(comp._id.toString());
    expect(a.estadoAnterior).toHaveLength(2);
    expect(a.estadoNuevo[0]).toMatchObject({ tipo: 'duos', anillos: ['0001', '0002'] });
    const r = await request(app).get(`/api/inscripciones/composicion/auditoria?competenciaId=${comp._id}`).set('Authorization', e.t.adminA);
    expect(r.body).toHaveLength(1);
  });
});

describe('Tarea 5 — quitar integrantes', () => {
  const quitar = (id, resolucion) =>
    request(app).delete(`/api/inscripciones/${id}${resolucion ? `?resolucion=${resolucion}` : ''}`).set('Authorization', e.t.adminA);

  test('dúo incompleto: pide opciones y no borra nada', async () => {
    const duo = await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g' });
    const r = await quitar(duo[0]._id);
    expect(r.status).toBe(409);
    expect(r.body.codigo).toBe('REQUIERE_RESOLUCION');
    expect(r.body.opciones.map(o => o.label)).toEqual(['Convertir en Individual', 'Eliminar Definitivamente']);
    expect(await Inscripcion.countDocuments()).toBe(2);
  });

  test('dúo → convertir en individual', async () => {
    const duo = await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g' });
    const r = await quitar(duo[0]._id, 'individual');
    expect(r.status).toBe(200);
    const [resto] = await Inscripcion.find();
    expect(resto).toMatchObject({ numAnillo: '0002', tipoPresentacion: 'individual', grupoPresentacion: null });
  });

  test('dúo → eliminar definitivamente', async () => {
    const duo = await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g' });
    expect((await quitar(duo[0]._id, 'eliminar')).status).toBe(200);
    expect(await Inscripcion.countDocuments()).toBe(0);
    expect(await acciones()).toEqual(['ELIMINAR_COMPOSICION']);
  });

  test('cuarteto con suplente: el suplente sube automáticamente y se audita', async () => {
    const q = await inscribir(comp, e.s1, ['0001', '0002', '0003', '0004', '0005'], { tipo: 'cuartetos', grupo: 'g', suplente: '0005' });
    const r = await quitar(q[1]._id);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ resultado: 'suplente_promovido', suplente: '0005' });
    const resto = await Inscripcion.find({ grupoPresentacion: 'g' });
    expect(resto).toHaveLength(4);
    expect(resto.some(i => i.esSuplente)).toBe(false);
    expect(await acciones()).toEqual(['PROMOVER_SUPLENTE']);
  });

  test('cuarteto sin suplente: pide opciones; convertir a individuales', async () => {
    const q = await inscribir(comp, e.s1, ['0001', '0002', '0003', '0004'], { tipo: 'cuartetos', grupo: 'g' });
    const r1 = await quitar(q[0]._id);
    expect(r1.status).toBe(409);
    expect(r1.body.restantes).toHaveLength(3);
    const r2 = await quitar(q[0]._id, 'individuales');
    expect(r2.status).toBe(200);
    expect(await Inscripcion.countDocuments({ tipoPresentacion: 'individual', grupoPresentacion: null })).toBe(3);
  });

  test('quitar el suplente no afecta al cuarteto', async () => {
    await inscribir(comp, e.s1, ['0001', '0002', '0003', '0004', '0005'], { tipo: 'cuartetos', grupo: 'g', suplente: '0005' });
    const sup = await Inscripcion.findOne({ esSuplente: true });
    expect((await quitar(sup._id)).status).toBe(200);
    expect(await Inscripcion.countDocuments({ grupoPresentacion: 'g' })).toBe(4);
  });

  test('admin de otra sociedad no puede borrar inscripciones ajenas', async () => {
    const [ave] = await inscribir(comp, e.s1, ['0001']);
    const r = await request(app).delete(`/api/inscripciones/${ave._id}`).set('Authorization', e.t.adminB);
    expect(r.status).toBe(403);
    expect(await Inscripcion.countDocuments()).toBe(1);
  });
});

describe('Auditoría final — integridad', () => {
  test('cambiar el lote de un integrante actualiza todo el dúo', async () => {
    await require('../src/models/NomencladorColor').create({ codigo: 'L9', nombreLinea: 'Lote nueve' });
    const duo = await inscribir(comp, e.s1, ['0001', '0002'], { tipo: 'duos', grupo: 'g' });
    const r = await request(app).put(`/api/inscripciones/${duo[0]._id}`).set('Authorization', e.t.adminA)
      .send({ tipoNomenclador: 'color', codigoNomenclador: 'L9' });
    expect(r.status).toBe(200);
    expect((await Inscripcion.find({ grupoPresentacion: 'g' })).map(i => i.codigoNomenclador)).toEqual(['L9', 'L9']);
  });

  test('eliminar una competencia elimina sus inscripciones (sin huérfanas)', async () => {
    await inscribir(comp, e.s1, ['0001']);
    const r = await request(app).delete(`/api/competencias/${comp._id}`).set('Authorization', e.t.adminA);
    expect(r.status).toBe(200);
    expect(await Inscripcion.countDocuments({ competenciaId: comp._id })).toBe(0);
  });
});
