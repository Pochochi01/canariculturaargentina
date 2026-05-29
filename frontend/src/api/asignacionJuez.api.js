import axiosClient from './axiosClient';

export const getAsignaciones = (competenciaId) =>
  axiosClient.get('/asignaciones-juez', { params: { competenciaId } }).then(r => r.data);

export const upsertAsignacion = (data) =>
  axiosClient.put('/asignaciones-juez/upsert', data).then(r => r.data);

export const deleteAsignacion = (id) =>
  axiosClient.delete(`/asignaciones-juez/${id}`).then(r => r.data);
