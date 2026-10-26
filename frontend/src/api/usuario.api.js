import axiosClient from './axiosClient';

const BASE = '/usuarios';

export const getUsuarios = () =>
  axiosClient.get(BASE).then(r => r.data);

export const getUsuario = (id) =>
  axiosClient.get(`${BASE}/${id}`).then(r => r.data);

export const createUsuario = (data) =>
  axiosClient.post(BASE, data).then(r => r.data);

export const updateUsuario = (id, data) =>
  axiosClient.put(`${BASE}/${id}`, data).then(r => r.data);

export const deleteUsuario = (id) =>
  axiosClient.delete(`${BASE}/${id}`).then(r => r.data);
