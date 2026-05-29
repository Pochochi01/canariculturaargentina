import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompetencia, createCompetencia, updateCompetencia } from '@/api/competencia.api';
import { getSociedades } from '@/api/sociedad.api';
import { getFederaciones } from '@/api/dropdown.api';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

// Opciones fijas: no dependen de una query asíncrona,
// así el Select muestra el valor existente de inmediato al editar.
const OPCIONES_MAX = [
  { value: 'libre', label: 'Libre' },
  { value: '2',    label: '2' },
  { value: '3',    label: '3' },
];

const TIPOS_COMPETENCIA_SOCIEDAD = [
  { value: 'clasica', label: 'Clásica' },
  { value: 'abierto', label: 'Abierto' },
];

const TIPOS_COMPETENCIA_GENERAL = [
  { value: 'clasica',  label: 'Clásica' },
  { value: 'abierto',  label: 'Abierto' },
  { value: 'nacional', label: 'Nacional' },
  { value: 'mundial',  label: 'Mundial / Internacional' },
];

const ES_NAC_MUN = (tipo) => tipo === 'nacional' || tipo === 'mundial';

const empty = {
  nombre: '', descripcion: '', fecha: '', lugar: '',
  sociedadId: '', federacionId: '',
  estadoInscripcion: 'abierta',
  tipoCompetencia: 'clasica',
  maxIndividuales: 'libre',
  maxDuos: 'libre',
  maxCuartetos: 'libre',
};

function SelectField({ label, value, onValueChange, placeholder = 'Seleccionar...', children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || ''} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

export default function CompetenciaFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const isEdit = !!id;
  const esAdmin = hasRole('admin_general');
  const tiposCompetencia = user?.role === 'admin_general'
    ? TIPOS_COMPETENCIA_GENERAL
    : TIPOS_COMPETENCIA_SOCIEDAD;

  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const esNacMun = ES_NAC_MUN(form.tipoCompetencia);

  const { data: comp, isLoading: loadingComp } = useQuery({
    queryKey: ['competencia', id],
    queryFn: () => getCompetencia(id),
    enabled: isEdit,
  });

  // Siempre se cargan ambas listas para admin_general,
  // independientemente del tipo de competencia actual.
  // Esto garantiza que los items estén en el árbol cuando
  // el Select renderiza con el valor existente.
  const { data: sociedades = [] } = useQuery({
    queryKey: ['sociedades'],
    queryFn: getSociedades,
    enabled: esAdmin,
  });
  const { data: federaciones = [] } = useQuery({
    queryKey: ['federaciones'],
    queryFn: getFederaciones,
    enabled: esAdmin,
  });

  useEffect(() => {
    if (!comp) return;
    setForm({
      ...empty,
      ...comp,
      // IDs normalizados: pueden llegar como objeto populado o como string
      sociedadId:   comp.sociedadId?._id   ?? comp.sociedadId   ?? '',
      federacionId: comp.federacionId?._id ?? comp.federacionId ?? '',
      // Fecha como YYYY-MM-DD para el input type="date"
      fecha: comp.fecha ? String(comp.fecha).slice(0, 10) : '',
    });
  }, [comp]);

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateCompetencia(id, data) : createCompetencia(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competencias'] });
      queryClient.invalidateQueries({ queryKey: ['competencia', id] });
      navigate('/competencias');
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar'),
  });

  const set = (key) => (v) => setForm(p => ({ ...p, [key]: v }));
  const f   = (key) => ({
    value: form[key] ?? '',
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
  });

  const handleTipoChange = (tipo) => {
    setForm(p => ({
      ...p,
      tipoCompetencia: tipo,
      // Al cambiar tipo se limpia el campo opuesto
      sociedadId:   ES_NAC_MUN(tipo) ? '' : p.sociedadId,
      federacionId: ES_NAC_MUN(tipo) ? p.federacionId : '',
    }));
  };

  if (isEdit && loadingComp) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={isEdit ? 'Editar Competencia' : 'Nueva Competencia'} backTo="/competencias" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form
            onSubmit={e => { e.preventDefault(); mutation.mutate(form); }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input {...f('nombre')} placeholder="Ej: Exposición Nacional 2025" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Tipo de competencia"
                value={form.tipoCompetencia}
                onValueChange={handleTipoChange}
              >
                {tiposCompetencia.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectField>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Input {...f('descripcion')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" {...f('fecha')} />
              </div>
              <div className="space-y-1.5">
                <Label>Lugar</Label>
                <Input {...f('lugar')} placeholder="Ej: Salón Municipal" />
              </div>
            </div>

            {/* Máximos por socio — opciones fijas, sin query asíncrona */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Máximos por socio</p>
              <div className="grid grid-cols-3 gap-3">
                <SelectField
                  label="Individuales"
                  value={form.maxIndividuales}
                  onValueChange={set('maxIndividuales')}
                >
                  {OPCIONES_MAX.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectField>
                <SelectField
                  label="Duos"
                  value={form.maxDuos}
                  onValueChange={set('maxDuos')}
                >
                  {OPCIONES_MAX.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectField>
                <SelectField
                  label="Cuartetos"
                  value={form.maxCuartetos}
                  onValueChange={set('maxCuartetos')}
                >
                  {OPCIONES_MAX.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectField>
              </div>
            </div>

            {/* Sociedad o Federación — solo admin_general */}
            {esAdmin && (
              <div className="space-y-1.5">
                <Label>{esNacMun ? 'Federación' : 'Sociedad'}</Label>
                {esNacMun ? (
                  <Select value={form.federacionId || ''} onValueChange={set('federacionId')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar federación" />
                    </SelectTrigger>
                    <SelectContent>
                      {federaciones.map(fed => (
                        <SelectItem key={fed._id} value={String(fed._id)}>
                          {fed.nombre || fed.codigo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={form.sociedadId || ''} onValueChange={set('sociedadId')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sociedad" />
                    </SelectTrigger>
                    <SelectContent>
                      {sociedades.map(s => (
                        <SelectItem key={s._id} value={String(s._id)}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {isEdit && (
              <SelectField
                label="Estado inscripción"
                value={form.estadoInscripcion}
                onValueChange={set('estadoInscripcion')}
              >
                <SelectItem value="abierta">Abierta</SelectItem>
                <SelectItem value="cerrada">Cerrada</SelectItem>
                <SelectItem value="juzgada">Juzgada</SelectItem>
              </SelectField>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/competencias')}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear competencia'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
