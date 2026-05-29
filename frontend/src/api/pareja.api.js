import axiosClient from './axiosClient';

export const getParejas = (params) =>
  axiosClient.get('/parejas', { params }).then(r => r.data);

export const getPareja = (id) =>
  axiosClient.get(`/parejas/${id}`).then(r => r.data);

export const createPareja = (data) =>
  axiosClient.post('/parejas', data).then(r => r.data);

export const updatePareja = (id, data) =>
  axiosClient.put(`/parejas/${id}`, data).then(r => r.data);

export const deletePareja = (id) =>
  axiosClient.delete(`/parejas/${id}`).then(r => r.data);
