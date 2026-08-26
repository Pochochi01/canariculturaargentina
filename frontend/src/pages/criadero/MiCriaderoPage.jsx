import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEjemplares, createEjemplar, updateEjemplar, deleteEjemplar, buscarCriadorPorProcedencia, verificarDuplicadoEjemplar } from '@/api/ejemplar.api';
import { getParejas, createPareja, updatePareja, deletePareja } from '@/api/pareja.api';
import { getPuestasByPareja, getDescendientesByPareja, createPuesta, updatePuesta, deletePuesta, setHuevosPuesta, updateHuevo } from '@/api/puesta.api';
import { getColores, getFormas, getCanto } from '@/api/nomenclador.api';
import { getMiPerfil } from '@/api/socio.api';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2, Bird, Heart, CheckCircle2, Egg, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Constants ───────────────────────────────────────────────────────────────

const SEXOS = [
  { value: 'macho', label: 'Macho' },
  { value: 'hembra', label: 'Hembra' },
  { value: 'desconocido', label: 'Desconocido' },
];

const TIPOS = [
  { value: 'color', label: 'Color' },
  { value: 'forma', label: 'Forma y Postura' },
  { value: 'canto', label: 'Canto' },
];

const ESTADOS = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'en_venta', label: 'En venta' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'muerto', label: 'Muerto' },
  { value: 'intercambiado', label: 'Intercambiado' },
  { value: 'perdido', label: 'Perdido' },
  { value: 'donado', label: 'Donado' },
  { value: 'otro', label: 'Otro' },
];

const ESTADO_COLORS = {
  disponible: 'bg-green-100 text-green-700',
  en_venta: 'bg-blue-100 text-blue-700',
  vendido: 'bg-slate-100 text-slate-600',
  muerto: 'bg-red-100 text-red-700',
  intercambiado: 'bg-purple-100 text-purple-700',
  perdido: 'bg-orange-100 text-orange-700',
  donado: 'bg-yellow-100 text-yellow-700',
  otro: 'bg-slate-100 text-slate-600',
};

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_EJEMPLAR = {
  numAnillo: '', sexo: 'desconocido', tipoCanario: '',
  codigoNomenclador: '', nombreNomenclador: '',
  temporadaAnillado: CURRENT_YEAR,
  procedencia: '',
  procedenciaTipo: 'propio',
  procedenciaApellido: '',
  procedenciaNombre: '',
  fechaNacimiento: '', fechaAnillado: '',
  estado: 'disponible', jaula: '', observaciones: '',
};

const normStr = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const matchAND = (texto, query) => {
  if (!query.trim()) return true;
  const h = normStr(texto);
  return query.trim().split(/\s+/).every(p => h.includes(normStr(p)));
};

const EMPTY_PAREJA = {
  machoId: '', hembraId: '',
  fechaEmparejamiento: '', numJaula: '',
  fechaPuestaNido: '', comentarios: '',
};

// ─── Ejemplar form modal ──────────────────────────────────────────────────────

const TEMPORADAS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

