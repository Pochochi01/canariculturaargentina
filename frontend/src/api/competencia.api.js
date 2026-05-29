import axiosClient from './axiosClient';

export const getCompetencias = (params) =>
  axiosClient.get('/competencias', { params }).then(r => r.data);

export const getCompetencia = (id) =>
  axiosClient.get(`/competencias/${id}`).then(r => r.data);

export const createCompetencia = (data) =>
  axiosClient.post('/competencias', data).then(r => r.data);

export const updateCompetencia = (id, data) =>
  axiosClient.put(`/competencias/${id}`, data).then(r => r.data);

export const deleteCompetencia = (id) =>
  axiosClient.delete(`/competencias/${id}`).then(r => r.data);

export const cerrarInscripcion = (id) =>
  axiosClient.post(`/competencias/${id}/cerrar-inscripcion`).then(r => r.data);

export const finalizarCompetencia = (id) =>
  axiosClient.put(`/competencias/${id}/finalizar`).then(r => r.data);

export const reabrirCompetencia = (id) =>
  axiosClient.put(`/competencias/${id}/reabrir`).then(r => r.data);

export const getMisCompetencias = () =>
  axiosClient.get('/competencias/mis-competencias').then(r => r.data);

export const getHistorico = (params) =>
  axiosClient.get('/competencias/historico', { params }).then(r => r.data);

export const getResultadosHistorico = (competenciaId) =>
  axiosClient.get(`/competencias/historico/${competenciaId}/resultados`).then(r => r.data);
