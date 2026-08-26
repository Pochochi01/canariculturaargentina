import axiosClient from './axiosClient';

export const getEjemplares = (params) =>
  axiosClient.get('/ejemplares', { params }).then(r => r.data);

export const getEjemplar = (id) =>
  axiosClient.get(`/ejemplares/${id}`).then(r => r.data);

export const createEjemplar = (data) =>
  axiosClient.post('/ejemplares', data).then(r => r.data);

export const updateEjemplar = (id, data) =>
  axiosClient.put(`/ejemplares/${id}`, data).then(r => r.data);

export const deleteEjemplar = (id) =>
  axiosClient.delete(`/ejemplares/${id}`).then(r => r.data);

export const buscarCriadorPorProcedencia = (codigo) =>
  axiosClient.get(`/ejemplares/procedencia/${encodeURIComponent(codigo)}`).then(r => r.data);

export const verificarDuplicadoEjemplar = (params) =>
  axiosClient.get('/ejemplares/verificar', { params }).then(r => r.data);
