import axiosClient from './axiosClient';

export const getInscripciones = (params) =>
  axiosClient.get('/inscripciones', { params }).then(r => r.data);

export const getInscripcionesAgrupadas = (competenciaId) =>
  axiosClient.get('/inscripciones', { params: { competenciaId, groupByLote: true } }).then(r => r.data);

export const getLotes = (competenciaId) =>
  axiosClient.get(`/inscripciones/lotes/${competenciaId}`).then(r => r.data);

export const getInscripcion = (id) =>
  axiosClient.get(`/inscripciones/${id}`).then(r => r.data);

export const buscarSocio = (q, sociedadId) =>
  axiosClient.get('/inscripciones/buscar-socio', { params: { q, sociedadId } }).then(r => r.data);

export const createInscripcion = (data) =>
  axiosClient.post('/inscripciones', data).then(r => r.data);

export const updateInscripcion = (id, data) =>
  axiosClient.put(`/inscripciones/${id}`, data).then(r => r.data);

export const deleteInscripcion = (id) =>
  axiosClient.delete(`/inscripciones/${id}`).then(r => r.data);

export const deleteGrupoPresentacion = (grupoPresentacion, competenciaId) =>
  axiosClient.delete(`/inscripciones/grupo/${grupoPresentacion}`, { params: { competenciaId } }).then(r => r.data);

export const verificarAnillos = (competenciaId, numCriador, anillos) =>
  axiosClient.get('/inscripciones/verificar-anillos', {
    params: { competenciaId, numCriador, anillos: anillos.join(',') }
  }).then(r => r.data);
