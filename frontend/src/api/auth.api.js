import axiosClient from './axiosClient';

export const login = (dni, password) =>
  axiosClient.post('/auth/login', { dni, password }).then(r => r.data);

export const getMe = () =>
  axiosClient.get('/auth/me').then(r => r.data);

export const changePassword = (data) =>
  axiosClient.put('/auth/change-password', data).then(r => r.data);
