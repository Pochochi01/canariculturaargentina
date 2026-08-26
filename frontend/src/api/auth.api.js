import axiosClient from './axiosClient';

export const login = (dni, password) =>
  axiosClient.post('/auth/login', { dni, password }).then(r => r.data);

// Confirma el rol elegido usando el tempToken recibido en el login multi-rol
export const selectRole = (role, tempToken) =>
  axiosClient.post('/auth/select-role', { role }, {
    headers: { Authorization: `Bearer ${tempToken}` }
  }).then(r => r.data);

export const getMe = () =>
  axiosClient.get('/auth/me').then(r => r.data);

export const changePassword = (data) =>
  axiosClient.put('/auth/change-password', data).then(r => r.data);
