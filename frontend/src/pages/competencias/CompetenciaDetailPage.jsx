import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getCompetencia, cerrarInscripcion } from '@/api/competencia.api';
import { asignarNomenclador, getNomencladorCompetencia, descargarNomenclador } from '@/api/nomencladorCompetencia.api';
import { getInscripcionesAgrupadas, deleteInscripcion, updateInscripcion } from '@/api/inscripcion.api';
import { descargarCatalogo, descargarPlanillaJura, descargarListadoLote, descargarListadoSocio, descargarListadoVariedadSociedad, descargarCertificado } from '@/api/pdf.api';
import { getLotesJurados } from '@/api/mesa.api';
import { descargarRevista } from '@/api/publicidad.api';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Plus, Pencil, Trash2, FileText, Download, Loader2,
  ChevronDown, ChevronRight, Lock, Search, BookOpen, ClipboardList
} from 'lucide-react';

// AND search: todos los términos deben estar presentes en cualquier orden
const normStr = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const matchAND = (texto, query) => {
  if (!query.trim()) return true;
  const h = normStr(texto);
  return query.trim().split(/\s+/).every(p => h.includes(normStr(p)));
};
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_BADGE = { abierta: 'success', cerrada: 'warning', juzgada: 'default' };

const TIPO_LABELS = {
  clasica: 'Clásica', abierto: 'Abierto', nacional: 'Nacional', mundial: 'Mundial'
};

