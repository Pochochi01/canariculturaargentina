import axiosClient from './axiosClient';

export const getPuestasByPareja = (parejaId) =>
  axiosClient.get(`/puestas/pareja/${parejaId}`).then(r => r.data);

export const getDescendientesByPareja = (parejaId) =>
  axiosClient.get(`/puestas/pareja/${parejaId}/descendientes`).then(r => r.data);

export const createPuesta = (data) =>
  axiosClient.post('/puestas', data).then(r => r.data);

export const updatePuesta = (id, data) =>
  axiosClient.put(`/puestas/${id}`, data).then(r => r.data);

export const deletePuesta = (id) =>
  axiosClient.delete(`/puestas/${id}`).then(r => r.data);

export const setHuevosPuesta = (id, data) =>
  axiosClient.put(`/puestas/${id}/huevos/set`, data).then(r => r.data);

export const updateHuevo = (id, huevoId, data) =>
  axiosClient.put(`/puestas/${id}/huevos/${huevoId}`, data).then(r => r.data);
