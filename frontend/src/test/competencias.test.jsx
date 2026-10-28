import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { filtrar, agrupar, esActiva } from '@/lib/competencias';
import { ListadoAgrupado } from '@/pages/competencias/CompetenciaListPage';
import { renderConProveedores } from './utils';

const user = { role: 'admin_sociedad', sociedadId: 'A' };
const c = (nombre, extra) => ({ _id: nombre, nombre, estadoInscripcion: 'abierta', estadoCompetencia: 'en_curso', tipoCompetencia: 'clasica', ...extra });

const lista = [
  c('activa-lejana',  { fecha: '2026-12-20', sociedadId: { _id: 'A' } }),
  c('activa-proxima', { fecha: '2026-11-01', tipoCompetencia: 'nacional', federacionId: { _id: 'F' } }),
  c('cerrada',        { fecha: '2026-10-01', estadoInscripcion: 'cerrada', sociedadId: { _id: 'A' } }),
  c('finalizada-vieja', { fecha: '2025-05-01', estadoInscripcion: 'juzgada', estadoCompetencia: 'finalizada', tipoCompetencia: 'mundial' }),
  c('finalizada-reciente', { fecha: '2026-09-01', estadoInscripcion: 'cerrada', estadoCompetencia: 'finalizada', tipoCompetencia: 'abierto', sociedadId: { _id: 'B' } })
];

describe('agrupar / filtrar', () => {
  test('activas: solo inscripción abierta, la más próxima primero', () => {
    const { activas } = agrupar(lista);
    expect(activas.map(x => x.nombre)).toEqual(['activa-proxima', 'activa-lejana']);
  });

  test('historial: finalizadas y cerradas, la más reciente primero', () => {
    const { historial } = agrupar(lista);
    expect(historial.map(x => x.nombre)).toEqual(['cerrada', 'finalizada-reciente', 'finalizada-vieja']);
  });

  test('una finalizada nunca es activa aunque su inscripción figure abierta', () => {
    expect(esActiva(c('x', { estadoCompetencia: 'finalizada' }))).toBe(false);
  });

  test.each([
    ['propias', ['activa-lejana', 'cerrada']],
    ['federacion', ['activa-proxima', 'finalizada-vieja', 'finalizada-reciente']],
    ['nacional', ['activa-proxima']],
    ['mundial', ['finalizada-vieja']],
    ['abierto', ['finalizada-reciente']],
    ['todas', lista.map(x => x.nombre)]
  ])('filtro %s', (filtro, esperado) => {
    expect(filtrar(lista, filtro, user).map(x => x.nombre)).toEqual(esperado);
  });
});

describe('ListadoAgrupado', () => {
  const columns = [{ key: 'nombre', label: 'Nombre' }];

  test('renderiza el bloque de activas arriba, el separador y el historial', () => {
    renderConProveedores(<ListadoAgrupado competencias={lista} filtro="todas" onFiltro={() => {}} columns={columns} loading={false} />);
    const activas = screen.getByRole('region', { name: /Competencias Activas/ });
    const historial = screen.getByRole('region', { name: /Historial de Competencias/ });
    expect(within(activas).getAllByRole('row').slice(1).map(r => r.textContent)).toEqual(['activa-proxima', 'activa-lejana']);
    expect(within(historial).getByText('finalizada-vieja')).toBeInTheDocument();
    expect(screen.getByRole('separator')).toHaveTextContent('Historial de Competencias');
    expect(activas.compareDocumentPosition(historial) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('los filtros notifican la selección', async () => {
    const onFiltro = vi.fn();
    renderConProveedores(<ListadoAgrupado competencias={lista} filtro="todas" onFiltro={onFiltro} columns={columns} loading={false} />);
    for (const label of ['Todas', 'Propias', 'Federación', 'Nacionales', 'Mundiales', 'Abiertos']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Nacionales' }));
    expect(onFiltro).toHaveBeenCalledWith('nacional');
  });
});
