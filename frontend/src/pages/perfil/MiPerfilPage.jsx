import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMiPerfil, updateMiPerfil, uploadFotoPerfil } from '@/api/socio.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, CheckCircle2, User } from 'lucide-react';

// URL base del backend para imágenes estáticas
const UPLOADS_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:3000';

function FotoAvatar({ src, nombre }) {
  if (src) {
    return (
      <img
        src={`${UPLOADS_URL}/uploads/fotos/${src}`}
        alt="Foto de perfil"
        className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
      />
    );
  }
  return (
    <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
      <User className="h-10 w-10 text-slate-400" />
    </div>
  );
}

export default function MiPerfilPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  const { data: socio, isLoading } = useQuery({
    queryKey: ['miPerfil'],
    queryFn: getMiPerfil,
    onSuccess: (data) => {
      if (!form) setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        telefono: data.telefono || '',
        correo: data.correo || '',
        domicilio: data.domicilio || '',
        direccion: data.direccion || '',
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: updateMiPerfil,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['miPerfil'] });
      setEditing(false);
      setSuccessMsg('Perfil actualizado correctamente');
      setError('');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar')
  });

  const fotoMutation = useMutation({
    mutationFn: uploadFotoPerfil,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['miPerfil'] });
      setSuccessMsg('Foto actualizada');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al subir foto')
  });

  const handleEdit = () => {
    setForm({
      nombre: socio?.nombre || '',
      apellido: socio?.apellido || '',
      telefono: socio?.telefono || '',
      correo: socio?.correo || '',
      domicilio: socio?.domicilio || '',
      direccion: socio?.direccion || '',
    });
    setEditing(true);
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) fotoMutation.mutate(file);
    e.target.value = '';
  };

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  if (isLoading) return (
    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
  );

  return (
    <div className="space-y-4 max-w-lg">
      <PageHeader title="Mi Perfil" backTo="/dashboard" />

      {successMsg && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <FotoAvatar src={socio?.fotoPerfil} nombre={socio?.nombre} />
            <div>
              <p className="font-semibold">{socio?.apellido}, {socio?.nombre}</p>
              <p className="text-sm text-muted-foreground">Anillo: {socio?.anilloCriador}</p>
              <p className="text-xs text-muted-foreground">{socio?.sociedadId?.nombre}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1"
                onClick={() => fileRef.current?.click()}
                disabled={fotoMutation.isPending}
              >
                {fotoMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Camera className="h-3.5 w-3.5" />}
                Cambiar foto
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Datos */}
          {!editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">DNI:</span> <span className="font-medium">{socio?.dni}</span></div>
                <div><span className="text-muted-foreground">Anillo:</span> <span className="font-medium font-mono">{socio?.anilloCriador}</span></div>
                <div><span className="text-muted-foreground">Teléfono:</span> <span className="font-medium">{socio?.telefono || '—'}</span></div>
                <div><span className="text-muted-foreground">Correo:</span> <span className="font-medium">{socio?.correo || '—'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Domicilio:</span> <span className="font-medium">{socio?.domicilio || '—'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Dirección:</span> <span className="font-medium">{socio?.direccion || '—'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Sociedad:</span> <span className="font-medium">{socio?.sociedadId?.nombre} {socio?.sociedadId?.federacion ? `(${socio.sociedadId.federacion})` : ''}</span></div>
              </div>
              <Button onClick={handleEdit} className="w-full">Editar datos</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Apellido</Label>
                  <Input value={form.apellido} onChange={e => set('apellido', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input value={form.telefono} onChange={e => set('telefono', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Correo</Label>
                  <Input type="email" value={form.correo} onChange={e => set('correo', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Domicilio</Label>
                <Input value={form.domicilio} onChange={e => set('domicilio', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Dirección</Label>
                <Input value={form.direccion} onChange={e => set('direccion', e.target.value)} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button
                  onClick={() => updateMutation.mutate(form)}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
