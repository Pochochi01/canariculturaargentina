import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFederaciones, createFederacion, updateFederacion, deleteFederacion,
  getTiposJuez,   createTipoJuez,   updateTipoJuez,   deleteTipoJuez,
  getOpcionesMax, createOpcionMax,  updateOpcionMax,  deleteOpcionMax,
} from '@/api/dropdown.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle } from 'lucide-react';

// ─── Fila de formulario inline (nuevo / editar) ───────────────────────────────

function InlineForm({ fields, values, onChange, onSave, onCancel, saving, error }) {
  return (
    <div className="flex gap-2 items-start p-2 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex gap-2 flex-1 flex-wrap items-center">
        {fields.map(f => (
          <div key={f.key} style={f.width ? { width: f.width } : { flex: 1, minWidth: 80 }}>
            <Input
              className={`h-8 text-sm ${f.uppercase ? 'uppercase' : ''}`}
              placeholder={f.placeholder}
              value={values[f.key] || ''}
              onChange={e => onChange(f.key, f.uppercase ? e.target.value.toUpperCase() : e.target.value)}
              autoFocus={f.autofocus}
            />
          </div>
        ))}
      </div>
      {error && (
        <div className="flex items-center gap-1 text-red-500 text-xs whitespace-nowrap shrink-0 self-center">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon" variant="ghost"
          className="text-green-600 hover:bg-green-50 h-8 w-8"
          onClick={onSave}
          disabled={saving || !!error}
          title="Confirmar"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button
          size="icon" variant="ghost"
          className="text-slate-500 hover:bg-slate-100 h-8 w-8"
          onClick={onCancel}
          title="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Sección CRUD genérica ────────────────────────────────────────────────────

function CrudSection({ title, description, queryKey, getAll, create, update, remove, fields, buildNew, validate, renderDisplay }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [queryKey] });

  const { data: items = [], isLoading } = useQuery({ queryKey: [queryKey], queryFn: getAll });

  const [adding,   setAdding]   = useState(false);
  const [newVals,  setNewVals]  = useState(buildNew);
  const [editId,   setEditId]   = useState(null);
  const [editVals, setEditVals] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [mutErr,   setMutErr]   = useState('');

  const createMut = useMutation({
    mutationFn: create,
    onSuccess: () => { invalidate(); setAdding(false); setNewVals(buildNew()); setMutErr(''); },
    onError: (e) => setMutErr(e.response?.data?.error || 'Error al crear'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => update(id, data),
    onSuccess: () => { invalidate(); setEditId(null); setMutErr(''); },
    onError: (e) => setMutErr(e.response?.data?.error || 'Error al guardar'),
  });

  const deleteMut = useMutation({
    mutationFn: remove,
    onSuccess: () => { invalidate(); setDeleteId(null); },
    onError: (e) => setMutErr(e.response?.data?.error || 'Error al eliminar'),
  });

  const handleNewChange  = (key, val) => setNewVals(p => ({ ...p, [key]: val }));
  const handleEditChange = (key, val) => setEditVals(p => ({ ...p, [key]: val }));

  const startEdit = (item) => { setEditId(item._id); setEditVals({ ...item }); setMutErr(''); };
  const cancelEdit = () => { setEditId(null); setEditVals({}); setMutErr(''); };
  const startAdd   = () => { setAdding(true); setNewVals(buildNew()); setMutErr(''); };
  const cancelAdd  = () => { setAdding(false); setNewVals(buildNew()); setMutErr(''); };

  const newErr  = validate ? validate(newVals)  : '';
  const editErr = validate ? validate(editVals) : '';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <Button size="sm" variant="outline" onClick={startAdd} disabled={adding} className="shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-1">
        {/* Error global de mutación */}
        {mutErr && !adding && editId === null && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {mutErr}
          </div>
        )}

        {/* Fila de agregar */}
        {adding && (
          <InlineForm
            fields={fields}
            values={newVals}
            onChange={handleNewChange}
            onSave={() => createMut.mutate(newVals)}
            onCancel={cancelAdd}
            saving={createMut.isPending}
            error={newErr || (createMut.isError ? mutErr : '')}
          />
        )}

        {/* Lista de registros */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : items.length === 0 && !adding ? (
          <p className="text-center py-6 text-sm text-muted-foreground">Sin registros todavía.</p>
        ) : (
          items.map(item => (
            <div
              key={item._id}
              className={`flex items-center gap-2 rounded-lg border transition-colors ${
                editId === item._id
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              {editId === item._id ? (
                <InlineForm
                  fields={fields}
                  values={editVals}
                  onChange={handleEditChange}
                  onSave={() => updateMut.mutate({ id: item._id, data: editVals })}
                  onCancel={cancelEdit}
                  saving={updateMut.isPending}
                  error={editErr || (updateMut.isError ? mutErr : '')}
                />
              ) : (
                <>
                  <div className="flex-1 px-3 py-2 text-sm">
                    {renderDisplay(item)}
                  </div>
                  <div className="flex gap-0.5 pr-2 shrink-0">
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-slate-500 hover:text-slate-800"
                      onClick={() => startEdit(item)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteId(item._id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </CardContent>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="¿Eliminar registro?"
        description="Esta acción es permanente y no se puede deshacer."
        onConfirm={() => deleteMut.mutate(deleteId)}
        loading={deleteMut.isPending}
      />
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DropDownsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurar DropDowns"
        description="Administrá los valores que aparecen en los selectores del sistema"
        backTo="/admin/configuracion"
      />

      {/* Federaciones */}
      <CrudSection
        title="Federaciones"
        description="Opciones disponibles en el selector de federación de sociedades y jueces."
        queryKey="federaciones"
        getAll={getFederaciones}
        create={createFederacion}
        update={updateFederacion}
        remove={deleteFederacion}
        buildNew={() => ({ codigo: '', nombre: '' })}
        validate={item => !item.codigo?.trim() ? 'El código es obligatorio' : ''}
        fields={[
          { key: 'codigo', placeholder: 'Código (ej: FAC)', width: '120px', uppercase: true, autofocus: true },
          { key: 'nombre', placeholder: 'Nombre completo' },
        ]}
        renderDisplay={item => (
          <span>
            <span className="font-mono font-semibold text-slate-800">{item.codigo}</span>
            {item.nombre && <span className="text-slate-500 ml-2">— {item.nombre}</span>}
          </span>
        )}
      />

      {/* Tipos de Juez */}
      <CrudSection
        title="Tipos de Juez"
        description="Especialidades disponibles al registrar un juez."
        queryKey="tipos-juez"
        getAll={getTiposJuez}
        create={createTipoJuez}
        update={updateTipoJuez}
        remove={deleteTipoJuez}
        buildNew={() => ({ valor: '', label: '', orden: 0 })}
        validate={item => !item.label?.trim() ? 'La etiqueta es obligatoria' : ''}
        fields={[
          { key: 'label', placeholder: 'Etiqueta (ej: Color)', autofocus: true },
          { key: 'valor', placeholder: 'Valor interno (ej: color)' },
        ]}
        renderDisplay={item => (
          <span>
            <span className="font-medium text-slate-800">{item.label}</span>
            {item.valor && item.valor !== item.label && (
              <span className="text-slate-400 ml-2 text-xs font-mono">{item.valor}</span>
            )}
          </span>
        )}
      />

      {/* Opciones Máximo por Socio */}
      <CrudSection
        title="Opciones Máximo por Socio"
        description="Límite de inscripciones por socio en una competencia. Aparecen en el formulario de competencia."
        queryKey="opciones-max"
        getAll={getOpcionesMax}
        create={createOpcionMax}
        update={updateOpcionMax}
        remove={deleteOpcionMax}
        buildNew={() => ({ valor: '', label: '', orden: 0 })}
        validate={item => !item.valor?.trim() ? 'El valor es obligatorio' : ''}
        fields={[
          { key: 'valor', placeholder: 'Valor (ej: libre, 2, 5)', width: '150px', autofocus: true },
          { key: 'label', placeholder: 'Etiqueta (ej: Libre, 2 por lote)' },
          { key: 'orden', placeholder: 'Orden', width: '70px' },
        ]}
        renderDisplay={item => (
          <span>
            <span className="font-medium text-slate-800">{item.label || item.valor}</span>
            {item.label && item.label !== item.valor && (
              <span className="text-slate-400 ml-2 text-xs font-mono">valor: {item.valor}</span>
            )}
          </span>
        )}
      />
    </div>
  );
}
