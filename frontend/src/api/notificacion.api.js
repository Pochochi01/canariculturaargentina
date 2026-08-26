import axiosClient from './axiosClient';

export const getNotificaciones = () =>
  axiosClient.get('/notificaciones').then(r => r.data);

export const marcarLeida = (id) =>
  axiosClient.put(`/notificaciones/${id}/leer`).then(r => r.data);

export const marcarTodasLeidas = () =>
  axiosClient.put('/notificaciones/leer-todas').then(r => r.data);

export const deleteNotificacion = (id) =>
  axiosClient.delete(`/notificaciones/${id}`).then(r => r.data);
