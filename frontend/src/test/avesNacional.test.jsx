import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvesNacionalPage, { filtrarAves } from '@/pages/competencias/AvesNacionalPage';
import { renderConProveedores } from './utils';
import * as api from '@/api/competencia.api';

vi.mock('@/api/competencia.api', () => ({ getAvesNacional: vi.fn(), enviarAvesNacional: vi.fn() }));

const ave = (n, extra = {}) => ({
  _id: `a${n}`, numAnillo: `000${n}`, numJaula: n, nombre: 'Amarillo', categoria: 'L1', tipoPresentacion: 'individual',
  socio: { _id: 's1', nombre: 'UNO, Ana' }, premios: ['1°'], puntaje: 90, puntos: 10, enviada: false, ...extra
});
const datos = {
  nacional: { _id: 'n', nombre: 'Nacional FED1' },
  aves: [
    ave(1),
    ave(2, { categoria: 'L2', premios: ['2°'], socio: { _id: 's2', nombre: 'DOS, Beto' } }),
    ave(3, { enviada: true })
  ]
};
const pagina = () => renderConProveedores(<AvesNacionalPage />, { ruta: '/competencias/c1/aves-nacional', patron: '/competencias/:id/aves-nacional' });

test('filtrarAves por categoría, socio, premio y texto', () => {
  expect(filtrarAves(datos.aves, { categoria: 'L2' }).map(a => a._id)).toEqual(['a2']);
  expect(filtrarAves(datos.aves, { socio: 's1' })).toHaveLength(2);
  expect(filtrarAves(datos.aves, { premio: '2°' })).toHaveLength(1);
  expect(filtrarAves(datos.aves, { texto: 'beto' })).toHaveLength(1);
  expect(filtrarAves(datos.aves, { texto: '0003' })).toHaveLength(1);
});

test('grilla con columnas, selección masiva e indicador', async () => {
  api.getAvesNacional.mockResolvedValue(datos);
  pagina();
  expect(await screen.findByText('Destino: Nacional FED1')).toBeInTheDocument();
  for (const col of ['Anillo', 'Jaula', 'Ave', 'Socio', 'Categoría', 'Premio', 'Puntos']) {
    expect(screen.getByRole('columnheader', { name: col })).toBeInTheDocument();
  }
  expect(screen.getByLabelText('Seleccionar 0003')).toBeDisabled(); // ya enviada

  await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }));
  expect(screen.getByTestId('contador')).toHaveTextContent('2 seleccionados');
  await userEvent.click(screen.getByRole('button', { name: 'Deseleccionar todos' }));
  expect(screen.getByTestId('contador')).toHaveTextContent('0 seleccionados');
  await userEvent.click(screen.getByLabelText('Seleccionar 0001'));
  expect(screen.getByTestId('contador')).toHaveTextContent('1 seleccionados');
});

test('enviar al Nacional muestra el resultado con omitidas detalladas', async () => {
  api.getAvesNacional.mockResolvedValue(datos);
  api.enviarAvesNacional.mockResolvedValue({
    agregadas: 1, omitidas: 1, mensaje: '1 agregadas · 1 omitidas por duplicidad',
    detalleOmitidas: [{ numAnillo: '0002', socio: 'AA02', motivo: 'El ave ya fue enviada / inscripta en el Nacional' }]
  });
  pagina();
  await userEvent.click(await screen.findByRole('button', { name: 'Seleccionar todos' }));
  await userEvent.click(screen.getByRole('button', { name: /Enviar al Nacional/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(api.enviarAvesNacional).toHaveBeenCalledWith('c1', ['a1', 'a2']));
  expect(await screen.findByRole('status')).toHaveTextContent('1 agregadas · 1 omitidas por duplicidad');
  expect(screen.getByRole('status')).toHaveTextContent('Anillo 0002');
});

test('sin Nacional vigente: avisa y no permite enviar', async () => {
  api.getAvesNacional.mockResolvedValue({ ...datos, nacional: null });
  pagina();
  expect(await screen.findByText('No existe una competencia nacional vigente para esta federación.')).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Seleccionar 0001'));
  expect(screen.getByRole('button', { name: /Enviar al Nacional/ })).toBeDisabled();
});
