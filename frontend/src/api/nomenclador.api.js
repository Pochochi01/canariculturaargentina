import axiosClient from './axiosClient';

// ── Colores ───────────────────────────────────────────────────────────────────
export const getColores = (params) =>
  axiosClient.get('/nomencladores/colores', { params }).then(r => r.data);
export const createColor = (data) =>
  axiosClient.post('/nomencladores/colores', data).then(r => r.data);
export const updateColor = (id, data) =>
  axiosClient.put(`/nomencladores/colores/${id}`, data).then(r => r.data);
export const deleteColor = (id) =>
  axiosClient.delete(`/nomencladores/colores/${id}`).then(r => r.data);
export const importarColoresPDF = (archivo) => {
  const fd = new FormData();
  fd.append('archivo', archivo);
  return axiosClient.post('/nomencladores/colores/importar-pdf', fd).then(r => r.data);
};

// ── Formas ────────────────────────────────────────────────────────────────────
export const getFormas = (params) =>
  axiosClient.get('/nomencladores/formas', { params }).then(r => r.data);
export const createForma = (data) =>
  axiosClient.post('/nomencladores/formas', data).then(r => r.data);
export const updateForma = (id, data) =>
  axiosClient.put(`/nomencladores/formas/${id}`, data).then(r => r.data);
export const deleteForma = (id) =>
  axiosClient.delete(`/nomencladores/formas/${id}`).then(r => r.data);
export const importarFormasPDF = (archivo) => {
  const fd = new FormData();
  fd.append('archivo', archivo);
  return axiosClient.post('/nomencladores/formas/importar-pdf', fd).then(r => r.data);
};

// ── Canto ─────────────────────────────────────────────────────────────────────
export const getCanto = (params) =>
  axiosClient.get('/nomencladores/canto', { params }).then(r => r.data);
export const createCanto = (data) =>
  axiosClient.post('/nomencladores/canto', data).then(r => r.data);
export const updateCanto = (id, data) =>
  axiosClient.put(`/nomencladores/canto/${id}`, data).then(r => r.data);
export const deleteCanto = (id) =>
  axiosClient.delete(`/nomencladores/canto/${id}`).then(r => r.data);
export const importarCantoPDF = (archivo) => {
  const fd = new FormData();
  fd.append('archivo', archivo);
  return axiosClient.post('/nomencladores/canto/importar-pdf', fd).then(r => r.data);
};
