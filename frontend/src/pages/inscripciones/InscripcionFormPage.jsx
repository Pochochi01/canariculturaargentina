import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createInscripcion, buscarSocio, verificarAnillos, getInscripciones, updateInscripcion, deleteInscripcion, deleteGrupoPresentacion } from '@/api/inscripcion.api';
import { getCompetencia } from '@/api/competencia.api';
import { getColores, getFormas } from '@/api/nomenclador.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, CheckCircle, AlertCircle, AlertTriangle, X, Pencil, Trash2, Save, Ban } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const FORM_INICIAL = {
  tipoNomenclador: 'color',
  codigoNomenclador: '',
  tipoPresentacion: 'individual',
  numAnillo: '0000',
  anillosAdicionales: [],
  anioAnillo: '',
  observaciones: ''
};

const padAnillo = (valor) => {
  const limpio = String(valor).trim().toUpperCase().slice(0, 4);
  return limpio.padStart(4, '0');
};

// AND search: all space-separated words must match
const normStr = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const matchAND = (texto, query) => {
  if (!query.trim()) return true;
  const h = normStr(texto);
  return query.trim().split(/\s+/).every(p => h.includes(normStr(p)));
};

// ── Anillos adicionales para duos y cuartetos ─────────────────────────────────
function AnillosEditor({ tipo, anillos, onChange, errores = {}, anilloRefs, anillosInscritos = new Set(), onVerificar }) {
  const requeridos = tipo === 'duos' ? 1 : 3;
  const tieneSuplente = tipo === 'cuartetos';

  const anillosReq = anillos.filter(a => !a.esSuplente);
  const suplente = anillos.find(a => a.esSuplente);

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-slate-50">
      <p className="text-sm font-medium text-slate-700">
        Anillos adicionales
        <span className="text-muted-foreground font-normal ml-1">
          ({tipo === 'duos' ? '1 requerido' : '3 requeridos + 1 suplente opcional'})
        </span>
      </p>
      {Array.from({ length: requeridos }).map((_, i) => {
        const idx = i + 1; // index 0 = anillo principal, 1..3 = adicionales
        const hasError = !!errores[idx];
        const numAnilloActual = padAnillo(anillosReq[i]?.numAnillo || '0000');
        const yaInscrito = anillosInscritos.has(numAnilloActual);
        return (
          <div key={i} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-6">{i + 2}.</span>
              <Input
                ref={el => { if (anilloRefs) anilloRefs.current[idx] = el; }}
                placeholder="0000"
                value={anillosReq[i]?.numAnillo || '0000'}
                maxLength={4}
                onChange={e => {
                  const next = [...anillos.filter(a => !a.esSuplente)];
                  next[i] = { numAnillo: e.target.value.slice(0, 4), esSuplente: false };
                  onChange([...next, ...(suplente ? [suplente] : [])]);
                }}
                onBlur={e => {
                  const padded = padAnillo(e.target.value);
                  const next = [...anillos.filter(a => !a.esSuplente)];
                  next[i] = { numAnillo: padded, esSuplente: false };
                  onChange([...next, ...(suplente ? [suplente] : [])]);
                  onVerificar?.(padded);
                }}
                className={`h-8 font-mono w-24 ${hasError ? 'border-red-500 focus-visible:ring-red-400' : yaInscrito ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
              />
              {yaInscrito && (
                <span className="flex items-center gap-1 text-amber-700 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Ya inscripto
                </span>
              )}
            </div>
            {hasError && (
              <p className="text-xs text-red-600 ml-8">Anillo repetido</p>
            )}
          </div>
        );
      })}
      {tieneSuplente && (
        <div className="flex items-center gap-2 border-t pt-2 mt-1">
          <span className="text-xs text-slate-500 w-6">S.</span>
          <Input
            placeholder="0000"
            value={suplente?.numAnillo || ''}
            maxLength={4}
            onChange={e => {
              const req = anillos.filter(a => !a.esSuplente);
              const val = e.target.value.slice(0, 4);
              onChange(val ? [...req, { numAnillo: val, esSuplente: true }] : req);
            }}
            onBlur={e => {
              if (!e.target.value.trim()) return;
              const req = anillos.filter(a => !a.esSuplente);
              const padded = padAnillo(e.target.value);
              onChange([...req, { numAnillo: padded, esSuplente: true }]);
            }}
            className="h-8 font-mono w-24"
          />
          <Badge variant="secondary" className="text-xs shrink-0">Suplente</Badge>
        </div>
      )}
    </div>
  );
}

export default function InscripcionFormPage() {
  const { competenciaId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const qc = queryClient;

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);

  const [form, setForm] = useState(FORM_INICIAL);
  const [busquedaNomen, setBusquedaNomen] = useState('');

  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  const [duplicados, setDuplicados] = useState({}); // { ringIndex: true } — duplicados dentro del mismo grupo

  // Anillos ya inscriptos en esta competencia por el mismo socio
  const [anillosInscritos, setAnillosInscritos] = useState(new Set());

  // refs para los inputs de anillo (índice 0 = principal, 1..N = adicionales)
  const mainAnilloRef = useRef(null);
  const anilloRefs = useRef({});

  // ── Estado para grilla de inscripciones del socio ────────────────────────
  const [editingId,    setEditingId]    = useState(null);   // inscripción en edición
  const [editingAnillo, setEditingAnillo] = useState('');   // valor del input de edición
  const [deleteDialog, setDeleteDialog] = useState(null);   // { inscripcion } para el diálogo de grupo

  const { data: competencia } = useQuery({
    queryKey: ['competencia', competenciaId],
    queryFn: () => getCompetencia(competenciaId)
  });

  // Para nacionales: código de federación organizadora (viene populado desde el backend)
  const esNacional    = competencia?.tipoCompetencia === 'nacional';
  const fedOrganizadora = competencia?.federacionId?.codigo?.trim().toUpperCase() || null;

  // Validación de federación: solo aplica en nacionales
  const socioFederacionValida = !esNacional || !socioSeleccionado || (() => {
    const fedSocio = socioSeleccionado.sociedadId?.federacion?.trim().toUpperCase() || '';
    return !!fedOrganizadora && fedSocio === fedOrganizadora;
  })();

  const { data: colores = [] } = useQuery({ queryKey: ['nomencladores', 'colores'], queryFn: getColores });
  const { data: formas  = [] } = useQuery({ queryKey: ['nomencladores', 'formas'],  queryFn: getFormas });

  // Inscripciones del socio seleccionado en esta competencia
  const inscKeyBase = ['inscripciones-socio', competenciaId, socioSeleccionado?.anilloCriador];
  const { data: inscSocio = [], refetch: refetchInsc } = useQuery({
    queryKey: inscKeyBase,
    queryFn: () => getInscripciones({ competenciaId, numCriador: socioSeleccionado.anilloCriador }),
    enabled: !!socioSeleccionado,
    select: data => Array.isArray(data) ? data : (data?.inscripciones ?? [])
  });

  const updateAnilloMut = useMutation({
    mutationFn: ({ id, numAnillo }) => updateInscripcion(id, { numAnillo: padAnillo(numAnillo) }),
    onSuccess: () => { refetchInsc(); setEditingId(null); qc.invalidateQueries({ queryKey: ['inscripciones'] }); }
  });

  const deleteInscMut = useMutation({
    mutationFn: deleteInscripcion,
    onSuccess: () => { refetchInsc(); qc.invalidateQueries({ queryKey: ['inscripciones'] }); }
  });

  const deleteGrupoMut = useMutation({
    mutationFn: (grupoPresentacion) => deleteGrupoPresentacion(grupoPresentacion, competenciaId),
    onSuccess: () => { refetchInsc(); setDeleteDialog(null); qc.invalidateQueries({ queryKey: ['inscripciones'] }); }
  });

  const nomencladores = form.tipoNomenclador === 'color' ? colores : formas;
  // Filtro AND por código o nombre
  const nomencladoresFiltrados = busquedaNomen.trim()
    ? nomencladores.filter(n => matchAND(`${n.codigo} ${n.nombreLinea}`, busquedaNomen))
    : nomencladores;

  // ── Verificación de anillos en servidor ──────────────────────────────────────
  const checkAnillo = useCallback(async (numAnillo) => {
    if (!socioSeleccionado || !competenciaId) return;
    if (!numAnillo || numAnillo === '0000') return;
    try {
      const res = await verificarAnillos(competenciaId, socioSeleccionado.anilloCriador, [numAnillo]);
      if (res.duplicados?.length > 0) {
        setAnillosInscritos(prev => {
          const next = new Set(prev);
          for (const a of res.duplicados) next.add(a);
          return next;
        });
      } else {
        // Si el anillo ya no es duplicado (ej. si el usuario lo corrigió), lo quitamos
        setAnillosInscritos(prev => {
          if (!prev.has(numAnillo)) return prev;
          const next = new Set(prev);
          next.delete(numAnillo);
          return next;
        });
      }
    } catch {
      // silencioso — no bloquear el flujo
    }
  }, [socioSeleccionado, competenciaId]);

  const handleBuscar = async () => {
    if (busqueda.trim().length < 2) return;
    setBuscando(true);
    setBuscado(false);
    setSocioSeleccionado(null);
    setResultados([]);
    setAnillosInscritos(new Set());
    try {
      const res = await buscarSocio(busqueda.trim());
      setResultados(res);
      if (res.length === 1) setSocioSeleccionado(res[0]);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
      setBuscado(true);
    }
  };

  const seleccionarSocio = (socio) => {
    setSocioSeleccionado(socio);
    setBusqueda(socio.anilloCriador);
    setResultados([]);
    setAnillosInscritos(new Set());
  };

  const setTipoPresentacion = (tipo) => {
    setForm(p => ({ ...p, tipoPresentacion: tipo, anillosAdicionales: [] }));
    setDuplicados({});
    setAnillosInscritos(new Set());
  };

  const maxLabel = (campo) => {
    const v = competencia?.[campo];
    return !v || v === 'libre' ? null : Number(v);
  };

  const mutation = useMutation({
    mutationFn: (data) => createInscripcion({ ...data, competenciaId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inscripciones'] });
      queryClient.invalidateQueries({ queryKey: ['inscripciones-socio', competenciaId] });
      setResultado(data);
      setError('');
      setDuplicados({});
      setAnillosInscritos(new Set());
      // Sticky: preserve tipoNomenclador + codigoNomenclador; reset only the per-bird fields
      setForm(prev => ({
        ...FORM_INICIAL,
        tipoNomenclador: prev.tipoNomenclador,
        codigoNomenclador: prev.codigoNomenclador,
      }));
      setBusquedaNomen('');
    },
    onError: (err) => {
      const errData = err.response?.data;
      if (errData?.rechazados) {
        setResultado({ creados: [], rechazados: errData.rechazados, mensaje: errData.error });
      } else {
        setError(errData?.error || 'Error al inscribir');
      }
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    setDuplicados({});

    if (!socioSeleccionado) {
      setError('Debe seleccionar un criador de la base de datos');
      return;
    }

    // Validar anillo 0000
    const anillosReq = [
      padAnillo(form.numAnillo),
      ...form.anillosAdicionales.filter(a => !a.esSuplente).map(a => padAnillo(a.numAnillo))
    ];
    if (anillosReq.some(a => a === '0000')) {
      setError('El número de anillo 0000 no es válido');
      mainAnilloRef.current?.focus();
      return;
    }

    // Validar duplicados dentro del grupo
    if (form.tipoPresentacion !== 'individual') {
      const todosAnillos = [
        { numAnillo: padAnillo(form.numAnillo), idx: 0 },
        ...form.anillosAdicionales
          .filter(a => !a.esSuplente)
          .map((a, i) => ({ numAnillo: padAnillo(a.numAnillo), idx: i + 1 }))
      ];

      const visto = new Map();
      const dupErrors = {};
      for (const { numAnillo, idx } of todosAnillos) {
        if (visto.has(numAnillo)) {
          dupErrors[idx] = true;
          dupErrors[visto.get(numAnillo)] = true;
        } else {
          visto.set(numAnillo, idx);
        }
      }

      if (Object.keys(dupErrors).length > 0) {
        setDuplicados(dupErrors);
        setError('Hay números de anillo repetidos en el grupo.');
        const firstIdx = Math.min(...Object.keys(dupErrors).map(Number));
        if (firstIdx === 0) {
          mainAnilloRef.current?.focus();
        } else {
          anilloRefs.current[firstIdx]?.focus();
        }
        return;
      }
    }

    // Bloquear si algún anillo requerido ya está inscripto
    const anillosRequeridos = [
      padAnillo(form.numAnillo),
      ...form.anillosAdicionales.filter(a => !a.esSuplente).map(a => padAnillo(a.numAnillo))
    ];
    const hayInscritos = anillosRequeridos.some(a => anillosInscritos.has(a));
    if (hayInscritos) {
      setError('Uno o más anillos ya están inscriptos en esta competencia. Corrija antes de continuar.');
      return;
    }

    mutation.mutate({
      numCriador: socioSeleccionado.anilloCriador,
      ...form
    });
  };

  const anioEsperado = competencia?.fecha
    ? new Date(competencia.fecha).getFullYear() - 1
    : new Date().getFullYear() - 1;

  const maxInfo = {
    individual: maxLabel('maxIndividuales'),
    duos: maxLabel('maxDuos'),
    cuartetos: maxLabel('maxCuartetos')
  };

  const mainRingError    = !!duplicados[0];
  const mainRingInscrito = anillosInscritos.has(padAnillo(form.numAnillo));

  // Mapa grupoPresentacion → índice para alternar colores de grupo
  const grupoColorMap = useMemo(() => {
    const map = new Map();
    let idx = 0;
    for (const insc of inscSocio) {
      if (insc.grupoPresentacion && !map.has(insc.grupoPresentacion)) {
        map.set(insc.grupoPresentacion, idx++);
      }
    }
    return map;
  }, [inscSocio]);

  // Color de fondo por tipo y grupo (para distinguir duos/cuartetos visualmente)
  const rowBg = (insc) => {
    if (insc.tipoPresentacion === 'duos') {
      const i = grupoColorMap.get(insc.grupoPresentacion) ?? 0;
      return i % 2 === 0 ? 'bg-blue-50' : 'bg-sky-50';
    }
    if (insc.tipoPresentacion === 'cuartetos') {
      const i = grupoColorMap.get(insc.grupoPresentacion) ?? 0;
      return i % 2 === 0 ? 'bg-violet-50' : 'bg-purple-50';
    }
    return '';
  };

  return (
    <div>
      <PageHeader
        title="Nueva Inscripción"
        description={`Competencia: ${competencia?.nombre || '...'}`}
        backTo={`/competencias/${competenciaId}`}
      />

      {/* ── Banda informativa A / B / C ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* A: Nombre de la competencia */}
        <Card className="bg-slate-800 text-white border-0">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Competencia</p>
            <p className="font-semibold text-sm leading-snug">{competencia?.nombre || '...'}</p>
            {competencia?.tipoCompetencia && (
              <p className="text-xs text-slate-400 mt-1 capitalize">{competencia.tipoCompetencia}</p>
            )}
          </CardContent>
        </Card>

        {/* B: Límites de inscripción */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 space-y-1.5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Límites por socio</p>
            {[
              { label: 'Individuales', val: competencia?.maxIndividuales },
              { label: 'Duos',         val: competencia?.maxDuos },
              { label: 'Cuartetos',    val: competencia?.maxCuartetos },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-800">
                  {!val || val === 'libre' ? 'Sin límite' : `Máx ${val}`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* C: Instrucciones */}
        <Card className="bg-indigo-50 border-indigo-100">
          <CardContent className="p-4">
            <p className="text-xs text-indigo-600 uppercase tracking-wide mb-2">Pasos</p>
            <ol className="space-y-1 text-xs text-slate-600 list-decimal list-inside">
              <li>Busque el criador por anillo, apellido o nombre.</li>
              <li>Seleccione el tipo de presentación.</li>
              <li>Elija el lote (código nomenclador).</li>
              <li>Complete los anillos según el tipo.</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* ── Layout principal: formulario + grilla ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ── Columna izquierda: formulario ── */}
        <Card>
          <CardContent className="pt-6">
            {error && (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm mb-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {resultado && (
              <div className="space-y-2 mb-4">
                <div className={`flex items-start gap-2 rounded px-3 py-2 text-sm border ${resultado.creados?.length > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {resultado.creados?.length > 0
                    ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{resultado.mensaje}</p>
                    {resultado.creados?.length > 0 && (
                      <p className="text-xs">
                        Anillos inscriptos: {resultado.creados.map(c => c.numAnillo).join(', ')}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => setResultado(null)} className="shrink-0 opacity-60 hover:opacity-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {resultado.rechazados?.length > 0 && (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <p className="font-medium mb-1">Anillos rechazados:</p>
                    <ul className="space-y-0.5 text-xs">
                      {resultado.rechazados.map((r, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-mono font-semibold">{r.numAnillo}</span>
                          <span className="text-amber-600">— {r.motivo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Búsqueda de socio */}
              <div className="space-y-1.5">
                <Label>Buscar criador *</Label>
                <div className="flex gap-2">
                  <Input
                    value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setBuscado(false); setSocioSeleccionado(null); setAnillosInscritos(new Set()); }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleBuscar())}
                    placeholder="N° de anillo, apellido o nombre..."
                  />
                  <Button type="button" variant="outline" onClick={handleBuscar} disabled={buscando}>
                    {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {resultados.length > 1 && !socioSeleccionado && (
                  <div className="border rounded-lg divide-y bg-white shadow-sm">
                    {resultados.map(s => (
                      <button key={s._id} type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-sm"
                        onClick={() => seleccionarSocio(s)}>
                        <span className="font-semibold font-mono">{s.anilloCriador}</span>
                        <span className="mx-2 text-slate-400">|</span>
                        <span>{s.apellido}, {s.nombre}</span>
                        <span className="ml-2 text-slate-400 text-xs">{s.sociedadId?.nombre}</span>
                      </button>
                    ))}
                  </div>
                )}

                {socioSeleccionado && (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2">
                    <div className="flex items-center gap-2 text-green-800 text-sm">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      <div>
                        <span className="font-bold font-mono">{socioSeleccionado.anilloCriador}</span>
                        <span className="mx-2">—</span>
                        <span>{socioSeleccionado.apellido}, {socioSeleccionado.nombre}</span>
                        <span className="ml-2 text-green-600 text-xs">{socioSeleccionado.sociedadId?.nombre}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setSocioSeleccionado(null); setBusqueda(''); setAnillosInscritos(new Set()); }}
                      className="text-green-600 hover:text-green-800">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {buscado && resultados.length === 0 && !socioSeleccionado && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded px-3 py-2 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Criador no encontrado. Solo se pueden inscribir criadores registrados.
                  </div>
                )}

                {/* Alerta de federación incompatible en competencias nacionales */}
                {socioSeleccionado && esNacional && !socioFederacionValida && (
                  <div className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-300 rounded px-3 py-2 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Federación incompatible</p>
                      <p className="text-xs mt-0.5">
                        La sociedad <span className="font-medium">{socioSeleccionado.sociedadId?.nombre}</span> pertenece
                        a la federación <span className="font-medium">{socioSeleccionado.sociedadId?.federacion || 'sin asignar'}</span>.
                        Esta competencia es de la federación <span className="font-medium">{fedOrganizadora}</span>.
                        Solo pueden inscribirse socios de esa federación.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tipo de presentación */}
              <div className="space-y-1.5">
                <Label>Tipo de presentación *</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'individual', label: 'Individual', max: maxInfo.individual },
                    { value: 'duos', label: 'Duos (2 anillos)', max: maxInfo.duos },
                    { value: 'cuartetos', label: 'Cuartetos (4+1)', max: maxInfo.cuartetos }
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setTipoPresentacion(opt.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.tipoPresentacion === opt.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}>
                      {opt.label}
                      {opt.max && <span className="ml-1.5 text-xs opacity-70">máx {opt.max}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nomenclador */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipo nomenclador *</Label>
                  <Select value={form.tipoNomenclador}
                    onValueChange={v => { setForm(p => ({ ...p, tipoNomenclador: v, codigoNomenclador: '' })); setBusquedaNomen(''); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="color">Color</SelectItem>
                      <SelectItem value="forma">Forma / Postura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Código de lote *</Label>
                  <Input
                    value={busquedaNomen}
                    onChange={e => {
                      setBusquedaNomen(e.target.value);
                      // Si el usuario escribe, limpiar la selección para que pueda buscar de nuevo
                      if (form.codigoNomenclador && e.target.value.trim()) {
                        const aun = nomencladores.find(n => n.codigo === form.codigoNomenclador);
                        if (aun && !matchAND(`${aun.codigo} ${aun.nombreLinea}`, e.target.value)) {
                          setForm(p => ({ ...p, codigoNomenclador: '' }));
                        }
                      }
                    }}
                    placeholder="Buscar por código o nombre..."
                    className="h-8 text-xs"
                  />
                  <Select
                    value={form.codigoNomenclador}
                    onValueChange={v => {
                      setForm(p => ({ ...p, codigoNomenclador: v }));
                      setBusquedaNomen('');
                      setTimeout(() => mainAnilloRef.current?.focus(), 0);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {nomencladoresFiltrados.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-muted-foreground text-center">Sin resultados</div>
                      ) : (
                        nomencladoresFiltrados.map(n => (
                          <SelectItem key={n._id} value={n.codigo}>
                            {n.codigo} — {n.nombreLinea}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Anillo principal */}
              <div className="space-y-1.5">
                <Label>
                  N° de Anillo {form.tipoPresentacion !== 'individual' ? '(anillo 1)' : ''} *
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(4 dígitos)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={mainAnilloRef}
                    value={form.numAnillo}
                    onChange={e => {
                      setForm(p => ({ ...p, numAnillo: e.target.value.slice(0, 4) }));
                      setDuplicados({});
                    }}
                    onBlur={e => {
                      const padded = padAnillo(e.target.value);
                      setForm(p => ({ ...p, numAnillo: padded }));
                      checkAnillo(padded);
                    }}
                    maxLength={4}
                    placeholder="0000"
                    className={`font-mono w-28 ${mainRingError ? 'border-red-500 focus-visible:ring-red-400' : mainRingInscrito ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
                    required
                  />
                  {mainRingInscrito && (
                    <span className="flex items-center gap-1 text-amber-700 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Ya inscripto
                    </span>
                  )}
                </div>
                {mainRingError && <p className="text-xs text-red-600">Anillo repetido</p>}
              </div>

              {form.tipoPresentacion !== 'individual' && (
                <AnillosEditor
                  tipo={form.tipoPresentacion}
                  anillos={form.anillosAdicionales}
                  onChange={anillosAdicionales => { setForm(p => ({ ...p, anillosAdicionales })); setDuplicados({}); }}
                  errores={duplicados}
                  anilloRefs={anilloRefs}
                  anillosInscritos={anillosInscritos}
                  onVerificar={checkAnillo}
                />
              )}

              {/* Año del anillo */}
              <div className="space-y-1.5">
                <Label>
                  Año del anillo *
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(debe ser {anioEsperado})</span>
                </Label>
                <Input
                  type="number"
                  min={anioEsperado}
                  max={anioEsperado}
                  value={form.anioAnillo}
                  onChange={e => setForm(p => ({ ...p, anioAnillo: e.target.value }))}
                  placeholder={String(anioEsperado)}
                  className={form.anioAnillo && Number(form.anioAnillo) !== anioEsperado
                    ? 'border-red-400 focus-visible:ring-red-400' : ''}
                />
                {form.anioAnillo && Number(form.anioAnillo) !== anioEsperado && (
                  <p className="text-xs text-red-600">Solo se permiten anillos del año {anioEsperado}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Input value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/competencias/${competenciaId}`)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending || !socioSeleccionado || !socioFederacionValida}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Inscribir ejemplar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Columna derecha: grilla de inscripciones ── */}
        <Card className="h-fit">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-sm mb-3">
              {socioSeleccionado
                ? <>Canarios inscriptos — <span className="text-primary">{socioSeleccionado.apellido}, {socioSeleccionado.nombre}</span>
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({inscSocio.length})
                    </span></>
                : 'Canarios inscriptos'}
            </h3>

            {!socioSeleccionado ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Buscá y seleccioná un criador para ver sus inscripciones.
              </p>
            ) : inscSocio.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Sin inscripciones para este criador en esta competencia.
              </p>
            ) : (
              <div className="max-h-140 overflow-y-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100 sticky top-0 z-10">
                      <TableHead className="text-xs py-2">Lote</TableHead>
                      <TableHead className="text-xs py-2">Tipo</TableHead>
                      <TableHead className="text-xs py-2">Anillo</TableHead>
                      <TableHead className="text-xs py-2 text-center w-12">Año</TableHead>
                      <TableHead className="text-xs py-2 w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inscSocio.map(insc => {
                      const esGrupo  = insc.tipoPresentacion !== 'individual' && !!insc.grupoPresentacion;
                      const enEdicion = editingId === insc._id;
                      return (
                        <TableRow key={insc._id} className={rowBg(insc)}>
                          {/* Lote: código + nombre completo */}
                          <TableCell className="py-1.5 align-top">
                            <span className="font-mono font-semibold text-xs block">
                              {insc.lote || insc.codigoNomenclador}
                            </span>
                            {insc.nombreNomenclador && (
                              <span className="text-xs text-muted-foreground block leading-tight whitespace-normal">
                                {insc.nombreNomenclador}
                              </span>
                            )}
                          </TableCell>
                          {/* Tipo */}
                          <TableCell className="py-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize
                              ${insc.tipoPresentacion === 'duos'      ? 'bg-blue-100 text-blue-700'
                              : insc.tipoPresentacion === 'cuartetos' ? 'bg-violet-100 text-violet-700'
                              : 'bg-slate-100 text-slate-700'}`}>
                              {insc.tipoPresentacion || 'individual'}
                            </span>
                            {insc.esSuplente && (
                              <span className="block text-xs text-amber-600 mt-0.5">Suplente</span>
                            )}
                          </TableCell>
                          {/* Anillo (editable) */}
                          <TableCell className="py-1.5 font-mono text-sm">
                            {enEdicion ? (
                              <Input
                                value={editingAnillo}
                                onChange={e => setEditingAnillo(e.target.value.slice(0, 4))}
                                maxLength={4}
                                className="h-7 w-20 font-mono text-sm"
                                autoFocus
                              />
                            ) : insc.numAnillo}
                          </TableCell>
                          {/* Año */}
                          <TableCell className="py-1.5 text-center text-xs text-muted-foreground">
                            {insc.anioAnillo ?? '—'}
                          </TableCell>
                          {/* Acciones */}
                          <TableCell className="py-1.5">
                            <div className="flex gap-1 justify-end">
                              {enEdicion ? (
                                <>
                                  <button title="Guardar"
                                    disabled={updateAnilloMut.isPending}
                                    onClick={() => updateAnilloMut.mutate({ id: insc._id, numAnillo: editingAnillo })}
                                    className="p-1 rounded hover:bg-green-50 text-green-600">
                                    {updateAnilloMut.isPending
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <Save className="h-3.5 w-3.5" />}
                                  </button>
                                  <button title="Cancelar"
                                    onClick={() => setEditingId(null)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-500">
                                    <Ban className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button title="Editar anillo"
                                    onClick={() => { setEditingId(insc._id); setEditingAnillo(insc.numAnillo); }}
                                    className="p-1 rounded hover:bg-blue-50 text-blue-600">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button title="Eliminar"
                                    disabled={deleteInscMut.isPending || deleteGrupoMut.isPending}
                                    onClick={() => {
                                      if (esGrupo) setDeleteDialog({ inscripcion: insc });
                                      else if (confirm('¿Eliminar esta inscripción?')) deleteInscMut.mutate(insc._id);
                                    }}
                                    className="p-1 rounded hover:bg-red-50 text-red-500">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Diálogo para duos / cuartetos ────────────────────────────────────── */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Qué deseas hacer?</DialogTitle>
          </DialogHeader>
          {deleteDialog && (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                El canario <span className="font-mono font-semibold">{deleteDialog.inscripcion.numAnillo}</span> forma
                parte de una presentación en <span className="font-medium capitalize">{deleteDialog.inscripcion.tipoPresentacion}</span>.
              </p>
              <p className="text-muted-foreground">
                Podés eliminar toda la presentación (todos los canarios del grupo) o solo cambiar el número de anillo de este canario.
              </p>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleteGrupoMut.isPending}
              onClick={() => deleteGrupoMut.mutate(deleteDialog.inscripcion.grupoPresentacion)}
            >
              {deleteGrupoMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar toda la presentación
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const insc = deleteDialog.inscripcion;
                setDeleteDialog(null);
                setEditingId(insc._id);
                setEditingAnillo(insc.numAnillo);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Solo cambiar el N° de anillo
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
