import axiosClient from './axiosClient';
import { downloadBlob } from '../utils/downloadBlob';

export const uploadPublicidad = (formData) =>
  axiosClient.post('/publicidades/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);

export const getPublicidades = (competenciaId, tipo) =>
  axiosClient.get('/publicidades', { params: { competenciaId, tipo } }).then(r => r.data);

export const deletePublicidad = (id) =>
  axiosClient.delete(`/publicidades/${id}`).then(r => r.data);

export const descargarRevista = async (competenciaId, nombre = '') => {
  const response = await axiosClient.get(`/publicidades/revista/${competenciaId}`, {
    responseType: 'blob',
    timeout: 120_000   // la generación puede tardar
  });
  downloadBlob(response.data, `revista-${nombre || competenciaId}.pdf`);
};
