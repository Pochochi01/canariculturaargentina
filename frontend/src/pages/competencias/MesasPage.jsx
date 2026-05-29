import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompetencia } from '@/api/competencia.api';
import { getMesasByCompetencia, createMesa, updateMesa, deleteMesa, actualizarEstadoLote, cambiarEstadoTodasLasMesas } from '@/api/mesa.api';
import { getLotes } from '@/api/inscripcion.api';
import { useAuth } from '@/context/AuthContext';
import { getJueces } from '@/api/juez.api';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2, X, Search, Eye } from 'lucide-react';

// ─── Búsqueda ─────────────────────────────────────────────────────────────────
const norm = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// AND: todos los términos deben estar presentes
const matchSearch = (texto, termino) => {
  if (!termino.trim()) return true;
  const haystack = norm(texto);
  return termino.trim().split(/\s+/).every(p => haystack.includes(norm(p)));
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const ESTADO_COLORS = {
  abierto: 'bg-green-100 text-green-800 border-green-300',
  cerrado: 'bg-amber-100 text-amber-800 border-amber-300',
  jurado:  'bg-blue-100 text-blue-800 border-blue-300',
};

const TIPO_PRES_LABEL = { individual: 'Individual', duos: 'Dúos', cuartetos: 'Cuartetos' };

const emptyForm = {
  juecesIds: [],
  operadorDni: '',
  operadorPassword: '',
  lotes: []
};

// ─── Editor de lotes (checkbox grid desde inscripciones) ──────────────────────
function LoteEditor({ lotes, onChange, competenciaId, todasLasMesas, mesaId }) {
  const [busqueda, setBusqueda] = useState('');

  const { data: lotesInscripciones = [], isLoading } = useQuery({
    queryKey: ['lotes-inscripciones', competenciaId],
    queryFn: () => getLotes(competenciaId),
    enabled: !!competenciaId,
  });

  // Lotes asignados en OTRAS mesas (disabled)
  const lotesOtrasMesas = useMemo(() => {
    const s = new Set();
    for (const m of todasLasMesas) {
      if (m._id === mesaId) continue;
      for (const l of (m.lotes || [])) {
        s.add(`${l.codigoNomenclador}|${l.tipoPresentacion}`);
      }
    }
    return s;
  }, [todasLasMesas, mesaId]);

  // Lotes asignados a esta mesa
  const lotesActuales = useMemo(
    () => new Set(lotes.map(l => `${l.codigoNomenclador}|${l.tipoPresentacion}`)),
    [lotes]
  );

  const handleToggle = (item) => {
    const key = `${item._id.lote}|${item._id.tipoPresentacion}`;
    if (lotesActuales.has(key)) {
      onChange(lotes.filter(l => !(l.codigoNomenclador === item._id.lote && l.tipoPresentacion === item._id.tipoPresentacion)));
    } else {
      onChange([...lotes, {
        codigoNomenclador: item._id.lote,
        nombreNomenclador: item.nombreNomenclador,
        tipoNomenclador: item.tipoNomenclador,
        tipoPresentacion: item._id.tipoPresentacion,
      }]);
    }
  };

  // Filtrar con AND y ordenar color→forma, luego por código
  const filtered = useMemo(() => {
    const base = lotesInscripciones.filter(l => {
      if (!busqueda.trim()) return true;
      return matchSearch(`${l._id.lote} ${l.nombreNomenclador} ${l._id.tipoPresentacion}`, busqueda);
    });
    return [...base].sort((a, b) => {
      if (a.tipoNomenclador !== b.tipoNomenclador)
        return a.tipoNomenclador === 'color' ? -1 : 1;
      return (a._id.lote || '').localeCompare(b._id.lote || '');
    });
  }, [lotesInscripciones, busqueda]);

  return (
    <div className="space-y-2">
      <Label>Lotes asignados</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8 h-8 text-sm"
          placeholder="Buscar por código o nombre..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>
      <div className="border rounded-md max-h-64 overflow-y-auto bg-white">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-3 text-center">
            {busqueda ? 'Sin resultados.' : 'Sin lotes en esta competencia.'}
          </p>
        ) : (
          filtered.map(item => {
            const key = `${item._id.lote}|${item._id.tipoPresentacion}`;
            const checked = lotesActuales.has(key);
            const disabledByOther = lotesOtrasMesas.has(key) && !checked;
            return (
              <label
                key={key}
                className={`flex items-center gap-3 px-3 py-2 text-sm border-b last:border-0 select-none ${
                  disabledByOther
                    ? 'opacity-40 cursor-not-allowed bg-slate-50'
                    : 'hover:bg-blue-50 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabledByOther}
                  onChange={() => handleToggle(item)}
                  className="h-4 w-4 rounded accent-blue-600 shrink-0"
                />
                <span className="font-mono font-semibold w-14 shrink-0 text-xs">{item._id.lote}</span>
                <span className="flex-1 text-slate-600 truncate text-xs">{item.nombreNomenclador}</span>
                <Badge variant="secondary" className="text-xs shrink-0 capitalize">
                  {TIPO_PRES_LABEL[item._id.tipoPresentacion] || item._id.tipoPresentacion}
                </Badge>
                <span className="text-xs text-slate-400 shrink-0 w-10 text-right">{item.count} aves</span>
              </label>
            );
          })
        )}
      </div>
      {lotes.length > 0 && (
        <p className="text-xs text-muted-foreground">{lotes.length} lote(s) seleccionado(s)</p>
      )}
    </div>
  );
}

// ─── Selector de múltiples jueces ────────────────────────────────────────────
function JuecesSelector({ juecesIds, jueces, onChange }) {
  const [busq, setBusq] = useState('');
  const filtrados = busq.trim()
    ? jueces.filter(j => matchSearch(`${j.codigo} ${j.apellido} ${j.nombre}`, busq))
    : jueces;

  return (
    <div className="space-y-1.5">
      <Label>Jueces <span className="text-muted-foreground font-normal text-xs">(pueden ser varios)</span></Label>

      {/* Chips de jueces seleccionados */}
      {juecesIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {juecesIds.map(id => {
            const j = jueces.find(j => j._id === id);
            if (!j) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                {j.codigo} — {j.apellido}, {j.nombre}
                <button type="button" onClick={() => onChange(juecesIds.filter(x => x !== id))}
                  className="hover:text-blue-600 ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Lista de jueces disponibles con búsqueda */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input className="pl-8 h-8 text-sm" placeholder="Buscar juez..." value={busq}
          onChange={e => setBusq(e.target.value)} />
      </div>
      <div className="border rounded-md max-h-40 overflow-y-auto bg-white">
        {filtrados.length === 0
          ? <p className="text-xs text-muted-foreground px-3 py-3 text-center">Sin resultados</p>
          : filtrados.map(j => {
              const sel = juecesIds.includes(j._id);
              return (
                <label key={j._id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm border-b last:border-0 cursor-pointer select-none
                    ${sel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={sel} className="h-4 w-4 accent-blue-600 shrink-0"
                    onChange={() => onChange(sel ? juecesIds.filter(x => x !== j._id) : [...juecesIds, j._id])} />
                  <span className="font-mono text-xs w-12 shrink-0 text-slate-500">{j.codigo}</span>
                  <span className="flex-1 truncate">{j.apellido}, {j.nombre}</span>
                  {j.tipoJuez && <span className="text-xs text-slate-400 shrink-0">{j.tipoJuez}</span>}
                </label>
              );
            })}
      </div>
    </div>
  );
}

// ─── Modal crear/editar mesa ──────────────────────────────────────────────────
function MesaModal({ open, onClose, mesa, competenciaId, jueces, todasLasMesas, onSave, loading, saveError }) {
  const [form, setForm] = useState(mesa
    ? {
        juecesIds: (mesa.juecesIds || []).map(j => j._id || j),
        operadorDni: mesa.operadorId?.dni || '',
        operadorPassword: '',
        lotes: mesa.lotes || []
      }
    : { ...emptyForm }
  );
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!form.operadorDni.trim()) { setError('El DNI del operador es obligatorio'); return; }
    setError('');
    onSave({ ...form, competenciaId });
  };

  const errorMsg = error || saveError || '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mesa ? `Editar Mesa N° ${mesa.numero}` : 'Nueva Mesa'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
              <X className="h-4 w-4 shrink-0" />{errorMsg}
            </div>
          )}

          {/* DNI del operador */}
          <div className="space-y-1.5">
            <Label>DNI del operador *</Label>
            <Input
              value={form.operadorDni}
              onChange={e => { setForm(p => ({ ...p, operadorDni: e.target.value })); setError(''); }}
              placeholder="DNI del operador informático"
            />
          </div>

          {!mesa && form.operadorDni && (
            <div className="space-y-1.5">
              <Label>Contraseña del operador <span className="text-muted-foreground font-normal text-xs">(vacío = usa el DNI)</span></Label>
              <Input type="password" value={form.operadorPassword}
                onChange={e => setForm(p => ({ ...p, operadorPassword: e.target.value }))}
                placeholder="Dejar vacío para usar el DNI como contraseña" />
            </div>
          )}

          {/* Selector de jueces */}
          <JuecesSelector
            juecesIds={form.juecesIds}
            jueces={jueces}
            onChange={juecesIds => setForm(p => ({ ...p, juecesIds }))}
          />

          <LoteEditor
            lotes={form.lotes}
            onChange={lotes => setForm(p => ({ ...p, lotes }))}
            competenciaId={competenciaId}
            todasLasMesas={todasLasMesas}
            mesaId={mesa?._id}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Celda de lotes con estado ────────────────────────────────────────────────
function LotesConEstado({ mesa, onEstadoChange, saving, esAdmin }) {
  const estadoLotes = mesa.estadoLotes || {};
  if (!mesa.lotes?.length) {
    return <span className="text-slate-400 text-xs italic">Sin lotes asignados</span>;
  }

  const puedeIr = (estadoActual, nuevoEstado) => {
    if (esAdmin) {
      if (estadoActual === 'cerrado' && nuevoEstado === 'jurado')  return false;
      if (estadoActual === 'jurado'  && nuevoEstado === 'cerrado') return false;
      return true;
    }
    if (estadoActual === 'jurado') return false;
    return estadoActual === 'abierto' && nuevoEstado !== 'abierto';
  };

  return (
    <div className="space-y-1">
      {mesa.lotes.map((l, i) => {
        const loteKey = `${l.codigoNomenclador} - ${(l.tipoPresentacion || 'todos').toUpperCase()}`;
        const estadoActual = estadoLotes[loteKey] || 'abierto';

        return (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-xs w-14 shrink-0">{l.codigoNomenclador}</span>
            <span className="text-xs text-slate-500 w-28 truncate shrink-0" title={l.nombreNomenclador}>
              {l.nombreNomenclador}
            </span>
            <span className="text-xs text-slate-400 w-20 shrink-0 capitalize">{l.tipoPresentacion}</span>
            <div className="flex gap-0.5">
              {['abierto', 'cerrado', 'jurado'].map(est => (
                <button
                  key={est}
                  disabled={saving || !puedeIr(estadoActual, est)}
                  onClick={() => onEstadoChange(mesa._id, loteKey, est)}
                  className={`text-xs px-1.5 py-0.5 rounded border capitalize transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    estadoActual === est
                      ? ESTADO_COLORS[est]
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function MesasPage() {
  const { id: competenciaId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin_general' || user?.role === 'admin_sociedad';
  const [modal, setModal] = useState({ open: false, mesa: null });
  const [deleteId, setDeleteId] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const { data: competencia } = useQuery({
    queryKey: ['competencia', competenciaId],
    queryFn: () => getCompetencia(competenciaId)
  });
  const { data: mesas = [], isLoading } = useQuery({
    queryKey: ['mesas', competenciaId],
    queryFn: () => getMesasByCompetencia(competenciaId),
    enabled: !!competenciaId
  });
  const { data: jueces = [] } = useQuery({ queryKey: ['jueces'], queryFn: getJueces });

  const mesasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return mesas;
    return mesas.filter(m => {
      const campos = [
        String(m.numero),
        (m.juecesIds || []).map(j => `${j.apellido} ${j.nombre} ${j.codigo}`).join(' '),
        m.operadorId?.dni || '',
        (m.lotes || []).map(l => `${l.codigoNomenclador} ${l.nombreNomenclador}`).join(' ')
      ].join(' ');
      return matchSearch(campos, busqueda);
    });
  }, [mesas, busqueda]);

  const invalidarMesas = () =>
    queryClient.invalidateQueries({ queryKey: ['mesas', competenciaId] });

  const saveMutation = useMutation({
    mutationFn: (data) => modal.mesa ? updateMesa(modal.mesa._id, data) : createMesa(data),
    onSuccess: () => { invalidarMesas(); setModal({ open: false, mesa: null }); },
    onError: () => {}  // el error se muestra dentro del modal via saveMutation.error
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMesa,
    onSuccess: () => { invalidarMesas(); setDeleteId(null); }
  });

  const estadoMutation = useMutation({
    mutationFn: ({ mesaId, loteKey, estado }) => actualizarEstadoLote(mesaId, { loteKey, estado }),
    onSuccess: () => invalidarMesas()
  });

  const cambiarTodasMutation = useMutation({
    mutationFn: (estado) => cambiarEstadoTodasLasMesas(competenciaId, estado),
    onSuccess: () => invalidarMesas()
  });

  const handleEstadoChange = (mesaId, loteKey, estado) => {
    estadoMutation.mutate({ mesaId, loteKey, estado });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Mesas — ${competencia?.nombre || '...'}`}
        description="Mesas de campeonato con juez y operador"
        backTo={`/competencias/${competenciaId}`}
        actions={
          <div className="flex gap-2">
            {esAdmin && (
              <>
                <Button
                  variant="outline"
                  onClick={() => cambiarTodasMutation.mutate('abierto')}
                  disabled={cambiarTodasMutation.isPending}
                >
                  {cambiarTodasMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Abrir todas
                </Button>
                <Button
                  variant="outline"
                  onClick={() => cambiarTodasMutation.mutate('cerrado')}
                  disabled={cambiarTodasMutation.isPending}
                >
                  {cambiarTodasMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Cerrar todas
                </Button>
              </>
            )}
            <Button onClick={() => setModal({ open: true, mesa: null })}>
              <Plus className="h-4 w-4" /> Nueva mesa
            </Button>
          </div>
        }
      />

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8"
          placeholder="Buscar por mesa, juez, operador, lote..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla de mesas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando...
        </div>
      ) : mesasFiltradas.length === 0 ? (
        <div className="rounded-md border bg-white text-center py-10 text-muted-foreground text-sm">
          {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay mesas configuradas.'}
        </div>
      ) : (
        <div className="rounded-md border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left w-20 font-semibold text-slate-700">N° Mesa</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Juez</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Operador</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Lotes y Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 w-44">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mesasFiltradas.map(mesa => (
                <tr key={mesa._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-xl text-center text-primary">{mesa.numero}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {mesa.juecesIds?.length > 0
                      ? (
                        <div className="space-y-0.5">
                          {mesa.juecesIds.map(j => (
                            <div key={j._id} className="text-sm">
                              <span className="font-mono text-xs text-slate-500 mr-1">{j.codigo}</span>
                              {j.apellido}, {j.nombre}
                            </div>
                          ))}
                        </div>
                      )
                      : <span className="text-slate-400 italic text-xs">Sin juez</span>
                    }
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {mesa.operadorId?.dni || <span className="text-slate-400 italic text-xs">Sin operador</span>}
                  </td>
                  <td className="px-4 py-3">
                    <LotesConEstado
                      mesa={mesa}
                      onEstadoChange={handleEstadoChange}
                      saving={estadoMutation.isPending}
                      esAdmin={esAdmin}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/mesas/${mesa._id}/jura`)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Jura
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, mesa })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(mesa._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <MesaModal
          open={modal.open}
          onClose={() => setModal({ open: false, mesa: null })}
          mesa={modal.mesa}
          competenciaId={competenciaId}
          jueces={jueces}
          todasLasMesas={mesas}
          onSave={saveMutation.mutate}
          loading={saveMutation.isPending}
          saveError={saveMutation.error?.response?.data?.error || (saveMutation.isError ? 'Error al guardar la mesa' : '')}
        />
      )}

      <ConfirmDialog
        open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="¿Eliminar mesa?"
        description="Se eliminarán también los datos asociados a esta mesa."
        onConfirm={() => deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending}
      />
    </div>
  );
}
