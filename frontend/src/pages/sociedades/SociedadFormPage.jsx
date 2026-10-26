import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSociedad, createSociedad, updateSociedad, asignarAdmin } from '@/api/sociedad.api';
import { getFederaciones } from '@/api/dropdown.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const empty = { codigo: '', nombre: '', provincia: '', direccion: '', telefono: '', mail: '', federacion: '' };

export default function SociedadFormPage({ adminMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState(empty);
  const [adminForm, setAdminForm] = useState({ dni: '', password: '' });
  const [error, setError] = useState('');

  const { data: sociedad } = useQuery({
    queryKey: ['sociedad', id],
    queryFn: () => getSociedad(id),
    enabled: isEdit
  });

  const { data: federaciones = [] } = useQuery({ queryKey: ['federaciones'], queryFn: getFederaciones });

  useEffect(() => {
    if (sociedad) setForm({ ...empty, ...sociedad });
  }, [sociedad]);

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateSociedad(id, data) : createSociedad(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sociedades'] });
      navigate('/sociedades');
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar')
  });

  const adminMutation = useMutation({
    mutationFn: (data) => asignarAdmin(id, data),
    onSuccess: () => navigate('/sociedades'),
    onError: (err) => setError(err.response?.data?.error || 'Error al asignar')
  });

  const f = (key) => ({
    value: form[key] || '',
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value }))
  });

  if (adminMode) {
    return (
      <div>
        <PageHeader title="Asignar Administrador" backTo="/sociedades" />
        <Card className="max-w-lg">
          <CardContent className="pt-6 space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="space-y-1.5">
              <Label>DNI del administrador *</Label>
              <Input value={adminForm.dni} onChange={e => setAdminForm(p => ({ ...p, dni: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Contraseña (dejar vacío usa DNI como clave)</Label>
              <Input type="password" value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/sociedades')}>Cancelar</Button>
              <Button onClick={() => adminMutation.mutate(adminForm)} disabled={adminMutation.isPending}>
                {adminMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Asignar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={isEdit ? 'Editar Sociedad' : 'Nueva Sociedad'} backTo="/sociedades" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Código único *</Label>
                <Input
                  value={form.codigo || ''}
                  onChange={e => setForm(p => ({ ...p, codigo: e.target.value.replace(/[\s.]/g, '').toUpperCase() }))}
                  placeholder="Ej: SCA"
                  required
                />
                <p className="text-xs text-muted-foreground">Ingrese las siglas de la sociedad sin puntos y sin espacios</p>
              </div>
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input {...f('nombre')} placeholder="Nombre de la sociedad" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Provincia</Label>
                <Input {...f('provincia')} placeholder="Ej: Buenos Aires" />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input {...f('telefono')} placeholder="Ej: 011-1234-5678" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input {...f('direccion')} placeholder="Dirección completa" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...f('mail')} type="email" placeholder="correo@sociedad.com" />
              </div>
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
                      <SelectItem key={fed._id || fed.codigo} value={fed.codigo}>{fed.codigo}{fed.nombre ? ` — ${fed.nombre}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/sociedades')}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear sociedad'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
