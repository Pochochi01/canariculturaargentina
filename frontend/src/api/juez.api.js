import axiosClient from './axiosClient';

export const getJueces = (params) =>
  axiosClient.get('/jueces', { params }).then(r => r.data);

export const getJuez = (id) =>
  axiosClient.get(`/jueces/${id}`).then(r => r.data);

export const createJuez = (data) =>
  axiosClient.post('/jueces', data).then(r => r.data);

export const updateJuez = (id, data) =>
  axiosClient.put(`/jueces/${id}`, data).then(r => r.data);

export const deleteJuez = (id) =>
  axiosClient.delete(`/jueces/${id}`).then(r => r.data);
