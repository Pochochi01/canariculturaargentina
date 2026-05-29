import axiosClient from './axiosClient';

export const getPremios = () =>
  axiosClient.get('/premios').then(r => r.data);

export const updatePremio = (tipo, data) =>
  axiosClient.put(`/premios/${encodeURIComponent(tipo)}`, data).then(r => r.data);

export const inicializarPremios = () =>
  axiosClient.post('/premios/inicializar').then(r => r.data);
