import axiosClient from './axiosClient';

export const getSociedades = (params) =>
  axiosClient.get('/sociedades', { params }).then(r => r.data);

export const getSociedad = (id) =>
  axiosClient.get(`/sociedades/${id}`).then(r => r.data);

export const createSociedad = (data) =>
  axiosClient.post('/sociedades', data).then(r => r.data);

export const updateSociedad = (id, data) =>
  axiosClient.put(`/sociedades/${id}`, data).then(r => r.data);

export const deleteSociedad = (id) =>
  axiosClient.delete(`/sociedades/${id}`).then(r => r.data);

export const toggleActivaSociedad = (id) =>
  axiosClient.patch(`/sociedades/${id}/toggle-activa`).then(r => r.data);

export const asignarAdmin = (id, data) =>
  axiosClient.post(`/sociedades/${id}/admin`, data).then(r => r.data);
