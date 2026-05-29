import axiosClient from './axiosClient';

export const getSocios = (params) =>
  axiosClient.get('/socios', { params }).then(r => r.data);

export const getSocio = (id) =>
  axiosClient.get(`/socios/${id}`).then(r => r.data);

export const getSocioByAnillo = (anillo) =>
  axiosClient.get(`/socios/anillo/${anillo}`).then(r => r.data);

export const verificarSocioDisponibilidad = (params) =>
  axiosClient.get('/socios/verificar', { params }).then(r => r.data);

export const createSocio = (data) =>
  axiosClient.post('/socios', data).then(r => r.data);

export const updateSocio = (id, data) =>
  axiosClient.put(`/socios/${id}`, data).then(r => r.data);

export const deleteSocio = (id) =>
  axiosClient.delete(`/socios/${id}`).then(r => r.data);

export const crearUsuarioSocio = (id) =>
  axiosClient.post(`/socios/${id}/usuario`).then(r => r.data);

export const resetearClaveSocio = (id) =>
  axiosClient.put(`/socios/${id}/resetear-clave`).then(r => r.data);

export const getMiPerfil = () =>
  axiosClient.get('/socios/me').then(r => r.data);

export const updateMiPerfil = (data) =>
  axiosClient.put('/socios/me', data).then(r => r.data);

export const uploadFotoPerfil = (file) => {
  const fd = new FormData();
  fd.append('foto', file);
  return axiosClient.post('/socios/me/foto', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);
};