function EjemplarModal({ open, onClose, initial, loading, onSave, serverError }) {
  const [form, setForm] = useState(initial || EMPTY_EJEMPLAR);
  const [busquedaNomen, setBusquedaNomen] = useState('');
  const [criadorCargando, setCriadorCargando] = useState(false);
  const [criadorEncontrado, setCriadorEncontrado] = useState(false);
  const [criadorNoEncontrado, setCriadorNoEncontrado] = useState(false);
  const [duplicadoWarning, setDuplicadoWarning] = useState('');
  const [verificando, setVerificando] = useState(false);

  const { data: miPerfil } = useQuery({ queryKey: ['mi-perfil'], queryFn: getMiPerfil });
  const { data: colores = [] } = useQuery({ queryKey: ['colores'], queryFn: () => getColores({ activo: true }) });
  const { data: formas = [] } = useQuery({ queryKey: ['formas'], queryFn: () => getFormas({ activo: true }) });
  const { data: canto = [] } = useQuery({ queryKey: ['canto'], queryFn: () => getCanto({ activo: true }) });

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    const base = initial || EMPTY_EJEMPLAR;
    setForm(base);
    setBusquedaNomen('');
    setCriadorNoEncontrado(false);
    setDuplicadoWarning('');
    setCriadorEncontrado(
      base.procedenciaTipo === 'adquirido' && !!(base.procedenciaApellido || base.procedenciaNombre)
    );
  }, [open, initial]);

  // Auto-fill propio procedencia when profile loads (new exemplar)
  useEffect(() => {
    if (!open || !miPerfil) return;
    setForm(p => {
      if (p.procedenciaTipo === 'propio' && !p.procedencia) {
        return {
          ...p,
          procedencia: miPerfil.anilloCriador || '',
          procedenciaApellido: miPerfil.apellido || '',
          procedenciaNombre: miPerfil.nombre || '',
        };
      }
      return p;
    });
  }, [open, miPerfil]);

  const nomencladores = form.tipoCanario === 'color' ? colores
    : form.tipoCanario === 'forma' ? formas
    : form.tipoCanario === 'canto' ? canto
    : [];

  const nomencladoresFiltrados = busquedaNomen.trim()
    ? nomencladores.filter(n => matchAND(`${n.codigo} ${n.nombre || n.nombreLinea || ''}`, busquedaNomen))
    : nomencladores;

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleTipoCanarioChange = (tipo) => {
    setForm(p => ({ ...p, tipoCanario: tipo, codigoNomenclador: '', nombreNomenclador: '' }));
    setBusquedaNomen('');
  };

  const handleNomencladorChange = (codigo) => {
    const nomen = nomencladores.find(n => n.codigo === codigo);
    const nombre = form.tipoCanario === 'canto'
      ? (nomen?.nombreLinea || '')
      : (nomen?.nombre || nomen?.nombreLinea || '');
    setForm(p => ({ ...p, codigoNomenclador: codigo, nombreNomenclador: nombre }));
    setBusquedaNomen('');
  };

  const handleTipoProcedencia = (tipo) => {
    if (tipo === 'propio') {
      setForm(p => ({
        ...p,
        procedenciaTipo: 'propio',
        procedencia: miPerfil?.anilloCriador || '',
        procedenciaApellido: miPerfil?.apellido || '',
        procedenciaNombre: miPerfil?.nombre || '',
      }));
    } else {
      setForm(p => ({
        ...p,
        procedenciaTipo: 'adquirido',
        procedencia: '',
        procedenciaApellido: '',
        procedenciaNombre: '',
      }));
    }
    setCriadorEncontrado(false);
    setCriadorNoEncontrado(false);
    setDuplicadoWarning('');
  };

  const checkDuplicado = async (anillo, temporada, proc) => {
    if (!anillo || !temporada || !proc) { setDuplicadoWarning(''); return; }
    setVerificando(true);
    try {
      const { existe } = await verificarDuplicadoEjemplar({
        numAnillo: anillo,
        temporadaAnillado: Number(temporada),
        procedencia: proc.toUpperCase().replace(/\s/g, ''),
        ...(initial?._id ? { excludeId: initial._id } : {}),
      });
      setDuplicadoWarning(existe
        ? `Ya existe un ejemplar con anillo "${anillo}", temporada ${temporada} y procedencia ${proc}.`
        : ''
      );
    } catch {
      setDuplicadoWarning('');
    } finally {
      setVerificando(false);
    }
  };

  const buscarCriador = async () => {
    const codigo = (form.procedencia || '').trim();
    if (!codigo) return;
    setCriadorCargando(true);
    setCriadorEncontrado(false);
    setCriadorNoEncontrado(false);
    try {
      const criador = await buscarCriadorPorProcedencia(codigo);
      setForm(p => ({ ...p, procedenciaApellido: criador.apellido || '', procedenciaNombre: criador.nombre || '' }));
      setCriadorEncontrado(true);
    } catch {
      setForm(p => ({ ...p, procedenciaApellido: '', procedenciaNombre: '' }));
      setCriadorNoEncontrado(true);
    } finally {
      setCriadorCargando(false);
    }
    // Verificar duplicado una vez conocida la procedencia
    if (form.numAnillo && form.temporadaAnillado) {
      await checkDuplicado(form.numAnillo, form.temporadaAnillado, codigo);
    }
  };

  const handleSubmit = () => {
    if (!form.numAnillo || !form.tipoCanario || !form.sexo) return;
    onSave(form);
  };

  const showNombreApellido = form.procedenciaTipo === 'adquirido' && (criadorEncontrado || criadorNoEncontrado);
  const nombreApellidoDisabled = criadorEncontrado && !criadorNoEncontrado;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?._id ? 'Editar Ejemplar' : 'Nuevo Ejemplar'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Temporada + Anillo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Temporada de Anillado *</Label>
              <Select
                value={String(form.temporadaAnillado || CURRENT_YEAR)}
                onValueChange={v => { set('temporadaAnillado', Number(v)); setDuplicadoWarning(''); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPORADAS.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>N° Anillo *</Label>
              <Input
                value={form.numAnillo}
                onChange={e => { set('numAnillo', e.target.value); setDuplicadoWarning(''); }}
                onBlur={e => {
                  const padded = e.target.value ? e.target.value.padStart(4, '0') : '';
                  if (padded !== e.target.value) set('numAnillo', padded);
                  if (padded && form.procedencia) checkDuplicado(padded, form.temporadaAnillado, form.procedencia);
                }}
                placeholder="Ej: 1234"
                required
              />
            </div>
          </div>

          {/* Advertencia duplicado */}
          {(duplicadoWarning || verificando) && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              {verificando
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                : <AlertCircle className="h-4 w-4 shrink-0" />
              }
              {verificando ? 'Verificando duplicados...' : duplicadoWarning}
            </div>
          )}

          {/* Sexo + Tipo Canario */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sexo *</Label>
              <Select value={form.sexo} onValueChange={v => set('sexo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEXOS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Canario *</Label>
              <Select value={form.tipoCanario || '__none__'} onValueChange={v => handleTipoCanarioChange(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleccionar...</SelectItem>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Procedencia */}
          <div className="space-y-2 rounded-lg border p-3 bg-slate-50">
            <p className="text-sm font-medium text-slate-700">Procedencia</p>
            <div className="flex gap-6">
              {[
                { value: 'propio', label: 'Propio' },
                { value: 'adquirido', label: 'Adquirido' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="procedenciaTipo"
                    value={opt.value}
                    checked={form.procedenciaTipo === opt.value}
                    onChange={() => handleTipoProcedencia(opt.value)}
                    className="accent-primary h-4 w-4"
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </label>
              ))}
            </div>

            {form.procedenciaTipo === 'propio' ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Número de criador</Label>
                <Input
                  value={form.procedencia}
                  disabled
                  className="font-mono bg-slate-100 text-slate-500 h-8 text-sm"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Número único de criador</Label>
                  <div className="relative">
                    <Input
                      value={form.procedencia}
                      onChange={e => {
                        set('procedencia', e.target.value.toUpperCase().replace(/\s/g, ''));
                        setCriadorEncontrado(false);
                        setCriadorNoEncontrado(false);
                        setForm(p => ({ ...p, procedenciaApellido: '', procedenciaNombre: '' }));
                      }}
                      onBlur={buscarCriador}
                      placeholder="Ej: AR001"
                      className="font-mono h-8 text-sm pr-8"
                    />
                    {criadorCargando && (
                      <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>

                {criadorNoEncontrado && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Criador no encontrado. Complete los datos manualmente.
                  </p>
                )}

                {showNombreApellido && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Apellido</Label>
                      <Input
                        value={form.procedenciaApellido}
                        onChange={e => set('procedenciaApellido', e.target.value)}
                        disabled={nombreApellidoDisabled}
                        placeholder="Apellido..."
                        className={`h-8 text-sm ${nombreApellidoDisabled ? 'bg-slate-100 text-slate-500' : ''}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre</Label>
                      <Input
                        value={form.procedenciaNombre}
                        onChange={e => set('procedenciaNombre', e.target.value)}
                        disabled={nombreApellidoDisabled}
                        placeholder="Nombre..."
                        className={`h-8 text-sm ${nombreApellidoDisabled ? 'bg-slate-100 text-slate-500' : ''}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Variedad */}
          <div className="space-y-1.5">
            <Label>Variedad</Label>
            <Input
              value={busquedaNomen}
              onChange={e => {
                setBusquedaNomen(e.target.value);
                if (form.codigoNomenclador && e.target.value.trim()) {
                  const aun = nomencladores.find(n => n.codigo === form.codigoNomenclador);
                  if (aun && !matchAND(`${aun.codigo} ${aun.nombre || aun.nombreLinea || ''}`, e.target.value)) {
                    setForm(p => ({ ...p, codigoNomenclador: '', nombreNomenclador: '' }));
                  }
                }
              }}
              placeholder="Buscar por código o nombre..."
              disabled={!form.tipoCanario}
              className="h-8 text-xs"
            />
            <Select
              value={form.codigoNomenclador || '__none__'}
              onValueChange={v => handleNomencladorChange(v === '__none__' ? '' : v)}
              disabled={!form.tipoCanario || nomencladores.length === 0}
            >
              <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin especificar</SelectItem>
                {nomencladoresFiltrados.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">Sin resultados</div>
                ) : (
                  nomencladoresFiltrados.map(n => (
                    <SelectItem key={n.codigo} value={n.codigo}>
                      {n.codigo} — {n.nombre || n.nombreLinea}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha de Nacimiento</Label>
              <Input type="date" value={form.fechaNacimiento ? form.fechaNacimiento.slice(0, 10) : ''} onChange={e => set('fechaNacimiento', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de Anillado</Label>
              <Input type="date" value={form.fechaAnillado ? form.fechaAnillado.slice(0, 10) : ''} onChange={e => set('fechaAnillado', e.target.value)} />
            </div>
          </div>

          {/* Estado + Jaula */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set('estado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jaula</Label>
              <Input value={form.jaula} onChange={e => set('jaula', e.target.value)} placeholder="Ej: A-12" />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
        {serverError && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {serverError}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.numAnillo || !form.tipoCanario}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pareja form modal ────────────────────────────────────────────────────────

function ParejaModal({ open, onClose, initial, loading, onSave, machos, hembras }) {
  const [form, setForm] = useState(initial || EMPTY_PAREJA);

  useEffect(() => {
    if (open) setForm(initial || EMPTY_PAREJA);
  }, [open, initial]);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = () => {
    if (!form.machoId || !form.hembraId) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?._id ? 'Editar Pareja' : 'Nueva Pareja'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Macho *</Label>
              <Select value={form.machoId || '__none__'} onValueChange={v => set('machoId', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar macho..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleccionar...</SelectItem>
                  {machos.map(m => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.numAnillo}{m.nombreNomenclador ? ` — ${m.nombreNomenclador}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hembra *</Label>
              <Select value={form.hembraId || '__none__'} onValueChange={v => set('hembraId', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar hembra..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleccionar...</SelectItem>
                  {hembras.map(h => (
                    <SelectItem key={h._id} value={h._id}>
                      {h.numAnillo}{h.nombreNomenclador ? ` — ${h.nombreNomenclador}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha de Emparejamiento</Label>
              <Input type="date" value={form.fechaEmparejamiento ? form.fechaEmparejamiento.slice(0, 10) : ''} onChange={e => set('fechaEmparejamiento', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>N° Jaula de Trabajo</Label>
              <Input value={form.numJaula} onChange={e => set('numJaula', e.target.value)} placeholder="Ej: T-05" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de Puesta de Nido</Label>
            <Input type="date" value={form.fechaPuestaNido ? form.fechaPuestaNido.slice(0, 10) : ''} onChange={e => set('fechaPuestaNido', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Comentarios</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.comentarios}
              onChange={e => set('comentarios', e.target.value)}
              placeholder="Notas sobre la pareja..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.machoId || !form.hembraId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ejemplares tab ───────────────────────────────────────────────────────────

function EjemplaresTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data: ejemplares = [], isLoading } = useQuery({
    queryKey: ['ejemplares'],
    queryFn: () => getEjemplares(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing?._id ? updateEjemplar(editing._id, data) : createEjemplar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ejemplares'] });
      setModalOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEjemplar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ejemplares'] });
      setDeleteId(null);
    },
  });

  const openNew = () => { setEditing(null); setModalOpen(true); saveMutation.reset(); };
  const openEdit = (e) => { setEditing(e); setModalOpen(true); saveMutation.reset(); };

  const handleSave = (data) => saveMutation.mutate(data);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-3">

      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Ejemplar
        </Button>
      </div>

      {ejemplares.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <Bird className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No tenés ejemplares registrados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {ejemplares.map(e => (
            <Card key={e._id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold">{e.numAnillo}</span>
                    {e.temporadaAnillado && (
                      <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">{e.temporadaAnillado}</span>
                    )}
                    <span className="text-xs capitalize bg-slate-100 px-1.5 py-0.5 rounded">{e.sexo}</span>
                    <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded capitalize">{e.tipoCanario}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ESTADO_COLORS[e.estado] || ''}`}>
                      {ESTADOS.find(s => s.value === e.estado)?.label || e.estado}
                    </span>
                    {e.participoEnCompetencia && (
                      <span className="text-xs flex items-center gap-0.5 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Competencia
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {e.nombreNomenclador || e.codigoNomenclador || '—'}
                    {e.procedencia && <span className="ml-2 font-mono text-xs">· {e.procedencia}</span>}
                    {e.jaula && <span className="ml-2">· Jaula: {e.jaula}</span>}
                    {e.fechaNacimiento && (
                      <span className="ml-2">· Nac: {format(new Date(e.fechaNacimiento), 'dd/MM/yyyy', { locale: es })}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(e._id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EjemplarModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); saveMutation.reset(); }}
        initial={editing}
        loading={saveMutation.isPending}
        onSave={handleSave}
        serverError={saveMutation.error?.response?.data?.error || ''}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="¿Eliminar ejemplar?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── Constantes huevo ─────────────────────────────────────────────────────────

const ESTADOS_HUEVO = [
  { value: 'incubando',           label: 'Incubando',               color: 'bg-yellow-100 text-yellow-800' },
  { value: 'eclosionado',         label: 'Eclosionado',             color: 'bg-green-100 text-green-800' },
  { value: 'no_fertilizado',      label: 'No Fertilizado',          color: 'bg-slate-100 text-slate-600' },
  { value: 'roto',                label: 'Roto',                    color: 'bg-red-100 text-red-700' },
  { value: 'abandonado',          label: 'Abandonado',              color: 'bg-orange-100 text-orange-700' },
  { value: 'muerto_en_huevo',     label: 'Muerto en Huevo',         color: 'bg-red-200 text-red-800' },
  { value: 'muerto_antes_anillar',label: 'Muerto antes de Anillar', color: 'bg-red-200 text-red-800' },
];

const huevoColor = (estado) => ESTADOS_HUEVO.find(e => e.value === estado)?.color || '';
const huevoLabel = (estado) => ESTADOS_HUEVO.find(e => e.value === estado)?.label || estado;

// Días de referencia
const DIAS_INCUBACION = 13;
const DIAS_ANILLADO   = 5;   // días desde eclosión hasta anillar

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

// ─── PuestasTab (dentro de ParejaDetailDialog) ────────────────────────────────

function PuestasTab({ pareja, parejas }) {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ fechaInicioPuesta: '', fechaInicioIncubacion: '', numHuevos: 4, comentarios: '' });
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState('');

  const { data: puestas = [], isLoading } = useQuery({
    queryKey: ['puestas', pareja._id],
    queryFn: () => getPuestasByPareja(pareja._id),
  });

  const createMutation = useMutation({
    mutationFn: (data) => createPuesta({ ...data, parejaId: pareja._id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['puestas', pareja._id] });
      setNewOpen(false);
      setNewForm({ fechaInicioPuesta: '', fechaInicioIncubacion: '', numHuevos: 4, comentarios: '' });
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al crear puesta'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePuesta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['puestas', pareja._id] });
      setDeleteId(null);
    },
  });

  const huevoMutation = useMutation({
    mutationFn: ({ puestaId, huevoId, data }) => updateHuevo(puestaId, huevoId, data),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ['puestas', pareja._id] }),
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nueva Puesta
        </Button>
      </div>

      {puestas.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-6">No hay puestas registradas.</p>
      )}

      {puestas.map(puesta => {
        const diasIncub = diasDesde(puesta.fechaInicioIncubacion);
        const alertaEclosion = diasIncub !== null && diasIncub >= DIAS_INCUBACION - 1 && diasIncub <= DIAS_INCUBACION + 1
          && puesta.huevos.some(h => h.estado === 'incubando');
        const alertaAnillado = puesta.huevos.some(h => {
          if (h.estado !== 'eclosionado') return false;
          const d = diasDesde(puesta.fechaInicioIncubacion);
          return d !== null && d >= DIAS_INCUBACION + DIAS_ANILLADO - 1;
        });

        return (
          <Card key={puesta._id} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b">
              <div className="flex items-center gap-2">
                <Egg className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-sm">Puesta {puesta.numPuesta}</span>
                {puesta.fechaInicioPuesta && (
                  <span className="text-xs text-muted-foreground">
                    · {format(new Date(puesta.fechaInicioPuesta), 'dd/MM/yyyy', { locale: es })}
                  </span>
                )}
                {alertaEclosion && (
                  <span className="text-xs text-amber-600 flex items-center gap-0.5">
                    <AlertCircle className="h-3 w-3" /> ¡Eclosión hoy!
                  </span>
                )}
                {alertaAnillado && (
                  <span className="text-xs text-blue-600 flex items-center gap-0.5">
                    <AlertCircle className="h-3 w-3" /> ¡Anillar pronto!
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500"
                onClick={() => setDeleteId(puesta._id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="p-3 space-y-2">
              {puesta.fechaInicioIncubacion && (
                <p className="text-xs text-muted-foreground">
                  Incubación: {format(new Date(puesta.fechaInicioIncubacion), 'dd/MM/yyyy', { locale: es })}
                  {diasIncub !== null && <span className="ml-1 font-medium">({diasIncub} días)</span>}
                  <span className="ml-2 text-slate-400">· Eclosión: día {DIAS_INCUBACION} · Anillar: día {DIAS_INCUBACION + DIAS_ANILLADO}</span>
                </p>
              )}

              {puesta.huevos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sin huevos cargados.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {puesta.huevos.map(huevo => (
                    <div key={huevo._id} className="border rounded-lg p-2 min-w-35">
                      <p className="text-xs font-medium mb-1">Huevo #{huevo.numero}</p>
                      <Select
                        value={huevo.estado}
                        onValueChange={v => huevoMutation.mutate({ puestaId: puesta._id, huevoId: huevo._id, data: { estado: v } })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS_HUEVO.map(e => (
                            <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {huevo.parejaNodrizaId && (
                        <p className="text-xs text-purple-600 mt-1">Nodriza asignada</p>
                      )}
                      {/* Pasar a nodriza */}
                      <Select
                        value={huevo.parejaNodrizaId || '__ninguna__'}
                        onValueChange={v => huevoMutation.mutate({
                          puestaId: puesta._id,
                          huevoId: huevo._id,
                          data: { parejaNodrizaId: v === '__ninguna__' ? null : v }
                        })}
                      >
                        <SelectTrigger className="h-7 text-xs mt-1">
                          <SelectValue placeholder="Nodriza..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ninguna__">Sin nodriza</SelectItem>
                          {parejas
                            .filter(p2 => p2._id !== pareja._id)
                            .map(p2 => (
                              <SelectItem key={p2._id} value={p2._id}>
                                ♂{p2.machoId?.numAnillo} × ♀{p2.hembraId?.numAnillo}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
              {puesta.comentarios && <p className="text-xs text-slate-500 italic">{puesta.comentarios}</p>}
            </div>
          </Card>
        );
      })}

      {/* Nueva puesta modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva Puesta</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Cantidad de huevos (0–7)</Label>
              <Select
                value={String(newForm.numHuevos)}
                onValueChange={v => setNewForm(p => ({ ...p, numHuevos: parseInt(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5,6,7].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha inicio puesta</Label>
              <Input type="date" value={newForm.fechaInicioPuesta} onChange={e => setNewForm(p => ({ ...p, fechaInicioPuesta: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha inicio incubación</Label>
              <Input type="date" value={newForm.fechaInicioIncubacion} onChange={e => setNewForm(p => ({ ...p, fechaInicioIncubacion: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Comentarios</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={newForm.comentarios}
                onChange={e => setNewForm(p => ({ ...p, comentarios: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate(newForm)} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Puesta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="¿Eliminar puesta?"
        description="Se eliminarán todos los huevos asociados."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── DescendientesTab ─────────────────────────────────────────────────────────

const ESTADOS_PICHON = [
  { value: 'pendiente_anillar', label: 'Pendiente de anillar' },
  { value: 'anillado',          label: 'Anillado' },
  { value: 'destetado',         label: 'Destetado' },
  { value: 'muerto',            label: 'Muerto' },
];

function DescendientesTab({ pareja }) {
  const queryClient = useQueryClient();
  const { data: miPerfil } = useQuery({ queryKey: ['mi-perfil'], queryFn: getMiPerfil });

  // Reutiliza el caché que ya cargó PuestasTab
  const { data: puestas = [] } = useQuery({
    queryKey: ['puestas', pareja._id],
    queryFn: () => getPuestasByPareja(pareja._id),
  });

  const { data: descendientes = [], isLoading } = useQuery({
    queryKey: ['descendientes', pareja._id],
    queryFn: () => getDescendientesByPareja(pareja._id),
  });

  // Pichones eclosionados que aún no tienen un Ejemplar asignado
  const pendingPichones = puestas.flatMap(p =>
    p.huevos
      .filter(h => h.estado === 'eclosionado' && !h.ejemplarId)
      .map(h => ({ huevo: h, puesta: p }))
  );

  const [anillarTarget, setAnillarTarget] = useState(null);
  const [anillarForm, setAnillarForm] = useState({ numAnillo: '', sexo: 'desconocido', tipoCanario: 'color' });
  const [anillarError, setAnillarError] = useState('');

  const huevoMutation = useMutation({
    mutationFn: ({ puestaId, huevoId, data }) => updateHuevo(puestaId, huevoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['puestas', pareja._id] });
      queryClient.invalidateQueries({ queryKey: ['descendientes', pareja._id] });
    },
  });

  const createAndLinkMutation = useMutation({
    mutationFn: async ({ form, puesta, huevo }) => {
      const numPadded = String(form.numAnillo).padStart(4, '0');
      const ejemplar = await createEjemplar({
        numAnillo: numPadded,
        sexo: form.sexo,
        tipoCanario: form.tipoCanario,
        procedencia: miPerfil?.anilloCriador || '',
        procedenciaTipo: 'propio',
        procedenciaApellido: miPerfil?.apellido || '',
        procedenciaNombre: miPerfil?.nombre || '',
        temporadaAnillado: CURRENT_YEAR,
        puestaId: puesta._id,
        estado: 'disponible',
      });
      await updateHuevo(puesta._id, huevo._id, { estadoPichon: 'anillado', ejemplarId: ejemplar._id });
      return ejemplar;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['puestas', pareja._id] });
      queryClient.invalidateQueries({ queryKey: ['descendientes', pareja._id] });
      queryClient.invalidateQueries({ queryKey: ['ejemplares'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      setAnillarTarget(null);
      setAnillarError('');
    },
    onError: (err) => setAnillarError(err.response?.data?.error || 'Error al registrar el ejemplar'),
  });

  const handleEstadoPichon = (puestaId, huevoId, valor) => {
    if (valor === 'anillado') {
      const puesta = puestas.find(p => p._id === puestaId);
      const huevo = puesta?.huevos.find(h => h._id === huevoId);
      setAnillarTarget({ huevo, puesta });
      setAnillarForm({ numAnillo: '', sexo: 'desconocido', tipoCanario: 'color' });
      setAnillarError('');
    } else {
      huevoMutation.mutate({ puestaId, huevoId, data: { estadoPichon: valor } });
    }
  };

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const isEmpty = pendingPichones.length === 0 && descendientes.length === 0;

  return (
    <div className="space-y-3">
      {isEmpty && (
        <p className="text-sm text-center text-muted-foreground py-8">
          No hay descendientes registrados para esta pareja.
        </p>
      )}

      {/* Pichones eclosionados pendientes de anillar */}
      {pendingPichones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">Pichones nacidos</p>
          {pendingPichones.map(({ huevo, puesta }) => {
            const dias = diasDesde(huevo.fechaEclosion);
            const alertaAnillar = dias !== null && dias >= DIAS_ANILLADO;
            const isResuelto = huevo.estadoPichon === 'destetado' || huevo.estadoPichon === 'muerto';
            return (
              <Card key={huevo._id} className={isResuelto ? 'opacity-60' : ''}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Egg className={`h-4 w-4 shrink-0 ${isResuelto ? 'text-slate-300' : 'text-green-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      Pichón — Puesta {puesta.numPuesta} · Huevo #{huevo.numero}
                    </p>
                    {huevo.fechaEclosion && (
                      <p className="text-xs text-muted-foreground">
                        Eclosionó: {format(new Date(huevo.fechaEclosion), 'dd/MM/yyyy', { locale: es })}
                        {dias !== null && <span className="ml-1">({dias} días)</span>}
                        {alertaAnillar && !isResuelto && (
                          <span className="ml-2 text-blue-600 font-medium flex-inline items-center gap-0.5">
                            · ¡Anillar ya!
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <Select
                    value={huevo.estadoPichon || 'pendiente_anillar'}
                    onValueChange={v => handleEstadoPichon(puesta._id, huevo._id, v)}
                    disabled={huevoMutation.isPending}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_PICHON.map(e => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Descendientes ya anillados */}
      {descendientes.length > 0 && (
        <div className="space-y-2">
          {pendingPichones.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">Anillados</p>
          )}
          {descendientes.map(e => (
            <Card key={e._id}>
              <CardContent className="flex items-center gap-3 p-3">
                <Bird className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{e.numAnillo}</span>
                    <span className="text-xs capitalize bg-slate-100 px-1.5 py-0.5 rounded">{e.sexo}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${ESTADO_COLORS[e.estado] || ''}`}>
                      {ESTADOS.find(s => s.value === e.estado)?.label || e.estado}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.nombreNomenclador || e.codigoNomenclador || '—'}
                    {e.fechaNacimiento && (
                      <span className="ml-2">· Nac: {format(new Date(e.fechaNacimiento), 'dd/MM/yyyy', { locale: es })}</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para anillar pichón */}
      <Dialog open={!!anillarTarget} onOpenChange={() => { setAnillarTarget(null); setAnillarError(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Anillar Pichón</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {anillarError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {anillarError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>N° Anillo *</Label>
              <Input
                value={anillarForm.numAnillo}
                onChange={e => setAnillarForm(p => ({ ...p, numAnillo: e.target.value }))}
                onBlur={e => {
                  const padded = e.target.value ? e.target.value.padStart(4, '0') : '';
                  if (padded !== e.target.value) setAnillarForm(p => ({ ...p, numAnillo: padded }));
                }}
                placeholder="Ej: 0025"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <Select value={anillarForm.sexo} onValueChange={v => setAnillarForm(p => ({ ...p, sexo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEXOS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Canario</Label>
              <Select value={anillarForm.tipoCanario} onValueChange={v => setAnillarForm(p => ({ ...p, tipoCanario: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAnillarTarget(null); setAnillarError(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => createAndLinkMutation.mutate({ form: anillarForm, puesta: anillarTarget.puesta, huevo: anillarTarget.huevo })}
              disabled={!anillarForm.numAnillo || createAndLinkMutation.isPending}
            >
              {createAndLinkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar y anillar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ParejaDetailDialog ───────────────────────────────────────────────────────

function ParejaDetailDialog({ open, onClose, pareja, parejas }) {
  const [subTab, setSubTab] = useState('puestas');

  if (!pareja) return null;
  const macho = pareja.machoId;
  const hembra = pareja.hembraId;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>♂ {macho?.numAnillo || '—'}</span>
            <span className="text-muted-foreground">×</span>
            <span>♀ {hembra?.numAnillo || '—'}</span>
            {pareja.numJaula && <Badge variant="outline" className="text-xs">Jaula: {pareja.numJaula}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Sub-tabs */}
        <div className="flex gap-1 border-b -mx-6 px-6">
          {[
            { key: 'puestas', label: 'Puestas', icon: Egg },
            { key: 'descendientes', label: 'Descendientes', icon: Bird },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                subTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="pt-2">
          {subTab === 'puestas' && <PuestasTab pareja={pareja} parejas={parejas} />}
          {subTab === 'descendientes' && <DescendientesTab pareja={pareja} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Parejas tab ──────────────────────────────────────────────────────────────

function ParejasTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailPareja, setDetailPareja] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState('');

  const { data: parejas = [], isLoading } = useQuery({
    queryKey: ['parejas'],
    queryFn: () => getParejas(),
  });

  const { data: ejemplares = [] } = useQuery({
    queryKey: ['ejemplares'],
    queryFn: () => getEjemplares(),
  });

  const machos = ejemplares.filter(e => e.sexo === 'macho');
  const hembras = ejemplares.filter(e => e.sexo === 'hembra');

  const saveMutation = useMutation({
    mutationFn: (data) => editing?._id ? updatePareja(editing._id, data) : createPareja(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parejas'] });
      setModalOpen(false);
      setEditing(null);
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePareja,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parejas'] });
      setDeleteId(null);
    },
  });

  const openNew = () => { setEditing(null); setModalOpen(true); setError(''); };
  const openEdit = (p, e) => {
    e.stopPropagation();
    setEditing({
      ...p,
      machoId: p.machoId?._id || p.machoId || '',
      hembraId: p.hembraId?._id || p.hembraId || '',
    });
    setModalOpen(true);
    setError('');
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={openNew} disabled={machos.length === 0 || hembras.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Nueva Pareja
        </Button>
      </div>

      {(machos.length === 0 || hembras.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Necesitás al menos un macho y una hembra registrados para armar parejas.
        </p>
      )}

      {parejas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <Heart className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No tenés parejas registradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {parejas.map(p => {
            const macho = p.machoId;
            const hembra = p.hembraId;
            return (
              <Card
                key={p._id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => setDetailPareja(p)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">♂ {macho?.numAnillo || '—'}</span>
                      <span className="text-muted-foreground">×</span>
                      <span className="font-semibold text-sm">♀ {hembra?.numAnillo || '—'}</span>
                      {p.numJaula && <Badge variant="outline" className="text-xs">Jaula: {p.numJaula}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {macho?.nombreNomenclador}
                      {p.fechaEmparejamiento && (
                        <span className="ml-2">· Emparej: {format(new Date(p.fechaEmparejamiento), 'dd/MM/yyyy', { locale: es })}</span>
                      )}
                    </p>
                    {p.comentarios && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.comentarios}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={(e) => openEdit(p, e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="text-red-500"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(p._id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ParejaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        initial={editing}
        loading={saveMutation.isPending}
        onSave={(data) => saveMutation.mutate(data)}
        machos={machos}
        hembras={hembras}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="¿Eliminar pareja?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />

      <ParejaDetailDialog
        open={!!detailPareja}
        onClose={() => setDetailPareja(null)}
        pareja={detailPareja}
        parejas={parejas}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MiCriaderoPage() {
  const [tab, setTab] = useState('ejemplares');

  return (
    <div className="space-y-4">
      <PageHeader title="Mi Criadero" backTo="/dashboard" />

      {/* Tab selector */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'ejemplares', label: 'Ejemplares', icon: Bird },
          { key: 'parejas', label: 'Parejas', icon: Heart },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="pt-1">
        {tab === 'ejemplares' && <EjemplaresTab />}
        {tab === 'parejas' && <ParejasTab />}
      </div>
    </div>
  );
}
