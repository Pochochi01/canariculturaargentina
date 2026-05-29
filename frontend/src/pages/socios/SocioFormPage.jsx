import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSocio, createSocio, updateSocio, crearUsuarioSocio, resetearClaveSocio, verificarSocioDisponibilidad } from '@/api/socio.api';
import { getSociedades } from '@/api/sociedad.api';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

const empty = {
  anilloCriador: '', apellido: '', nombre: '', dni: '',
  domicilio: '', correo: '', telefono: '', direccion: '', sociedadId: ''
};

export default function SocioFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isEdit = !!id;

  const [form, setForm] = useState(empty);
  const [crearUsuario, setCrearUsuario] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fieldWarnings,  setFieldWarnings]  = useState({ anilloCriador: '', dni: '' });
  const [fieldExistencia, setFieldExistencia] = useState({ anilloCriador: '', dni: '' });
  const [checkingField,  setCheckingField]  = useState({ anilloCriador: false, dni: false });

  const { data: socio, refetch: refetchSocio } = useQuery({
    queryKey: ['socio', id],
    queryFn: () => getSocio(id),
    enabled: isEdit
  });

  const { data: sociedades = [] } = useQuery({
    queryKey: ['sociedades'],
    queryFn: () => getSociedades(),
    enabled: hasRole('admin_general')
  });

  useEffect(() => {
    if (socio) setForm({ ...empty, ...socio, sociedadId: socio.sociedadId?._id || socio.sociedadId || '' });
  }, [socio]);

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateSocio(id, data) : createSocio(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socios'] });
      navigate('/socios');
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar')
  });

  const crearUsuarioMutation = useMutation({
    mutationFn: () => crearUsuarioSocio(id),
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Usuario creado correctamente');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['socio', id] });
      refetchSocio();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al crear usuario');
      setSuccessMsg('');
    }
  });

  const resetearClaveMutation = useMutation({
    mutationFn: () => resetearClaveSocio(id),
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Contraseña reiniciada');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Error al reiniciar contraseña');
      setSuccessMsg('');
    }
  });

  const f = (key) => ({
    value: form[key] || '',
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value }))
  });

  // Anillo de criador: elimina espacios y caracteres vacíos en tiempo real
  const handleAnillo = (e) => {
    const raw     = e.target.value;
    const limpio  = raw.replace(/\s/g, '');
    setForm(p => ({ ...p, anilloCriador: limpio.toUpperCase() }));
    setFieldWarnings(w => ({
      ...w,
      anilloCriador: raw !== limpio ? 'Los espacios se eliminan automáticamente.' : ''
    }));
  };

  // DNI: solo dígitos — elimina espacios, puntos y cualquier carácter no numérico
  const handleDni = (e) => {
    const raw    = e.target.value;
    const limpio = raw.replace(/[^0-9]/g, '');
    setForm(p => ({ ...p, dni: limpio }));
    setFieldWarnings(w => ({
      ...w,
      dni: raw !== limpio ? 'Se eliminan espacios, puntos y letras. Solo se aceptan números.' : ''
    }));
  };

  // ── Verificación de existencia al perder el foco ──────────────────────────
  const verificarAnillo = async () => {
    const valor = form.anilloCriador.trim();
    if (!valor) return;
    setCheckingField(p => ({ ...p, anilloCriador: true }));
    try {
      const params = { anillo: valor };
      if (form.sociedadId) params.sociedadId = form.sociedadId;
      if (isEdit && id)    params.excluirId   = id;
      const res = await verificarSocioDisponibilidad(params);
      setFieldExistencia(p => ({
        ...p,
        anilloCriador: res.anillo?.existe
          ? `Ya existe un socio con este anillo: ${res.anillo.nombre}`
          : ''
      }));
    } catch {
      // silencioso — no bloquear el flujo
    } finally {
      setCheckingField(p => ({ ...p, anilloCriador: false }));
    }
  };

  const verificarDni = async () => {
    const valor = form.dni.trim();
    if (!valor) return;
    setCheckingField(p => ({ ...p, dni: true }));
    try {
      const params = { dni: valor };
      if (form.sociedadId) params.sociedadId = form.sociedadId;
      if (isEdit && id)    params.excluirId   = id;
      const res = await verificarSocioDisponibilidad(params);
      setFieldExistencia(p => ({
        ...p,
        dni: res.dni?.existe
          ? `Ya existe un socio con este DNI: ${res.dni.nombre}`
          : ''
      }));
    } catch {
      // silencioso
    } finally {
      setCheckingField(p => ({ ...p, dni: false }));
    }
  };

  // Validación client-side antes de enviar
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.anilloCriador.trim()) {
      return setError('El Anillo de Criador no puede estar vacío.');
    }
    if (/\s/.test(form.anilloCriador)) {
      return setError('El Anillo de Criador no puede contener espacios.');
    }
    if (!form.dni) {
      return setError('El DNI no puede estar vacío.');
    }
    if (!/^\d+$/.test(form.dni)) {
      return setError('El DNI debe contener solo números.');
    }
    if (fieldExistencia.anilloCriador) {
      return setError(fieldExistencia.anilloCriador);
    }
    if (fieldExistencia.dni) {
      return setError(fieldExistencia.dni);
    }
    mutation.mutate({ ...form, crearUsuario: !isEdit && crearUsuario });
  };

  const tieneUsuario = !!socio?.userId;

  return (
    <div>
      <PageHeader title={isEdit ? 'Editar Socio' : 'Nuevo Socio'} backTo="/socios" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {successMsg && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm mb-4">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* ── Anillo de Criador ── */}
              <div className="space-y-1.5">
                <Label>Anillo de Criador *</Label>
                <div className="relative">
                  <Input
                    value={form.anilloCriador}
                    onChange={handleAnillo}
                    onBlur={verificarAnillo}
                    placeholder="Ej: ARG001"
                    required
                    className={
                      fieldExistencia.anilloCriador
                        ? 'border-red-500 focus-visible:ring-red-400 pr-8'
                        : fieldWarnings.anilloCriador
                          ? 'border-amber-400 focus-visible:ring-amber-400 pr-8'
                          : 'pr-8'
                    }
                  />
                  {checkingField.anilloCriador && (
                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {fieldExistencia.anilloCriador ? (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {fieldExistencia.anilloCriador}
                  </p>
                ) : fieldWarnings.anilloCriador ? (
                  <p className="text-xs text-amber-600">{fieldWarnings.anilloCriador}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin espacios. Se convierte a mayúsculas.</p>
                )}
              </div>

              {/* ── DNI ── */}
              <div className="space-y-1.5">
                <Label>DNI *</Label>
                <div className="relative">
                  <Input
                    value={form.dni}
                    onChange={handleDni}
                    onBlur={verificarDni}
                    placeholder="Ej: 12345678"
                    inputMode="numeric"
                    required
                    className={
                      fieldExistencia.dni
                        ? 'border-red-500 focus-visible:ring-red-400 pr-8'
                        : fieldWarnings.dni
                          ? 'border-amber-400 focus-visible:ring-amber-400 pr-8'
                          : 'pr-8'
                    }
                  />
                  {checkingField.dni && (
                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {fieldExistencia.dni ? (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {fieldExistencia.dni}
                  </p>
                ) : fieldWarnings.dni ? (
                  <p className="text-xs text-amber-600">{fieldWarnings.dni}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Solo números. Sin puntos ni espacios.</p>
                )}
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
                <Label>Teléfono</Label>
                <Input {...f('telefono')} />
              </div>
              <div className="space-y-1.5">
                <Label>Correo electrónico</Label>
                <Input {...f('correo')} type="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Domicilio</Label>
              <Input {...f('domicilio')} />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input {...f('direccion')} />
            </div>

            {hasRole('admin_general') && (
              <div className="space-y-1.5">
                <Label>Sociedad *</Label>
                <Select value={form.sociedadId} onValueChange={v => setForm(p => ({ ...p, sociedadId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sociedad" />
                  </SelectTrigger>
                  <SelectContent>
                    {sociedades.map(s => (
                      <SelectItem key={s._id} value={s._id}>{s.nombre} ({s.codigo})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isEdit && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="crearUsuario" checked={crearUsuario} onChange={e => setCrearUsuario(e.target.checked)} className="rounded" />
                <Label htmlFor="crearUsuario" className="font-normal cursor-pointer">
                  Crear usuario de acceso (DNI como contraseña inicial)
                </Label>
              </div>
            )}

            <div className="flex gap-2 pt-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => navigate('/socios')}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear socio'}
              </Button>

              {/* Botón dinámico de usuario — solo en modo edición y para admins */}
              {isEdit && hasRole('admin_general', 'admin_sociedad') && (
                !tieneUsuario ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-blue-400 text-blue-700 hover:bg-blue-50"
                    onClick={() => crearUsuarioMutation.mutate()}
                    disabled={crearUsuarioMutation.isPending}
                  >
                    {crearUsuarioMutation.isPending
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <UserPlus className="mr-2 h-4 w-4" />}
                    Agregar Usuario
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-400 text-amber-700 hover:bg-amber-50"
                    onClick={() => resetearClaveMutation.mutate()}
                    disabled={resetearClaveMutation.isPending}
                  >
                    {resetearClaveMutation.isPending
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <KeyRound className="mr-2 h-4 w-4" />}
                    Reiniciar Clave
                  </Button>
                )
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
