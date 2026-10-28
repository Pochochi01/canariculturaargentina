import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  desdeServidor, formar, aIndividual, eliminar, validar, construirPayload, hayCambios
} from '@/lib/composicion';
import ComposicionEditor from '@/components/competencias/ComposicionEditor';
import { renderConProveedores } from './utils';
import * as api from '@/api/inscripcion.api';

vi.mock('@/api/inscripcion.api', () => ({
  getComposicion: vi.fn(),
  recomponer: vi.fn()
}));

const ave = (n, codigo = 'L1') => ({ _id: `i${n}`, numAnillo: `000${n}`, codigoNomenclador: codigo });
const ind = (n, codigo) => ({ tipo: 'individual', grupo: null, titulares: [ave(n, codigo)], suplente: null });
const servidor = [
  ind(1), ind(2), ind(3),
  { tipo: 'cuartetos', grupo: 'q', titulares: [ave(4), ave(5), ave(6), ave(7)], suplente: ave(8) },
  { tipo: 'duos', grupo: 'd', titulares: [ave(9), ave(10)], suplente: null },
  ind(11, 'L2')
];
const tipos = (b) => b.unidades.map(u => `${u.tipo}:${u.titulares.map(t => t.numAnillo.slice(-2)).join('+')}`).sort();

describe('lógica de composición', () => {
  test('individual → dúo: el ave queda en una sola presentación', () => {
    const b = formar(desdeServidor(servidor), ['i1', 'i2'], 'duos');
    const todas = b.unidades.flatMap(u => u.titulares.map(t => t._id));
    expect(new Set(todas).size).toBe(todas.length);
    expect(tipos(b)).toContain('duos:01+02');
    expect(construirPayload(desdeServidor(servidor), b)).toEqual({ grupos: [{ tipo: 'duos', titulares: ['i1', 'i2'] }], eliminar: [] });
  });

  test('dúo incompleto bloquea el guardado hasta resolverlo', () => {
    const b = aIndividual(desdeServidor(servidor), ['i9']);
    expect(validar(b)).toHaveLength(1);
    expect(validar(b)[0].mensaje).toMatch(/Dúo incompleto \(1\/2\)/);
    expect(validar(aIndividual(b, ['i10']))).toHaveLength(0);
    expect(validar(eliminar(b, ['i10']))).toHaveLength(0);
  });

  test('cuarteto con suplente: si sale un titular, el suplente sube', () => {
    const b = eliminar(desdeServidor(servidor), ['i5']);
    const q = b.unidades.find(u => u.tipo === 'cuartetos');
    expect(q.titulares.map(t => t._id)).toEqual(['i4', 'i6', 'i7', 'i8']);
    expect(q.suplente).toBeNull();
    expect(validar(b)).toHaveLength(0);
  });

  test('cuarteto sin suplente queda incompleto', () => {
    let b = eliminar(desdeServidor(servidor), ['i8']);
    b = aIndividual(b, ['i4']);
    expect(validar(b)[0].mensaje).toMatch(/Cuarteto incompleto \(3\/4\)/);
  });

  test('dúo + 2 individuales → cuarteto, y cambio múltiple', () => {
    let b = formar(desdeServidor(servidor), ['i9', 'i10', 'i1', 'i2'], 'cuartetos');
    b = formar(b, ['i3', 'i4'], 'duos'); // saca un titular del cuarteto original → sube el suplente
    expect(validar(b)).toHaveLength(0);
    const p = construirPayload(desdeServidor(servidor), b);
    expect(p.grupos.map(g => g.tipo).sort()).toEqual(['cuartetos', 'cuartetos', 'duos']);
  });

  test('no mezcla lotes ni acepta cantidades incorrectas', () => {
    expect(() => formar(desdeServidor(servidor), ['i1', 'i11'], 'duos')).toThrow(/mismo lote/);
    expect(() => formar(desdeServidor(servidor), ['i1', 'i2', 'i3'], 'duos')).toThrow(/exactamente 2/);
  });

  test('sin cambios no hay nada que guardar', () => {
    const b = desdeServidor(servidor);
    expect(hayCambios(b, b)).toBe(false);
  });
});

describe('<ComposicionEditor />', () => {
  test('seleccionar dos aves, formar dúo y guardar envía el payload correcto', async () => {
    api.getComposicion.mockResolvedValue(servidor);
    api.recomponer.mockResolvedValue({ acciones: ['CREAR_DUO'] });
    const onClose = vi.fn();
    renderConProveedores(<ComposicionEditor open onClose={onClose} competenciaId="c1" socio={{ _id: 's1', label: 'AA01' }} />);

    await userEvent.click(await screen.findByRole('button', { name: '0001' }));
    await userEvent.click(screen.getByRole('button', { name: '0002' }));
    expect(screen.getByText('2 seleccionada/s')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Formar dúo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(api.recomponer).toHaveBeenCalledWith({
      competenciaId: 'c1', socioId: 's1', grupos: [{ tipo: 'duos', titulares: ['i1', 'i2'] }], eliminar: []
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('con un dúo incompleto el botón Guardar queda deshabilitado', async () => {
    api.getComposicion.mockResolvedValue(servidor);
    renderConProveedores(<ComposicionEditor open onClose={() => {}} competenciaId="c1" socio={{ _id: 's1', label: 'AA01' }} />);
    await userEvent.click(await screen.findByRole('button', { name: '0009' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a individual' }));
    expect(screen.getByText(/Dúo incompleto/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });
});
