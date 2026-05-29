import axiosClient from './axiosClient';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const publicarRevista  = (competenciaId) =>
  axiosClient.post(`/revistas/publicar/${competenciaId}`).then(r => r.data);

export const getRevistas      = () =>
  axiosClient.get('/revistas').then(r => r.data);

export const getRevistaPublica = (token) =>
  axiosClient.get(`/revistas/publica/${token}`).then(r => r.data);

export const deleteRevista    = (id) =>
  axiosClient.delete(`/revistas/${id}`).then(r => r.data);

/** URL pública del PDF almacenado en el backend */
export const pdfUrl = (filename) => `${BASE}/revistas/${filename}`;
