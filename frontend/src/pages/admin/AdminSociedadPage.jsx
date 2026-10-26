import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminsSociedad, createAdminSociedad, updateAdminSociedad, deleteAdminSociedad
} from '@/api/adminSociedad.api';
import { getSociedades } from '@/api/sociedad.api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Building2, ShieldCheck } from 'lucide-react';

const ROLES_OPCIONES = [
  { value: 'admin_sociedad', label: 'Admin. de Sociedad' },
  { value: 'socio',          label: 'Criador'            },
  { value: 'operador',       label: 'Operador de Jura'   },
  { value: 'admin_general',  label: 'Admin. General'     }
];

const EMPTY_FORM = { dni: '', password: '', sociedadId: '', activo: true, roles: ['admin_sociedad'] };

// ── Modal de formulario ───────────────────────────────────────────────────────
function FormModal({ open, onClose, inicial, sociedades, onSave, saving }) {
  const isEdit = !!inicial?._id;
  const [form, setForm] = useState(() => inicial
    ? {
        dni:        inicial.dni        || '',
        password:   '',
        sociedadId: inicial.sociedadId?._id || inicial.sociedadId || '',
        activo:     inicial.activo     ?? true,
        roles:      inicial.roles?.length ? inicial.roles : (inicial.role ? [inicial.role] : ['admin_sociedad'])
      }
    : EMPTY_FORM
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleRol = (rol) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(rol)
        ? f.roles.filter(r => r !== rol)
        : [...f.roles, rol]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.roles.length) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar administrador' : 'Nuevo administrador de sociedad'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>DNI / Usuario</Label>
            <Input
              value={form.dni}
              onChange={e => set('dni', e.target.value)}
              placeholder="Ej: 12345678"
              required
              disabled={isEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="••••••••"
              required={!isEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Sociedad asignada</Label>
            <Select
              value={form.sociedadId}
              onValueChange={v => set('sociedadId', v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin sociedad asignada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin sociedad</SelectItem>
                {sociedades.map(s => (
                  <SelectItem key={s._id} value={s._id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Roles asignados</Label>
            <div className="flex flex-wrap gap-2">
              {ROLES_OPCIONES.map(({ value, label }) => {
                const activo = form.roles.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleRol(value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                      ${activo
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-primary'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {form.roles.length === 0 && (
              <p className="text-xs text-red-500">Debe asignar al menos un rol.</p>
            )}
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={form.activo}
                onChange={e => set('activo', e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <Label htmlFor="activo">Usuario activo</Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || form.roles.length === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear administrador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminSociedadPage() {
  const qc = useQueryClient();
  const [modal,  setModal]  = useState({ open: false, item: null });
  const [confirm, setConfirm] = useState(null); // item a eliminar

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['admin-sociedad'],
    queryFn: getAdminsSociedad
  });

  const { data: sociedades = [] } = useQuery({
    queryKey: ['sociedades'],
    queryFn: getSociedades
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ['admin-sociedad'] });

  const createMut = useMutation({
    mutationFn: (data) => createAdminSociedad(data),
    onSuccess: () => { invalidar(); setModal({ open: false, item: null }); }
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateAdminSociedad(id, data),
    onSuccess: () => { invalidar(); setModal({ open: false, item: null }); }
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteAdminSociedad(id),
    onSuccess: () => { invalidar(); setConfirm(null); }
  });

  const handleSave = (form) => {
    const payload = {
      dni:       form.dni,
      password:  form.password || undefined,
      sociedadId: form.sociedadId || null,
      activo:    form.activo,
      roles:     form.roles
    };
    if (modal.item?._id) {
      updateMut.mutate({ id: modal.item._id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const saving = createMut.isPending || updateMut.isPending;
  const error  = createMut.error?.response?.data?.error
              || updateMut.error?.response?.data?.error
              || deleteMut.error?.response?.data?.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administradores de Sociedad"
        description="Gestión de usuarios con acceso de administración de sociedad"
        actions={
          <Button onClick={() => setModal({ open: true, item: null })}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo administrador
          </Button>
        }
      />

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No hay administradores de sociedad registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">DNI</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Sociedad</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Roles</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {admins.map(admin => {
                const roles = admin.roles?.length ? admin.roles : (admin.role ? [admin.role] : []);
                return (
                  <tr key={admin._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold">{admin.dni}</td>
                    <td className="px-4 py-3">
                      {admin.sociedadId
                        ? <span className="flex items-center gap-1.5 text-slate-700">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {admin.sociedadId.nombre}
                          </span>
                        : <span className="text-slate-400 text-xs">Sin sociedad</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {roles.map(r => (
                          <Badge key={r} variant="secondary" className="text-xs">
                            {ROLES_OPCIONES.find(o => o.value === r)?.label || r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        admin.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {admin.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => setModal({ open: true, item: admin })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setConfirm(admin)}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <FormModal
          open={modal.open}
          onClose={() => setModal({ open: false, item: null })}
          inicial={modal.item}
          sociedades={sociedades}
          onSave={handleSave}
          saving={saving}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar administrador</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirma la eliminación definitiva del usuario <strong>{confirm?.dni}</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMut.mutate(confirm._id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
