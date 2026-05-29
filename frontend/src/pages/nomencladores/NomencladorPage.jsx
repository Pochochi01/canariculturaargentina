import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getColores, createColor, updateColor, deleteColor, importarColoresPDF,
  getFormas, createForma, updateForma, deleteForma, importarFormasPDF,
  getCanto, createCanto, updateCanto, deleteCanto, importarCantoPDF
} from '@/api/nomenclador.api';
import DataTable from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

// ── Configuración por tipo ────────────────────────────────────────────────────
const CONFIG = {
  color: {
    queryKey: ['nomencladores', 'colores'],
    getFn: getColores,
    createFn: createColor,
    updateFn: updateColor,
    deleteFn: deleteColor,
    importFn: importarColoresPDF
  },
  forma: {
    queryKey: ['nomencladores', 'formas'],
    getFn: getFormas,
    createFn: createForma,
    updateFn: updateForma,
    deleteFn: deleteForma,
    importFn: importarFormasPDF
  },
  canto: {
    queryKey: ['nomencladores', 'canto'],
    getFn: getCanto,
    createFn: createCanto,
    updateFn: updateCanto,
    deleteFn: deleteCanto,
    importFn: importarCantoPDF
  }
};

// ── Panel de importación PDF ──────────────────────────────────────────────────
function ImportarPDFPanel({ tipo }) {
  const { queryKey, importFn } = CONFIG[tipo];
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [resultado, setResultado] = useState(null);
  const [errorImport, setErrorImport] = useState('');

  const mutation = useMutation({
    mutationFn: importFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      setResultado(data);
      setErrorImport('');
    },
    onError: (err) => {
      setErrorImport(err.response?.data?.error || 'Error al importar el PDF');
      setResultado(null);
    }
  });

  const handleArchivo = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
      setErrorImport('Solo se permiten archivos con extensión .pdf');
      return;
    }
    setErrorImport('');
    setResultado(null);
    mutation.mutate(archivo);
    e.target.value = '';
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700">Importar desde PDF</p>
          <p className="text-xs text-slate-500">
            Reemplaza todos los registros actuales. Formato esperado:{' '}
            <span className="font-mono">CODIGO  Nombre de línea</span>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={mutation.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {mutation.isPending
            ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Procesando...</>
            : <><Upload className="h-4 w-4 mr-1.5" />Seleccionar PDF</>
          }
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleArchivo}
        />
      </div>

      {errorImport && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorImport}
        </div>
      )}

      {resultado && (
        <div className="flex items-start gap-2 text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{resultado.message}</p>
            {resultado.muestra?.length > 0 && (
              <p className="text-xs mt-0.5 text-green-700 truncate">
                Primeros registros: {resultado.muestra.map(m => `${m.codigo} - ${m.nombreLinea}`).join(', ')}
                {resultado.total > 5 ? ` y ${resultado.total - 5} más.` : '.'}
              </p>
            )}
          </div>
          <button
            onClick={() => setResultado(null)}
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── CRUD genérico ─────────────────────────────────────────────────────────────
function NomencladorCRUD({ tipo }) {
  const { queryKey, getFn, createFn, updateFn, deleteFn } = CONFIG[tipo];
  const queryClient = useQueryClient();

  const [modal, setModal] = useState({ open: false, item: null });
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ codigo: '', nombreLinea: '' });
  const [error, setError] = useState('');

  const { data: items = [], isLoading } = useQuery({ queryKey, queryFn: getFn });

  const saveMutation = useMutation({
    mutationFn: (data) => modal.item ? updateFn(modal.item._id, data) : createFn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setModal({ open: false, item: null });
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar')
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeleteId(null);
    }
  });

  const openEdit = (item = null) => {
    setForm(item ? { codigo: item.codigo, nombreLinea: item.nombreLinea } : { codigo: '', nombreLinea: '' });
    setError('');
    setModal({ open: true, item });
  };

  const columns = [
    { key: 'codigo', label: 'Código', className: 'w-28 font-mono font-semibold' },
    { key: 'nombreLinea', label: 'Nombre de línea' },
    {
      key: 'activo',
      label: 'Estado',
      render: row => (
        <Badge variant={row.activo ? 'success' : 'secondary'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    },
    {
      key: 'acciones',
      label: '',
      render: row => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500"
            onClick={() => setDeleteId(row._id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <ImportarPDFPanel tipo={tipo} />

      <div className="flex justify-end">
        <Button onClick={() => openEdit()}>
          <Plus className="h-4 w-4 mr-1.5" />
          Agregar
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="Sin registros. Puede importar desde un PDF o agregar manualmente."
      />

      <Dialog open={modal.open} onOpenChange={o => setModal(m => ({ ...m, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal.item ? 'Editar' : 'Nuevo'} nomenclador</DialogTitle>
          </DialogHeader>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Código único *</Label>
              <Input
                value={form.codigo}
                onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                placeholder="Ej: AM"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre de línea *</Label>
              <Input
                value={form.nombreLinea}
                onChange={e => setForm(p => ({ ...p, nombreLinea: e.target.value }))}
                placeholder="Ej: Amarillo"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ open: false, item: null })}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.codigo.trim() || !form.nombreLinea.trim()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="¿Eliminar nomenclador?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ── Páginas exportadas ────────────────────────────────────────────────────────
export function NomencladorColorPage() {
  return (
    <div>
      <PageHeader title="Nomenclador de Colores" description="Rama de colores para canarios" />
      <NomencladorCRUD tipo="color" />
    </div>
  );
}

export function NomencladorFormaPage() {
  return (
    <div>
      <PageHeader title="Nomenclador de Forma / Postura" description="Rama de forma y postura para canarios" />
      <NomencladorCRUD tipo="forma" />
    </div>
  );
}

export function NomencladorCantoPage() {
  return (
    <div>
      <PageHeader title="Nomenclador de Canto" description="Rama de canto para canarios" />
      <NomencladorCRUD tipo="canto" />
    </div>
  );
}
