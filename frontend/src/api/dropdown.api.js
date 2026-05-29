import axiosClient from './axiosClient';

// Federaciones
export const getFederaciones  = () => axiosClient.get('/dropdowns/federaciones').then(r => r.data);
export const createFederacion = (data) => axiosClient.post('/dropdowns/federaciones', data).then(r => r.data);
export const updateFederacion = (id, data) => axiosClient.put(`/dropdowns/federaciones/${id}`, data).then(r => r.data);
export const deleteFederacion = (id) => axiosClient.delete(`/dropdowns/federaciones/${id}`).then(r => r.data);

// Tipos de Juez
export const getTiposJuez  = () => axiosClient.get('/dropdowns/tipos-juez').then(r => r.data);
export const createTipoJuez = (data) => axiosClient.post('/dropdowns/tipos-juez', data).then(r => r.data);
export const updateTipoJuez = (id, data) => axiosClient.put(`/dropdowns/tipos-juez/${id}`, data).then(r => r.data);
export const deleteTipoJuez = (id) => axiosClient.delete(`/dropdowns/tipos-juez/${id}`).then(r => r.data);

// Opciones Max por Socio
export const getOpcionesMax  = () => axiosClient.get('/dropdowns/opciones-max').then(r => r.data);
export const createOpcionMax = (data) => axiosClient.post('/dropdowns/opciones-max', data).then(r => r.data);
export const updateOpcionMax = (id, data) => axiosClient.put(`/dropdowns/opciones-max/${id}`, data).then(r => r.data);
export const deleteOpcionMax = (id) => axiosClient.delete(`/dropdowns/opciones-max/${id}`).then(r => r.data);
