import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/** Renderiza con React Query (sin reintentos) y router en memoria */
export function renderConProveedores(ui, { ruta = '/', patron = '*' } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes><Route path={patron} element={ui} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
