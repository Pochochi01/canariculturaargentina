import axiosClient from './axiosClient';

export const getAyuda = () =>
  axiosClient.get('/ayuda').then(r => r.data);

export const regenerarAyuda = () =>
  axiosClient.post('/ayuda/regenerar').then(r => r.data);
