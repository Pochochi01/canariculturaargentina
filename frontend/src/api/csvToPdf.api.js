import axiosClient from './axiosClient';

export const convertirCSV = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient.post('/csv-to-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);
};

export const listarPDFs = () =>
  axiosClient.get('/csv-to-pdf/files').then(r => r.data);

export const descargarPDF = async (filename) => {
  const res = await axiosClient.get(`/csv-to-pdf/download/${encodeURIComponent(filename)}`, {
    responseType: 'blob'
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const eliminarPDF = (filename) =>
  axiosClient.delete(`/csv-to-pdf/${encodeURIComponent(filename)}`).then(r => r.data);
