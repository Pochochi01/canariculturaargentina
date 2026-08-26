import axiosClient from './axiosClient';

const BASE = '/admin-sociedad';

export const getAdminsSociedad = () =>
  axiosClient.get(BASE).then(r => r.data);

export const getAdminSociedad = (id) =>
  axiosClient.get(`${BASE}/${id}`).then(r => r.data);

export const createAdminSociedad = (data) =>
  axiosClient.post(BASE, data).then(r => r.data);

export const updateAdminSociedad = (id, data) =>
  axiosClient.put(`${BASE}/${id}`, data).then(r => r.data);

export const deleteAdminSociedad = (id) =>
  axiosClient.delete(`${BASE}/${id}`).then(r => r.data);
