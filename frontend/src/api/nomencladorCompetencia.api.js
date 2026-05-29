import axiosClient from './axiosClient';

export const asignarNomenclador = (competenciaId) =>
  axiosClient.post(`/nomenclador-competencia/${competenciaId}/asignar`).then(r => r.data);

export const getNomencladorCompetencia = (competenciaId) =>
  axiosClient.get(`/nomenclador-competencia/${competenciaId}`).then(r => r.data);

export const getNomencladorData = (competenciaId, tipo = 'color') =>
  axiosClient.get(`/nomenclador-competencia/${competenciaId}/data`, { params: { tipo } }).then(r => r.data);

export const descargarNomenclador = async (competenciaId, tipo = 'color', nombreCompetencia = '') => {
  const res = await axiosClient.get(
    `/nomenclador-competencia/${competenciaId}/descargar`,
    { params: { tipo }, responseType: 'blob' }
  );
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
  const a = document.createElement('a');
  const label = tipo === 'forma' ? 'formapostura' : 'color';
  a.href = url;
  a.download = `${nombreCompetencia}_${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
