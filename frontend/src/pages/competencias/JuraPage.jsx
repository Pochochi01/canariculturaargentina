import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJuraData, guardarPuntaje, actualizarEstadoLote } from '@/api/mesa.api';
import { getPremios } from '@/api/premio.api';
import { getAsignaciones, upsertAsignacion } from '@/api/asignacionJuez.api';
import { getJueces } from '@/api/juez.api';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, CheckCircle, AlertTriangle, Pencil, X, Search, Users, ChevronDown, Trophy } from 'lucide-react';

const PREMIO_NINGUNO       = '__none__';
const PREMIO_DESCALIFICADO = 'Descalificado';

const ESTADO_COLORS = {
  abierto: 'bg-green-100 text-green-800 border-green-300',
  cerrado: 'bg-amber-100 text-amber-800 border-amber-300',
  jurado:  'bg-blue-100  text-blue-800  border-blue-300'
};

const ESTADO_DOT = {
  abierto: 'bg-green-500',
  cerrado: 'bg-amber-500',
  jurado:  'bg-blue-500'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUnidades(items, tipoPresentacion) {
  if (tipoPresentacion === 'individual') {
    return items.map(item => ({ esGrupo: false, grupoKey: item._id, items: [item] }));
  }
  const sinSuplentes = items.filter(i => !i.esSuplente);
  const grupoMap = new Map();
  for (const item of sinSuplentes) {
    const key = item.grupoPresentacion || String(item._id);
    if (!grupoMap.has(key)) grupoMap.set(key, []);
    grupoMap.get(key).push(item);
  }
  return [...grupoMap.values()]
    .sort((a, b) => (a[0].numJaula ?? 0) - (b[0].numJaula ?? 0))
    .map(g => ({ esGrupo: true, grupoKey: g[0].grupoPresentacion || String(g[0]._id), items: g }));
}

const TIPO_PRES_MAP = {
  INDIVIDUAL: 'individual', INDIVIDUALES: 'individual',
  DUOS: 'duos', CUARTETOS: 'cuartetos', TODOS: 'todos'
};

const parseLoteKey = (key = '') => {
  const dashIdx = key.lastIndexOf(' - ');
  if (dashIdx < 0) return { codigo: key.trim(), tipo: 'individual' };
  return {
    codigo: key.slice(0, dashIdx).trim(),
    tipo: TIPO_PRES_MAP[key.slice(dashIdx + 3).trim()] || 'individual'
  };
};

const normJ = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const matchJ = (texto, q) => !q.trim() || normJ(texto).includes(normJ(q.trim()));

// ─── Dropdown de lotes con búsqueda ──────────────────────────────────────────

function LoteCombobox({ lotes, estadoLotes, nombrePorLoteKey, loteActual, onSelect, esOperador }) {
  const [open, setOpen]   = useState(false);
  const [busq, setBusq]   = useState('');
  const inputRef          = useRef(null);
  const containerRef      = useRef(null);

  const filtrados = useMemo(() => {
    if (!busq.trim()) return lotes;
    const q = normJ(busq);
    return lotes.filter(([loteKey]) => {
      const nombre = nombrePorLoteKey.get(loteKey) || '';
      return normJ(`${loteKey} ${nombre}`).includes(q);
    });
  }, [lotes, busq, nombrePorLoteKey]);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setBusq('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Enfocar el input al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleSelect = (loteKey) => {
    onSelect(loteKey);
    setOpen(false);
    setBusq('');
  };

  const nombre = loteActual ? (nombrePorLoteKey.get(loteActual) || '') : '';
  const est    = loteActual ? (estadoLotes[loteActual] || 'abierto') : null;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 transition-colors text-left shadow-sm"
      >
        {est && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ESTADO_DOT[est]}`} />}
        <span className="flex-1 truncate text-sm">
          {loteActual
            ? <><span className="font-mono font-bold">{loteActual}</span>
                {nombre && <span className="text-slate-500 ml-2">{nombre}</span>}</>
            : <span className="text-slate-400">Seleccionar lote...</span>
          }
        </span>
        {est && (
          <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${ESTADO_COLORS[est]}`}>
            {est}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-72 flex flex-col">
          {/* Búsqueda */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                value={busq}
                onChange={e => setBusq(e.target.value)}
                placeholder="Buscar por código o descripción..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {filtrados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
            ) : (
              filtrados.map(([loteKey]) => {
                const lest      = estadoLotes[loteKey] || 'abierto';
                const disabled  = esOperador && lest !== 'abierto';
                const isActivo  = loteKey === loteActual;
                const lnombre   = nombrePorLoteKey.get(loteKey) || '';
                return (
                  <button
                    key={loteKey}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && handleSelect(loteKey)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors
                      ${isActivo ? 'bg-slate-100' : 'hover:bg-slate-50'}
                      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      border-b last:border-0`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${ESTADO_DOT[lest]}`} />
                    <span className="font-mono font-semibold text-xs shrink-0 w-24 truncate">{loteKey}</span>
                    {lnombre && (
                      <span className="flex-1 text-slate-500 truncate text-xs text-left">{lnombre}</span>
                    )}
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded border capitalize shrink-0 ${ESTADO_COLORS[lest]}`}>
                      {lest}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal de asignación de jueces por lote ──────────────────────────────────

function JuecesLoteModal({ open, onClose, loteKey, competenciaId, jueces, asignacion, onSave, saving }) {
  const nombreLote = loteKey ? loteKey.split(' - ')[0] : '';
  const tipoLote   = loteKey ? loteKey.split(' - ')[1] : '';

  const [seleccionados, setSeleccionados] = useState(() =>
    (asignacion?.juecesIds || []).map(j => j._id || j)
  );
  const [busq, setBusq] = useState('');

  const filtrados = busq.trim()
    ? jueces.filter(j => matchJ(`${j.codigo} ${j.apellido} ${j.nombre}`, busq))
    : jueces;

  const toggle = (id) =>
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = () => {
    const { codigo, tipo } = parseLoteKey(loteKey);
    onSave({ competenciaId, codigoNomenclador: codigo, tipoPresentacion: tipo, juecesIds: seleccionados });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Jueces del lote
            <span className="ml-2 font-mono text-primary">{nombreLote}</span>
            {tipoLote && <span className="ml-1 text-slate-500 font-normal text-sm">— {tipoLote}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {seleccionados.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {seleccionados.map(id => {
                const j = jueces.find(x => x._id === id);
                if (!j) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                    {j.codigo} — {j.apellido}, {j.nombre}
                    <button type="button" onClick={() => toggle(id)} className="hover:text-blue-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input className="pl-8 h-8 text-sm" placeholder="Buscar juez..."
              value={busq} onChange={e => setBusq(e.target.value)} />
          </div>

          <div className="border rounded-md max-h-52 overflow-y-auto bg-white">
            {filtrados.length === 0
              ? <p className="text-xs text-muted-foreground px-3 py-3 text-center">Sin resultados</p>
              : filtrados.map(j => {
                  const sel = seleccionados.includes(j._id);
                  return (
                    <label key={j._id}
                      className={`flex items-center gap-3 px-3 py-2 text-sm border-b last:border-0 cursor-pointer select-none ${sel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={sel} className="h-4 w-4 accent-blue-600 shrink-0"
                        onChange={() => toggle(j._id)} />
                      <span className="font-mono text-xs w-12 shrink-0 text-slate-500">{j.codigo}</span>
                      <span className="flex-1 truncate">{j.apellido}, {j.nombre}</span>
                      {j.tipoJuez && <span className="text-xs text-slate-400 shrink-0">{j.tipoJuez}</span>}
                    </label>
                  );
                })}
          </div>

          <p className="text-xs text-muted-foreground">
            {seleccionados.length === 0 ? 'Sin jueces asignados a este lote.' : `${seleccionados.length} juez/ces seleccionado/s`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar asignación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Panel de canarios premiados ─────────────────────────────────────────────

function PremiadosPanel({ unidades, premios, puntajes, premiosOpciones }) {
  // Orden: todo excepto Descalificado primero, Descalificado al final
  const premiosOrden = useMemo(() => {
    const sinDesc = premiosOpciones.filter(p => p !== PREMIO_DESCALIFICADO);
    return [...sinDesc, PREMIO_DESCALIFICADO];
  }, [premiosOpciones]);

  const premiados = useMemo(() => {
    const result = [];
    for (const unidad of unidades) {
      const premioVal = premios.get(unidad.grupoKey);
      if (!premioVal || premioVal === PREMIO_NINGUNO) continue;
      result.push({ unidad, premioVal });
    }
    result.sort((a, b) => {
      const ra = premiosOrden.indexOf(a.premioVal);
      const rb = premiosOrden.indexOf(b.premioVal);
      return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
    });
    return result;
  }, [unidades, premios, premiosOrden]);

  const badgeClass = (p) => {
    if (p === PREMIO_DESCALIFICADO)    return 'bg-red-100 text-red-700 border-red-300';
    if (p === 'GCA')                   return 'bg-yellow-200 text-yellow-900 border-yellow-400';
    if (p === 'CA')                    return 'bg-amber-100 text-amber-800 border-amber-300';
    if (p === 'RC')                    return 'bg-orange-100 text-orange-700 border-orange-300';
    return 'bg-blue-100 text-blue-700 border-blue-300';
  };

  return (
    <div className="flex flex-col border-l bg-white min-w-0 w-52 shrink-0">
      {/* Encabezado */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border-b">
        <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
          Premiados
        </span>
        <span className="ml-auto text-xs bg-amber-200 text-amber-800 rounded-full px-1.5 py-0.5 font-bold">
          {premiados.length}
        </span>
      </div>

      {/* Lista */}
      <div className="overflow-y-auto flex-1">
        {premiados.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-2">
            Sin premiados aún
          </p>
        ) : (
          <div className="divide-y">
            {premiados.map(({ unidad, premioVal }) => (
              <div key={unidad.grupoKey} className="px-2.5 py-2">
                {/* Premio badge */}
                <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded border mb-1 ${badgeClass(premioVal)}`}>
                  {premioVal}
                </span>
                {/* Aves del grupo */}
                <div className="space-y-0.5">
                  {unidad.items.map(item => {
                    const pts = puntajes?.get(item._id);
                    return (
                      <div key={item._id} className="text-xs space-y-0">
                        <div className="font-bold text-slate-800">
                          {item.numJaula ?? '?'} <span className="font-normal text-slate-500">Jaula</span>
                        </div>
                        {pts !== '' && pts != null && (
                          <div className="font-bold text-slate-800">
                            {pts} <span className="font-normal text-slate-500">Puntos</span>
                          </div>
                        )}
                        <div className="font-mono text-slate-500 truncate">
                          {item.numAnillo} <span className="not-italic text-slate-400">Anillo</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Contenido del lote seleccionado ─────────────────────────────────────────

function LoteContenido({ loteKey, nombreNomenclador, items, estado, onEstadoChange, onSave, userRole, premiosOpciones }) {
  const tipoPresentacion = items[0]?.tipoPresentacion || 'individual';
  const unidades = useMemo(
    () => buildUnidades(items, tipoPresentacion),
    [items, tipoPresentacion]
  );
  const bloqueado = estado === 'cerrado' || estado === 'jurado';

  const [puntajes, setPuntajes] = useState(() => {
    const m = new Map();
    for (const item of items) m.set(item._id, String(item.puntaje ?? ''));
    return m;
  });

  const [errores, setErrores] = useState(new Map());

  const [premios, setPremios] = useState(() => {
    const m = new Map();
    for (const unidad of buildUnidades(items, tipoPresentacion)) {
      const premioGuardado = unidad.items[0]?.premios?.[0]?.tipo || PREMIO_NINGUNO;
      m.set(unidad.grupoKey, premioGuardado);
    }
    return m;
  });

  const [saving, setSaving]               = useState(false);
  const [guardado, setGuardado]           = useState(false);
  const [alertaCoherencia, setAlertaCoherencia] = useState('');

  const handlePuntajeChange = (itemId, val) => {
    setPuntajes(prev => new Map(prev).set(itemId, val));
    const num = Number(val);
    if (val !== '' && (num < 0 || num > 100)) {
      setErrores(prev => new Map(prev).set(itemId, '0–100'));
    } else {
      setErrores(prev => { const m = new Map(prev); m.delete(itemId); return m; });
    }
  };

  const handlePremioChange = (grupoKey, val) => {
    setPremios(prev => new Map(prev).set(grupoKey, val));
  };

  const getPremiosOcupados = (grupoKey) => {
    const ocupados = new Set();
    for (const [key, val] of premios.entries()) {
      if (key !== grupoKey && val && val !== PREMIO_NINGUNO) ocupados.add(val);
    }
    return ocupados;
  };

  const tieneErrores = [...errores.values()].some(Boolean);

  const handleGuardar = async () => {
    if (tieneErrores) return;

    const rankMap = new Map(premiosOpciones.map((p, i) => [p, i]));
    const unidadesConPremio = unidades
      .map(u => {
        const premioVal = premios.get(u.grupoKey);
        if (!premioVal || premioVal === PREMIO_NINGUNO || premioVal === PREMIO_DESCALIFICADO) return null;
        const rank = rankMap.get(premioVal) ?? 999;
        const puntajesUnidad = u.items
          .map(item => puntajes.get(item._id))
          .filter(v => v !== '' && v != null)
          .map(Number);
        const avg = puntajesUnidad.length
          ? puntajesUnidad.reduce((a, b) => a + b, 0) / puntajesUnidad.length
          : null;
        return { premioVal, rank, avg };
      })
      .filter(Boolean);

    let alerta = '';
    for (let i = 0; i < unidadesConPremio.length; i++) {
      for (let j = i + 1; j < unidadesConPremio.length; j++) {
        const a = unidadesConPremio[i];
        const b = unidadesConPremio[j];
        if (a.avg == null || b.avg == null) continue;
        if (a.rank < b.rank && a.avg < b.avg) { alerta = `${a.premioVal} tiene puntaje promedio menor que ${b.premioVal}`; break; }
        if (b.rank < a.rank && b.avg < a.avg) { alerta = `${b.premioVal} tiene puntaje promedio menor que ${a.premioVal}`; break; }
      }
      if (alerta) break;
    }
    setAlertaCoherencia(alerta);

    setSaving(true);
    try {
      const payloads = [];
      for (const unidad of unidades) {
        const premioVal = premios.get(unidad.grupoKey) ?? PREMIO_NINGUNO;
        const premiosArr = (premioVal && premioVal !== PREMIO_NINGUNO)
          ? [{ tipo: premioVal, descripcion: premioVal }]
          : [];
        for (const item of unidad.items) {
          const puntajeStr = puntajes.get(item._id) ?? '';
          payloads.push({
            inscripcionId: item._id,
            puntaje: puntajeStr !== '' ? Number(puntajeStr) : null,
            premios: premiosArr
          });
        }
      }
      await Promise.all(payloads.map(p => onSave(p)));
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const esAdminLote = userRole === 'admin_general' || userRole === 'admin_sociedad';
  const puedeActivar = (nuevoEstado) => {
    if (esAdminLote) {
      if (estado === 'cerrado' && nuevoEstado === 'jurado')  return false;
      if (estado === 'jurado'  && nuevoEstado === 'cerrado') return false;
      return true;
    }
    if (estado === 'jurado') return false;
    return estado === 'abierto' && (nuevoEstado === 'cerrado' || nuevoEstado === 'jurado');
  };

  const colSpan = 4;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Barra de estado */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {(() => {
            const dashIdx = loteKey.indexOf(' - ');
            const loteCode = dashIdx >= 0 ? loteKey.slice(0, dashIdx) : loteKey;
            const loteTipo = dashIdx >= 0 ? loteKey.slice(dashIdx + 3) : '';
            return (
              <span className="font-bold font-mono text-sm">
                {loteCode}
                {nombreNomenclador && <span className="font-normal text-slate-300"> - {nombreNomenclador}</span>}
                {loteTipo && <span className="text-slate-400"> - {loteTipo}</span>}
              </span>
            );
          })()}
          <span className="text-slate-400 text-sm shrink-0">· {items.length} jaulas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Estado:</span>
          <div className="flex gap-1">
            {['abierto', 'cerrado', 'jurado'].map(est => (
              <button
                key={est}
                onClick={() => puedeActivar(est) && onEstadoChange(loteKey, est)}
                disabled={!puedeActivar(est)}
                className={`text-xs px-2 py-1 rounded border capitalize transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  estado === est
                    ? ESTADO_COLORS[est]
                    : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                }`}
              >
                {est}
              </button>
            ))}
          </div>
        </div>
      </div>

      {bloqueado && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-700">
          Este lote está <strong>{estado}</strong> — no se pueden modificar puntajes.
        </div>
      )}

      {/* Cuerpo: tabla + panel premiados */}
      <div className="flex min-h-0">
        {/* Tabla principal (más angosta) */}
        <div className="flex-1 overflow-x-auto min-w-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2 text-center w-12">Jaula</th>
                <th className="px-2 py-2 text-left">N° Anillo</th>
                <th className="pl-2 pr-0 py-2 text-center w-24 bg-slate-200">PUNTAJE</th>
                <th className="pl-1.5 pr-2 py-2 text-left w-24 bg-slate-200">PREMIO</th>
              </tr>
            </thead>
            <tbody>
              {unidades.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                    Sin ejemplares en este lote
                  </td>
                </tr>
              ) : (
                unidades.map((unidad, gi) => {
                  const premioVal = premios.get(unidad.grupoKey) ?? PREMIO_NINGUNO;
                  const ocupados  = getPremiosOcupados(unidad.grupoKey);

                  return (
                    <Fragment key={unidad.grupoKey}>
                      {unidad.items.map((item, idx) => {
                        const puntajeVal    = puntajes.get(item._id) ?? '';
                        const error         = errores.get(item._id) || '';
                        const mostrarPremio = !unidad.esGrupo || idx === 0;
                        const esUltimaDelGrupo  = idx === unidad.items.length - 1;
                        const esInternaDelGrupo = unidad.esGrupo && !esUltimaDelGrupo;

                        return (
                          <tr
                            key={item._id}
                            className={`hover:bg-blue-50 ${
                              esInternaDelGrupo
                                ? 'border-b border-dashed border-slate-200 bg-slate-50/60'
                                : 'border-b border-slate-300 bg-white'
                            }`}
                          >
                            {/* Jaula */}
                            <td className="px-1.5 py-1.5 text-center w-12">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-800 text-white font-bold text-sm">
                                {item.numJaula ?? '-'}
                              </span>
                            </td>

                            {/* Anillo */}
                            <td className="px-2 py-1.5 font-mono text-xs">{item.numAnillo}</td>

                            {/* Puntaje */}
                            <td className="pl-1.5 pr-0 py-1.5 w-24">
                              <div className="flex flex-col">
                                <Input
                                  type="number" min="0" max="100"
                                  className={`h-7 text-center font-bold text-sm ${error ? 'border-red-400' : ''}`}
                                  value={puntajeVal}
                                  onChange={e => handlePuntajeChange(item._id, e.target.value)}
                                  placeholder="0-100"
                                  disabled={bloqueado}
                                />
                                {error && (
                                  <span className="text-red-500 text-xs text-center">{error}</span>
                                )}
                              </div>
                            </td>

                            {/* Premio */}
                            {mostrarPremio && (
                              <td
                                className="pl-1.5 pr-1.5 py-1.5 w-24 align-middle"
                                rowSpan={unidad.esGrupo ? unidad.items.length : 1}
                              >
                                <Select
                                  value={premioVal}
                                  onValueChange={val => handlePremioChange(unidad.grupoKey, val)}
                                  disabled={bloqueado}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Premio..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={PREMIO_NINGUNO}>(ninguno)</SelectItem>
                                    {premiosOpciones.map(p => {
                                      const ocu = ocupados.has(p);
                                      return (
                                        <SelectItem key={p} value={p} disabled={ocu}>
                                          {p}{ocu ? ' — asignado' : ''}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {unidad.esGrupo && gi < unidades.length - 1 && (
                        <>
                          <tr className="h-1.5 bg-white"><td colSpan={colSpan} /></tr>
                          <tr className="h-1.5 bg-white"><td colSpan={colSpan} /></tr>
                        </>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Panel de premiados */}
        <PremiadosPanel
          unidades={unidades}
          premios={premios}
          puntajes={puntajes}
          premiosOpciones={premiosOpciones}
        />
      </div>

      {/* Alerta de coherencia */}
      {alertaCoherencia && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Advertencia: {alertaCoherencia}</span>
        </div>
      )}

      {/* Botón guardar */}
      {!bloqueado && (
        <div className="px-4 py-3 border-t bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {tieneErrores ? (
              <span className="text-red-500">Hay puntajes fuera de rango (0–100)</span>
            ) : (
              `${unidades.length} ${unidades.length === 1 ? 'registro' : 'registros'} para guardar`
            )}
          </span>
          <Button
            onClick={handleGuardar}
            disabled={saving || tieneErrores}
            variant={guardado ? 'secondary' : 'default'}
            className="min-w-28"
          >
            {saving   ? <Loader2     className="h-4 w-4 animate-spin mr-2" /> :
             guardado ? <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> :
                        <Save        className="h-4 w-4 mr-2" />}
            {guardado ? 'Guardado' : 'Guardar lote'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function JuraPage() {
  const { mesaId } = useParams();
  const { user }   = useAuth();
  const queryClient = useQueryClient();
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [modalJuez, setModalJuez]               = useState({ open: false, loteKey: '' });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['jura', mesaId],
    queryFn: () => getJuraData(mesaId),
    retry: 1
  });

  const competenciaId = data?.mesa?.competenciaId?._id;

  const { data: premiosData = [] } = useQuery({
    queryKey: ['premios'],
    queryFn: getPremios
  });

  const { data: asignaciones = [] } = useQuery({
    queryKey: ['asignaciones-juez', competenciaId],
    queryFn: () => getAsignaciones(competenciaId),
    enabled: !!competenciaId
  });

  const { data: jueces = [] } = useQuery({
    queryKey: ['jueces'],
    queryFn: getJueces
  });

  const asignacionMap = useMemo(() => {
    const m = new Map();
    for (const a of asignaciones) {
      m.set(`${a.codigoNomenclador}|${a.tipoPresentacion}`, a);
    }
    return m;
  }, [asignaciones]);

  const premiosOpciones = [PREMIO_DESCALIFICADO, ...premiosData.map(p => p.tipo)];

  const saveMutation = useMutation({
    mutationFn: (payload) => guardarPuntaje(mesaId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jura', mesaId] })
  });

  const estadoMutation = useMutation({
    mutationFn: (payload) => actualizarEstadoLote(mesaId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jura', mesaId] })
  });

  const upsertMutation = useMutation({
    mutationFn: upsertAsignacion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones-juez', competenciaId] });
      setModalJuez({ open: false, loteKey: '' });
    }
  });

  const mesa          = data?.mesa ?? null;
  const inscripciones = data?.inscripciones ?? [];
  const estadoLotes   = mesa?.estadoLotes || {};

  const nombrePorLoteKey = useMemo(() => {
    const m = new Map();
    for (const l of (mesa?.lotes || [])) {
      const key = `${l.codigoNomenclador} - ${(l.tipoPresentacion || 'todos').toUpperCase()}`;
      m.set(key, l.nombreNomenclador || '');
    }
    return m;
  }, [mesa]);

  const loteMap = useMemo(() => {
    const m = new Map();
    for (const insc of inscripciones) {
      const key = `${insc.lote || insc.codigoNomenclador} - ${(insc.tipoPresentacion || 'individual').toUpperCase()}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(insc);
    }
    return m;
  }, [inscripciones]);

  const lotesAgrupados = useMemo(
    () => [...loteMap.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [loteMap]
  );

  // Para operadores: auto-seleccionar el primer lote en estado 'abierto'
  const esOperador = user?.role === 'operador';
  const primerLoteAbierto = useMemo(() => {
    for (const [loteKey] of lotesAgrupados) {
      if ((estadoLotes[loteKey] || 'abierto') === 'abierto') return loteKey;
    }
    // Si no hay ninguno abierto, seleccionar el primero disponible
    return lotesAgrupados[0]?.[0] || null;
  }, [lotesAgrupados, estadoLotes]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (isError) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 text-center p-6">
      <p className="text-lg font-semibold text-slate-700">No se pudo cargar la pantalla de jura</p>
      <p className="text-sm text-muted-foreground">
        {error?.response?.data?.error || error?.message || 'Error desconocido'}
      </p>
      <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
        Volver al inicio
      </Button>
    </div>
  );

  const loteActual      = loteSeleccionado ?? primerLoteAbierto;
  const itemsLoteActual = loteActual ? (loteMap.get(loteActual) || []) : [];
  const estadoLoteActual = estadoLotes[loteActual] || 'abierto';

  const { codigo: loteCodigoActual, tipo: loteTipoActual } = parseLoteKey(loteActual || '');
  const asignacionActual  = asignacionMap.get(`${loteCodigoActual}|${loteTipoActual}`);
  const juecesLoteActual  = asignacionActual?.juecesIds || [];

  const handleEstadoChange = (loteKey, nuevoEstado) => {
    estadoMutation.mutate({ loteKey, estado: nuevoEstado });
  };

  const esAdmin = user?.role === 'admin_general' || user?.role === 'admin_sociedad';
  const backTo  = esAdmin
    ? `/competencias/${mesa?.competenciaId?._id}/mesas`
    : '/dashboard';

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title={`Mesa N° ${mesa?.numero} — Pantalla de Jura`}
        description={`Competencia: ${mesa?.competenciaId?.nombre || ''}`}
        backTo={backTo}
      />

      {/* Info de mesa */}
      <div className="flex gap-3 flex-wrap text-sm items-center">
        <button
          type="button"
          onClick={() => loteActual && setModalJuez({ open: true, loteKey: loteActual })}
          disabled={!loteActual}
          className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-1.5 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clic para asignar jueces a este lote"
        >
          <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="text-blue-600 font-medium">
            {juecesLoteActual.length === 0 ? 'Sin juez asignado' : juecesLoteActual.length === 1 ? 'Juez:' : 'Jueces:'}
          </span>
          {juecesLoteActual.map((j, i) => (
            <span key={j._id || i} className="text-blue-800">
              {i > 0 && <span className="text-blue-400 mx-1">/</span>}
              {j.apellido}, {j.nombre}
            </span>
          ))}
          <Pencil className="h-3 w-3 text-blue-400 shrink-0 ml-1" />
        </button>

        {mesa?.operadorId && (
          <div className="bg-slate-50 border rounded px-3 py-1.5">
            <span className="text-slate-600 font-medium">Operador: </span>
            {mesa.operadorId.dni}
          </div>
        )}
        <Badge variant="outline">{inscripciones.length} ejemplares</Badge>
        <Badge variant="outline">{lotesAgrupados.length} lotes</Badge>
      </div>

      {/* Dropdown de selección de lote */}
      {lotesAgrupados.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600 shrink-0">Lote activo:</span>
          <LoteCombobox
            lotes={lotesAgrupados}
            estadoLotes={estadoLotes}
            nombrePorLoteKey={nombrePorLoteKey}
            loteActual={loteActual}
            onSelect={setLoteSeleccionado}
            esOperador={esOperador}
          />
        </div>
      )}

      {/* Contenido del lote seleccionado */}
      {loteActual ? (
        <LoteContenido
          key={loteActual}
          loteKey={loteActual}
          nombreNomenclador={nombrePorLoteKey.get(loteActual) || ''}
          items={itemsLoteActual}
          estado={estadoLoteActual}
          onEstadoChange={handleEstadoChange}
          onSave={saveMutation.mutateAsync}
          userRole={user?.role}
          premiosOpciones={premiosOpciones}
        />
      ) : (
        <div className="text-center py-16 text-muted-foreground border rounded-lg bg-white">
          No hay ejemplares asignados a esta mesa
        </div>
      )}

      {/* Modal asignación de jueces por lote */}
      {modalJuez.open && (
        <JuecesLoteModal
          open={modalJuez.open}
          onClose={() => setModalJuez({ open: false, loteKey: '' })}
          loteKey={modalJuez.loteKey}
          competenciaId={competenciaId}
          jueces={jueces}
          asignacion={(() => {
            const { codigo, tipo } = parseLoteKey(modalJuez.loteKey);
            return asignacionMap.get(`${codigo}|${tipo}`) || null;
          })()}
          onSave={upsertMutation.mutate}
          saving={upsertMutation.isPending}
        />
      )}
    </div>
  );
}
