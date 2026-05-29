import axiosClient from './axiosClient';
import { downloadBlob } from '../utils/downloadBlob';

export const descargarCatalogo = async (competenciaId, nombre = '') => {
  const response = await axiosClient.get(`/pdf/catalogo/${competenciaId}`, {
    responseType: 'blob'
  });
  downloadBlob(response.data, `catalogo-${nombre || competenciaId}.pdf`);
};

export const descargarPlanillaJura = async (competenciaId, nombre = '') => {
  const response = await axiosClient.get(`/pdf/planilla-jura/${competenciaId}`, {
    responseType: 'blob'
  });
  downloadBlob(response.data, `planilla-jura-${nombre || competenciaId}.pdf`);
};

export const descargarListadoLote = async (competenciaId, nombre = '') => {
  const response = await axiosClient.get(`/pdf/listado-lote/${competenciaId}`, {
    responseType: 'blob'
  });
  downloadBlob(response.data, `listado-lote-${nombre || competenciaId}.pdf`);
};

export const descargarListadoSocio = async (competenciaId, nombre = '') => {
  const response = await axiosClient.get(`/pdf/listado-socio/${competenciaId}`, {
    responseType: 'blob'
  });
  downloadBlob(response.data, `listado-socio-${nombre || competenciaId}.pdf`);
};

export const descargarListadoVariedadSociedad = async (competenciaId, nombre = '') => {
  const response = await axiosClient.get(`/pdf/listado-variedad-sociedad/${competenciaId}`, {
    responseType: 'blob'
  });
  downloadBlob(response.data, `listado-variedad-sociedad-${nombre || competenciaId}.pdf`);
};

export const descargarCertificado = async (competenciaId) => {
  const response = await axiosClient.get(`/pdf/certificado/${competenciaId}`, {
    responseType: 'blob'
  });
  // El nombre definitivo lo pone el backend en Content-Disposition;
  // como fallback usamos un nombre genérico.
  downloadBlob(response.data, `certificado_${competenciaId}.pdf`);
};
