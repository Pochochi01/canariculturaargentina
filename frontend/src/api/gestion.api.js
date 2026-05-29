import axiosClient from './axiosClient';

// ── Sociedad ──────────────────────────────────────────────────────────────────
export const getSociedadGestion = () =>
  axiosClient.get('/gestion/sociedad').then(r => r.data);

export const uploadLogo = (file) => {
  const fd = new FormData();
  fd.append('logo', file);
  return axiosClient.post('/gestion/logo', fd).then(r => r.data);
};

// ── Configuración de cuotas ───────────────────────────────────────────────────
export const getConfigCuota = (año) =>
  axiosClient.get('/gestion/config', { params: { año } }).then(r => r.data);

export const upsertConfigCuota = (data) =>
  axiosClient.put('/gestion/config', data).then(r => r.data);

// ── Pagos ─────────────────────────────────────────────────────────────────────
export const getPagos = (params) =>
  axiosClient.get('/gestion/pagos', { params }).then(r => r.data);

export const getUltimoPago = (socioId) =>
  axiosClient.get('/gestion/pagos/ultimo', { params: { socioId } }).then(r => r.data);

export const createPago = (data) =>
  axiosClient.post('/gestion/pagos', data).then(r => r.data);

export const updatePago = (id, data) =>
  axiosClient.put(`/gestion/pagos/${id}`, data).then(r => r.data);

export const deletePago = (id) =>
  axiosClient.delete(`/gestion/pagos/${id}`).then(r => r.data);

// ── Estado de cuenta del socio ────────────────────────────────────────────────
export const getEstadoSocio = (socioId) =>
  axiosClient.get('/gestion/estado-socio', { params: { socioId } }).then(r => r.data);

// Para el propio socio (no necesita pasar socioId)
export const getMiEstadoCuenta = () =>
  axiosClient.get('/gestion/mi-estado').then(r => r.data);

// ── Movimientos de la sociedad ────────────────────────────────────────────────
export const getMovimientos = (params) =>
  axiosClient.get('/gestion/movimientos', { params }).then(r => r.data);

export const createMovimiento = (data) =>
  axiosClient.post('/gestion/movimientos', data).then(r => r.data);

export const updateMovimiento = (id, data) =>
  axiosClient.put(`/gestion/movimientos/${id}`, data).then(r => r.data);

export const deleteMovimiento = (id) =>
  axiosClient.delete(`/gestion/movimientos/${id}`).then(r => r.data);

// ── PDFs ──────────────────────────────────────────────────────────────────────
export const downloadRecibo = (pagoId) =>
  axiosClient.get(`/gestion/pdf/recibo/${pagoId}`, { responseType: 'blob' }).then(r => r.data);

export const downloadEstadoSocio = (socioId) =>
  axiosClient.get(`/gestion/pdf/estado-socio/${socioId}`, { responseType: 'blob' }).then(r => r.data);

export const downloadEstadoSociedad = (params) =>
  axiosClient.get('/gestion/pdf/movimientos', { params, responseType: 'blob' }).then(r => r.data);
