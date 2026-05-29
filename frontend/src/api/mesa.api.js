import axiosClient from './axiosClient';

export const getMesasByCompetencia = (competenciaId) =>
  axiosClient.get(`/mesas/competencia/${competenciaId}`).then(r => r.data);

export const getMesa = (id) =>
  axiosClient.get(`/mesas/${id}`).then(r => r.data);

export const createMesa = (data) =>
  axiosClient.post('/mesas', data).then(r => r.data);

export const updateMesa = (id, data) =>
  axiosClient.put(`/mesas/${id}`, data).then(r => r.data);

export const deleteMesa = (id) =>
  axiosClient.delete(`/mesas/${id}`).then(r => r.data);

export const getJuraData = (mesaId) =>
  axiosClient.get(`/mesas/${mesaId}/jura`).then(r => r.data);

export const guardarPuntaje = (mesaId, data) =>
  axiosClient.post(`/mesas/${mesaId}/jura/puntaje`, data).then(r => r.data);

export const actualizarEstadoLote = (mesaId, data) =>
  axiosClient.put(`/mesas/${mesaId}/lote-estado`, data).then(r => r.data);

export const cambiarEstadoTodasLasMesas = (competenciaId, estado) =>
  axiosClient.post(`/mesas/competencia/${competenciaId}/abrir-todas`, { estado }).then(r => r.data);

export const getMiMesa = () =>
  axiosClient.get('/mesas/mi-mesa').then(r => r.data);

export const getLotesJurados = (competenciaId) =>
  axiosClient.get(`/mesas/lotes-jurados/${competenciaId}`).then(r => r.data);
