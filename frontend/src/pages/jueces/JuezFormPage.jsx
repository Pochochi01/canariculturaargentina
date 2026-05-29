import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJuez, createJuez, updateJuez } from '@/api/juez.api';
import { getFederaciones, getTiposJuez } from '@/api/dropdown.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const empty = { codigo: '', nombre: '', apellido: '', dni: '', federacion: '', tipoJuez: '' };

export default function JuezFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const { data: juez } = useQuery({ queryKey: ['juez', id], queryFn: () => getJuez(id), enabled: isEdit });
  const { data: federaciones = [] } = useQuery({ queryKey: ['federaciones'], queryFn: getFederaciones });
  const { data: tiposJuez = [] } = useQuery({ queryKey: ['tipos-juez'], queryFn: getTiposJuez });

  useEffect(() => { if (juez) setForm({ ...empty, ...juez }); }, [juez]);

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateJuez(id, data) : createJuez(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jueces'] }); navigate('/jueces'); },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar')
  });

  const f = (key) => ({ value: form[key] || '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      federacion: form.federacion === '__ninguna__' ? '' : form.federacion,
      tipoJuez: form.tipoJuez === '__ninguno__' ? '' : form.tipoJuez,
    };
    mutation.mutate(data);
  };

  return (
    <div>
      <PageHeader title={isEdit ? 'Editar Juez' : 'Nuevo Juez'} backTo="/jueces" />
      <Card className="max-w-lg">
        <CardContent className="pt-6">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Código *</Label>
                <Input {...f('codigo')} placeholder="Ej: J001" required />
              </div>
              <div className="space-y-1.5">
                <Label>DNI *</Label>
                <Input {...f('dni')} placeholder="Ej: 12345678" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Apellido *</Label>
                <Input {...f('apellido')} required />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input {...f('nombre')} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Federación</Label>
                <Select
                  value={form.federacion || '__ninguna__'}
                  onValueChange={v => setForm(p => ({ ...p, federacion: v === '__ninguna__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ninguna__">Sin federación</SelectItem>
                    {federaciones.map(fed => (
                      <SelectItem key={fed._id || fed.codigo} value={fed.codigo}>
                        {fed.codigo}{fed.nombre ? ` — ${fed.nombre}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Juez</Label>
                <Select
                  value={form.tipoJuez || '__ninguno__'}
                  onValueChange={v => setForm(p => ({ ...p, tipoJuez: v === '__ninguno__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ninguno__">Sin especificar</SelectItem>
                    {tiposJuez.map(t => (
                      <SelectItem key={t._id || t.valor} value={t.valor}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/jueces')}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear juez'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
