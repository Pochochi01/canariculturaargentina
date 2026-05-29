import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHistorico, getResultadosHistorico } from '@/api/competencia.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Loader2, Search, Trophy, X, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import axiosClient from '@/api/axiosClient';

const TIPO_LABELS = { clasica: 'Clasica', abierto: 'Abierto', nacional: 'Nacional', mundial: 'Mundial' };

// AND search: todas las palabras deben estar presentes (sin importar orden)
function matchAND(texto, query) {
  if (!query.trim()) return true;
  const haystack = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return query
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .every(term => haystack.includes(term));
}

function ResultadosDetalle({ competenciaId, competenciaNombre, onClose }) {
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'color' | 'forma'
  const [busqueda,   setBusqueda]   = useState('');
  const [descCatalogo, setDescCatalogo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['historico-resultados', competenciaId],
    queryFn: () => getResultadosHistorico(competenciaId)
  });

  const handleCatalogo = async () => {
    setDescCatalogo(true);
    try {
      const response = await axiosClient.get(`/pdf/catalogo/${competenciaId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catalogo-${competenciaId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescCatalogo(false);
    }
  };

  if (isLoading) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  );

  const { competencia, inscripciones = [] } = data || {};

  // Filtrar por tipo nomenclador y búsqueda AND
  const inscFiltradas = inscripciones.filter(insc => {
    if (filtroTipo !== 'todos' && insc.tipoNomenclador !== filtroTipo) return false;
    if (busqueda.trim()) {
      const texto = [insc.nombreNomenclador, insc.lote, insc.numAnillo,
        insc.numCriador, insc.socioId?.apellido, insc.socioId?.nombre].filter(Boolean).join(' ');
      if (!matchAND(texto, busqueda)) return false;
    }
    return true;
  });

  // Agrupar por lote
  const loteMap = new Map();
  for (const insc of inscFiltradas) {
    const key = `${insc.lote || insc.codigoNomenclador}`;
    if (!loteMap.has(key)) loteMap.set(key, []);
    loteMap.get(key).push(insc);
  }
  const lotes = [...loteMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold">{competencia?.nombre}</h2>
            <p className="text-sm text-muted-foreground">
              {competencia?.fecha
                ? format(new Date(competencia.fecha), 'dd/MM/yyyy', { locale: es })
                : ''}
              {competencia?.lugar ? ` — ${competencia.lugar}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCatalogo} disabled={descCatalogo}>
              {descCatalogo
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                : <FileDown className="h-4 w-4 mr-1.5" />}
              Catálogo PDF
            </Button>
            <button onClick={onClose} className="p-2 rounded hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-6 py-3 border-b flex flex-wrap gap-3 items-center bg-slate-50">
          {/* Filtro tipo */}
          <div className="flex gap-1">
            {[
              { val: 'todos', label: 'Todos' },
              { val: 'color', label: 'Color' },
              { val: 'forma', label: 'Forma/Postura' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setFiltroTipo(opt.val)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filtroTipo === opt.val
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Búsqueda AND */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Buscar nomenclador, anillo, socio…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setBusqueda('')}>
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500">{inscFiltradas.length} resultados</span>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {lotes.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No hay resultados para los filtros aplicados.
            </p>
          ) : (
            lotes.map(([loteKey, items]) => (
              <div key={loteKey}>
                <div className="bg-slate-800 text-white rounded px-3 py-2 text-sm font-bold mb-1 flex items-center gap-2">
                  <span>Lote: {loteKey}</span>
                  <span className="font-normal text-slate-300">{items[0]?.nombreNomenclador}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    items[0]?.tipoNomenclador === 'color' ? 'bg-blue-600' : 'bg-emerald-700'
                  }`}>
                    {items[0]?.tipoNomenclador === 'color' ? 'Color' : 'Forma'}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-16 text-center">Jaula</TableHead>
                      <TableHead>N° Anillo</TableHead>
                      <TableHead>Socio</TableHead>
                      <TableHead className="text-center">Puntaje</TableHead>
                      <TableHead>Premios</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.sort((a, b) => (a.numJaula ?? 0) - (b.numJaula ?? 0)).map(item => (
                      <TableRow key={item._id}>
                        <TableCell className="text-center font-bold text-primary">
                          {item.numJaula ?? '-'}
                        </TableCell>
                        <TableCell className="font-mono">{item.numAnillo}</TableCell>
                        <TableCell>
                          {item.socioId
                            ? `${item.socioId.apellido}, ${item.socioId.nombre}`
                            : item.numCriador}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.puntaje != null
                            ? <span className="font-bold text-blue-600">{item.puntaje}</span>
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {(item.premios || []).map((p, i) => (
                            <span key={i} className="inline-block bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded mr-1">
                              {p.tipo}
                            </span>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoricoPage() {
  const [anio, setAnio]     = useState(String(new Date().getFullYear()));
  const [filtro, setFiltro] = useState({ anio: String(new Date().getFullYear()) });
  const [verDetalle, setVerDetalle] = useState(null);

  const { data: competencias = [], isLoading } = useQuery({
    queryKey: ['historico', filtro],
    queryFn: () => getHistorico(filtro.anio ? { anio: filtro.anio } : {})
  });

  const aniosDisponibles = [...new Set(
    competencias
      .filter(c => c.fecha)
      .map(c => new Date(c.fecha).getFullYear())
  )].sort((a, b) => b - a);

  const compSeleccionada = verDetalle ? competencias.find(c => c._id === verDetalle) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historico de Competencias"
        description="Resultados de competencias finalizadas"
      />

      {/* Filtros de año */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Año</label>
              <Input
                type="number" placeholder="Ej: 2025"
                value={anio} onChange={e => setAnio(e.target.value)}
                className="w-28 h-8" min="2000" max="2099"
              />
            </div>
            <Button size="sm" onClick={() => setFiltro({ anio })} className="h-8">
              <Search className="h-3.5 w-3.5 mr-1.5" /> Buscar
            </Button>
            {filtro.anio && (
              <Button size="sm" variant="outline" onClick={() => { setAnio(''); setFiltro({}); }} className="h-8">
                Ver todos
              </Button>
            )}
            {aniosDisponibles.length > 0 && (
              <div className="flex gap-1 ml-2">
                {aniosDisponibles.slice(0, 6).map(a => (
                  <button
                    key={a}
                    onClick={() => { setAnio(String(a)); setFiltro({ anio: String(a) }); }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      filtro.anio === String(a)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : competencias.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No hay competencias finalizadas{filtro.anio ? ` en ${filtro.anio}` : ''}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {competencias.map(comp => (
            <Card key={comp._id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{comp.nombre}</h3>
                      <Badge variant="default" className="text-xs">
                        {TIPO_LABELS[comp.tipoCompetencia] || comp.tipoCompetencia}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-slate-700 border-slate-400">
                        Finalizada
                      </Badge>
                    </div>
                    <div className="mt-1 flex gap-4 text-sm text-slate-600 flex-wrap">
                      <span>
                        {comp.fecha
                          ? format(new Date(comp.fecha), "dd 'de' MMMM yyyy", { locale: es })
                          : 'Sin fecha'}
                      </span>
                      {comp.lugar && <span>{comp.lugar}</span>}
                      {comp.sociedadId && <span>{comp.sociedadId.nombre}</span>}
                      {comp.juezId && (
                        <span>Juez: {comp.juezId.apellido}, {comp.juezId.nombre}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setVerDetalle(comp._id)}
                    className="shrink-0"
                  >
                    Ver resultados
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {verDetalle && (
        <ResultadosDetalle
          competenciaId={verDetalle}
          competenciaNombre={compSeleccionada?.nombre}
          onClose={() => setVerDetalle(null)}
        />
      )}
    </div>
  );
}
