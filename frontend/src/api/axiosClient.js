import axios from 'axios';

const axiosClient = axios.create({
  baseURL: '/api'
  // Content-Type lo maneja axios automáticamente según el body:
  // JSON → application/json, FormData → multipart/form-data (con boundary)
});

axiosClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