function LoteSection({ lote, onEdit, onDelete, estadoInscripcion, soloLectura, restringirPuntaje = false, lotesJurados = new Set() }) {
  const [expanded, setExpanded] = useState(true);
  const cerrada = estadoInscripcion !== 'abierta';

  // Determina si para un item concreto se deben mostrar puntaje/premios.
  // En modo restringido solo se muestran si el lote+tipo está marcado 'jurado'
  // en alguna mesa (incluyendo tipoPresentacion='todos' como comodín).
  const puntajeVisible = (item) => {
    if (!restringirPuntaje) return true;
    const tipo = (item.tipoPresentacion || 'individual').toUpperCase();
    return lotesJurados.has(`${lote._id} - ${tipo}`) ||
           lotesJurados.has(`${lote._id} - TODOS`);
  };

  return (
    <div className="border rounded-lg overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-bold font-mono">{lote._id}</span>
          <span className="text-slate-300 text-sm">{lote.nombreNomenclador}</span>
          <Badge variant="outline" className="text-white border-slate-400 text-xs">
            {lote.tipoNomenclador === 'color' ? 'Color' : 'Forma/Postura'}
          </Badge>
        </div>
        <span className="text-slate-300 text-sm">{lote.items.length} ejemplares</span>
      </button>

      {expanded && (
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              {cerrada && <TableHead className="w-16 text-center">Jaula</TableHead>}
              <TableHead>N° Criador</TableHead>
              <TableHead>N° Anillo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Puntaje</TableHead>
              <TableHead>Premios</TableHead>
              {!soloLectura && <TableHead className="w-20"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lote.items.map((item, i) => {
              const verPuntaje = puntajeVisible(item);
              return (
                <TableRow key={item._id}>
                  {cerrada && (
                    <TableCell className="text-center font-bold text-primary">{item.numJaula ?? '-'}</TableCell>
                  )}
                  <TableCell className="font-mono font-semibold">{item.numCriador}</TableCell>
                  <TableCell className="font-mono">{item.numAnillo}</TableCell>
                  <TableCell>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 capitalize">
                      {item.tipoPresentacion || 'individual'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {verPuntaje
                      ? (item.puntaje !== null && item.puntaje !== undefined
                          ? <span className="font-bold text-blue-600">{item.puntaje}</span>
                          : <span className="text-muted-foreground">-</span>)
                      : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {verPuntaje && item.premios?.map((p, pi) => (
                      <span key={pi} className="inline-block bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded mr-1">
                        {p.tipo}
                      </span>
                    ))}
                  </TableCell>
                  {!soloLectura && (
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete(item._id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function EditInscripcionModal({ open, onClose, inscripcion, onSave, loading }) {
  const [puntaje, setPuntaje] = useState(inscripcion?.puntaje ?? '');
  const [premiosText, setPremiosText] = useState(
    (inscripcion?.premios || []).map(p => `${p.tipo}: ${p.descripcion}`).join('\n')
  );

  const parsePremios = (str) =>
    str.split('\n').filter(Boolean).map(line => {
      const [tipo, ...rest] = line.split(':');
      return { tipo: tipo.trim(), descripcion: rest.join(':').trim() };
    });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar calificación — Anillo: {inscripcion?.numAnillo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Puntaje (0-100)</Label>
            <Input
              type="number" min="0" max="100"
              value={puntaje}
              onChange={e => setPuntaje(e.target.value)}
              placeholder="Ej: 87"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Premios (uno por línea: Tipo: Descripción)</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={premiosText}
              onChange={e => setPremiosText(e.target.value)}
              placeholder={"1°: Primer Premio\nCH: Champion"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={() => onSave({
            puntaje: puntaje !== '' ? Number(puntaje) : null,
            premios: parsePremios(premiosText)
          })} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CompetenciaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [deleteId, setDeleteId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [pdfLoading, setPdfLoading] = useState('');
  const [confirmCerrar, setConfirmCerrar] = useState(false);
  const [busqLote, setBusqLote] = useState('');
  const [busqCriador, setBusqCriador] = useState('');
  const [busqAnillo, setBusqAnillo] = useState('');

  const { data: competencia, isLoading: loadingComp } = useQuery({
    queryKey: ['competencia', id],
    queryFn: () => getCompetencia(id)
  });

  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ['inscripciones', 'lotes', id],
    queryFn: () => getInscripcionesAgrupadas(id),
    enabled: !!id
  });

  const restringirPuntaje = user?.role === 'admin_sociedad' || user?.role === 'socio';

  const { data: lotesJuradosData } = useQuery({
    queryKey: ['mesas', 'lotes-jurados', id],
    queryFn: () => getLotesJurados(id),
    enabled: !!id && restringirPuntaje
  });
  const lotesJurados = new Set(lotesJuradosData?.lotesJurados || []);

  const deleteMutation = useMutation({
    mutationFn: deleteInscripcion,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inscripciones'] }); setDeleteId(null); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ inscId, data }) => updateInscripcion(inscId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inscripciones'] }); setEditItem(null); }
  });

  const cerrarMutation = useMutation({
    mutationFn: () => cerrarInscripcion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competencia', id] });
      queryClient.invalidateQueries({ queryKey: ['inscripciones'] });
      setConfirmCerrar(false);
    }
  });

  const { data: nomencladorComp, isLoading: loadingNomenc } = useQuery({
    queryKey: ['nomenclador-competencia', id],
    queryFn: () => getNomencladorCompetencia(id),
    retry: false,
    enabled: !!id
  });

  const asignarMutation = useMutation({
    mutationFn: () => asignarNomenclador(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nomenclador-competencia', id] })
  });

  const [descLoading, setDescLoading] = useState('');

  const handlePdf = async (type) => {
    setPdfLoading(type);
    try {
      if (type === 'catalogo')           await descargarCatalogo(id, competencia?.nombre);
      else if (type === 'planilla')      await descargarPlanillaJura(id, competencia?.nombre);
      else if (type === 'lote')          await descargarListadoLote(id, competencia?.nombre);
      else if (type === 'socio')         await descargarListadoSocio(id, competencia?.nombre);
      else if (type === 'var-sociedad')  await descargarListadoVariedadSociedad(id, competencia?.nombre);
      else if (type === 'certificado')   await descargarCertificado(id);
      else if (type === 'revista')       await descargarRevista(id, competencia?.nombre);
    } finally {
      setPdfLoading('');
    }
  };

  const lotesFiltrados = useMemo(() => {
    let result = lotes;

    if (busqLote.trim()) {
      result = result.filter(l =>
        matchAND(`${l._id} ${l.nombreNomenclador}`, busqLote)
      );
    }

    if (busqCriador.trim()) {
      result = result
        .map(l => ({ ...l, items: l.items.filter(i => matchAND(i.numCriador, busqCriador)) }))
        .filter(l => l.items.length > 0);
    }

    if (busqAnillo.trim()) {
      const q = normStr(busqAnillo.trim());
      result = result
        .map(l => ({ ...l, items: l.items.filter(i => normStr(i.numAnillo).includes(q)) }))
        .filter(l => l.items.length > 0);
    }

    return result;
  }, [lotes, busqLote, busqCriador, busqAnillo]);

  const totalInscripciones = lotes.reduce((acc, l) => acc + (l.items?.length || 0), 0);
  const estaAbierta = competencia?.estadoInscripcion === 'abierta';
  const esSocio = user?.role === 'socio';

  // Organizador: admin_general o admin_sociedad dueño de la competencia
  const esOrganizador = !esSocio && (user?.role === 'admin_general' ||
    (user?.role === 'admin_sociedad' &&
      competencia?.sociedadId?._id?.toString() === user?.sociedadId?.toString()));

  // Participante: admin_sociedad que accede a un nacional (misma federación) o mundial
  // Puede inscribir socios propios y descargar listados, pero no administra la competencia
  const esParticipante = !esSocio && !esOrganizador &&
    user?.role === 'admin_sociedad' &&
    (competencia?.tipoCompetencia === 'nacional' ||
     competencia?.tipoCompetencia === 'mundial');

  if (loadingComp) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!competencia) return <div className="text-center py-12 text-muted-foreground">Competencia no encontrada</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={competencia.nombre}
        backTo={esSocio ? '/mis-competencias' : '/competencias'}
        actions={
          <div className="flex gap-2 flex-wrap">
            {esOrganizador && (
              <Button variant="outline" onClick={() => navigate(`/competencias/${id}/editar`)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            )}
            {esOrganizador && (
              <Button variant="outline" onClick={() => navigate(`/competencias/${id}/mesas`)}>
                Mesas
              </Button>
            )}
            {esOrganizador && estaAbierta && (
              <Button variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50"
                onClick={() => setConfirmCerrar(true)}>
                <Lock className="h-4 w-4 mr-1" /> Cerrar inscripción
              </Button>
            )}
            {esOrganizador && (
              <Button variant="outline" onClick={() => handlePdf('planilla')} disabled={!!pdfLoading}>
                {pdfLoading === 'planilla' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                Planilla de Jura
              </Button>
            )}
            {/* Listado por Lote — solo organizador */}
            {esOrganizador && (
              <Button variant="outline" onClick={() => handlePdf('lote')} disabled={!!pdfLoading}>
                {pdfLoading === 'lote' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                Listado por Lote
              </Button>
            )}
            {/* Listado por Socio — organizador y participante */}
            {(esOrganizador || esParticipante) && (
              <Button variant="outline" onClick={() => handlePdf('socio')} disabled={!!pdfLoading}>
                {pdfLoading === 'socio' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                Listado por Socio
              </Button>
            )}
            {/* Certificado — solo socio */}
            {esSocio && (
              <Button variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50"
                onClick={() => handlePdf('certificado')} disabled={!!pdfLoading}>
                {pdfLoading === 'certificado'
                  ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  : <FileText className="h-4 w-4 mr-1" />}
                Certificado
              </Button>
            )}
            {/* Listado por Variedad — organizador y participante */}
            {(esOrganizador || esParticipante) && (
              <Button variant="outline" onClick={() => handlePdf('var-sociedad')} disabled={!!pdfLoading}>
                {pdfLoading === 'var-sociedad' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                Listado por Variedad
              </Button>
            )}
            {/* Catálogo PDF — solo organizador */}
            {esOrganizador && (
              <Button onClick={() => handlePdf('catalogo')} disabled={!!pdfLoading}>
                {pdfLoading === 'catalogo' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                Catalogo PDF
              </Button>
            )}
            {/* Revista digital — solo organizador */}
            {esOrganizador && (
              <Button
                variant="outline"
                className="border-indigo-400 text-indigo-700 hover:bg-indigo-50"
                onClick={() => handlePdf('revista')} disabled={!!pdfLoading}
              >
                {pdfLoading === 'revista' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BookOpen className="h-4 w-4 mr-1" />}
                Revista Digital
              </Button>
            )}
          </div>
        }
      />

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Estado Inscripción</p>
            <Badge variant={ESTADO_BADGE[competencia.estadoInscripcion]} className="mt-1 capitalize">
              {competencia.estadoInscripcion}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tipo</p>
            <p className="font-semibold mt-1 text-sm">{TIPO_LABELS[competencia.tipoCompetencia] || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Fecha</p>
            <p className="font-semibold mt-1">
              {competencia.fecha ? format(new Date(competencia.fecha), 'dd/MM/yyyy', { locale: es }) : '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Juez</p>
            <p className="font-semibold mt-1 text-sm">
              {competencia.juezId ? `${competencia.juezId.apellido}, ${competencia.juezId.nombre}` : '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total inscriptos</p>
            <p className="font-bold text-2xl text-primary mt-1">{totalInscripciones}</p>
          </CardContent>
        </Card>
      </div>

      {/* Máximos por socio */}
      <div className="flex gap-3 text-xs text-slate-600 flex-wrap">
        <span className="bg-slate-100 rounded px-2 py-1">
          Individuales: <strong>{competencia.maxIndividuales === 'libre' ? 'Libre' : competencia.maxIndividuales}</strong>
        </span>
        <span className="bg-slate-100 rounded px-2 py-1">
          Duos: <strong>{competencia.maxDuos === 'libre' ? 'Libre' : competencia.maxDuos}</strong>
        </span>
        <span className="bg-slate-100 rounded px-2 py-1">
          Cuartetos: <strong>{competencia.maxCuartetos === 'libre' ? 'Libre' : competencia.maxCuartetos}</strong>
        </span>
      </div>

      {/* Nomenclador de competencia */}
      {esOrganizador && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Nomenclador de la competencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingNomenc ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : nomencladorComp ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Asignado el {new Date(nomencladorComp.fechaAsignacion).toLocaleDateString('es-AR')}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button size="sm" variant="outline" disabled={descLoading === 'color'}
                    onClick={async () => {
                      setDescLoading('color');
                      try { await descargarNomenclador(id, 'color', competencia?.nombre); }
                      finally { setDescLoading(''); }
                    }}>
                    {descLoading === 'color' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    Descargar Color
                  </Button>
                  <Button size="sm" variant="outline" disabled={descLoading === 'forma'}
                    onClick={async () => {
                      setDescLoading('forma');
                      try { await descargarNomenclador(id, 'forma', competencia?.nombre); }
                      finally { setDescLoading(''); }
                    }}>
                    {descLoading === 'forma' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    Descargar Forma/Postura
                  </Button>
                  <Button size="sm" variant="outline" className="text-amber-700 border-amber-400 hover:bg-amber-50"
                    disabled={asignarMutation.isPending}
                    onClick={() => asignarMutation.mutate()}>
                    {asignarMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Reasignar
                  </Button>
                </div>
                <div className="mt-2 text-xs font-mono text-slate-500 space-y-0.5">
                  <p>{nomencladorComp.filenameColor}</p>
                  <p>{nomencladorComp.filenameForma}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">Sin nomenclador asignado.</p>
                <Button size="sm" onClick={() => asignarMutation.mutate()} disabled={asignarMutation.isPending}>
                  {asignarMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Asignar nomenclador FAC
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inscripciones */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Inscripciones por lote ({lotes.length} lotes)
            {!estaAbierta && <span className="ml-2 text-sm text-slate-500 font-normal">— ordenadas por jaula</span>}
          </h2>
          {estaAbierta && (
            <Button onClick={() => navigate(`/competencias/${id}/inscripciones/nueva`)}>
              <Plus className="h-4 w-4" /> Nueva inscripción
            </Button>
          )}
        </div>

        {/* Filtros de búsqueda */}
        {lotes.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-9"
                placeholder="Buscar lote (código o nombre)..."
                value={busqLote}
                onChange={e => setBusqLote(e.target.value)}
              />
            </div>
            <div className="relative flex-1 min-w-36">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-9"
                placeholder="Buscar criador..."
                value={busqCriador}
                onChange={e => setBusqCriador(e.target.value)}
              />
            </div>
            <div className="relative flex-1 min-w-36">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-9 font-mono"
                placeholder="Buscar N° anillo..."
                value={busqAnillo}
                onChange={e => setBusqAnillo(e.target.value)}
                maxLength={4}
              />
            </div>
          </div>
        )}

        {loadingLotes ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : lotes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <p>No hay inscripciones en esta competencia.</p>
              {estaAbierta && (
                <Button className="mt-3" onClick={() => navigate(`/competencias/${id}/inscripciones/nueva`)}>
                  <Plus className="h-4 w-4" /> Agregar primera inscripción
                </Button>
              )}
            </CardContent>
          </Card>
        ) : lotesFiltrados.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg bg-white">
            Sin resultados para los filtros aplicados.
          </div>
        ) : (
          lotesFiltrados.map(lote => (
            <LoteSection
              key={lote._id}
              lote={lote}
              estadoInscripcion={competencia.estadoInscripcion}
              onEdit={setEditItem}
              onDelete={setDeleteId}
              soloLectura={esSocio || esParticipante}
              restringirPuntaje={restringirPuntaje}
              lotesJurados={lotesJurados}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="¿Eliminar inscripción?" description="Esta acción no se puede deshacer."
        onConfirm={() => deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={confirmCerrar} onOpenChange={setConfirmCerrar}
        title="¿Cerrar inscripción?"
        description="Se ordenarán los ejemplares por nomenclador/sociedad/socio y se asignarán números de jaula. Esta acción no se puede deshacer."
        onConfirm={() => cerrarMutation.mutate()}
        loading={cerrarMutation.isPending}
      />

      {editItem && (
        <EditInscripcionModal
          open={!!editItem}
          onClose={() => setEditItem(null)}
          inscripcion={editItem}
          loading={updateMutation.isPending}
          onSave={(data) => updateMutation.mutate({ inscId: editItem._id, data })}
        />
      )}
    </div>
  );
}
