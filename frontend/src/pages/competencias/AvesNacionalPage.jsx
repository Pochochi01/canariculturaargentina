import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAvesNacional, enviarAvesNacional } from '@/api/competencia.api';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Send, Search, CheckCircle2, AlertTriangle } from 'lucide-react';

const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra la grilla de premiadas (exportado para pruebas) */
export function filtrarAves(aves, { categoria, socio, premio, texto }) {
  const q = norm(texto).trim();
  return aves.filter(a =>
    (!categoria || a.categoria === categoria) &&
    (!socio || a.socio?._id === socio) &&
    (!premio || a.premios.includes(premio)) &&
    (!q || norm(`${a.numAnillo} ${a.numJaula ?? ''} ${a.nombre} ${a.socio?.nombre} ${a.categoria}`).includes(q))
  );
}

export default function AvesNacionalPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [filtros, setFiltros] = useState({ categoria: '', socio: '', premio: '', texto: '' });
  const [seleccion, setSeleccion] = useState(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['aves-nacional', id],
    queryFn: () => getAvesNacional(id)
  });
  const aves = data?.aves || [];

  const enviar = useMutation({
    mutationFn: () => enviarAvesNacional(id, [...seleccion]),
    onSuccess: (r) => {
      setResultado(r);
      setSeleccion(new Set());
      setConfirmar(false);
      qc.invalidateQueries({ queryKey: ['aves-nacional', id] });
    },
    onError: () => setConfirmar(false)
  });

  const opciones = useMemo(() => ({
    categorias: [...new Set(aves.map(a => a.categoria))].sort(),
    socios: [...new Map(aves.filter(a => a.socio).map(a => [a.socio._id, a.socio.nombre])).entries()],
    premios: [...new Set(aves.flatMap(a => a.premios))]
  }), [aves]);

  const visibles = useMemo(() => filtrarAves(aves, filtros), [aves, filtros]);
  const seleccionables = visibles.filter(a => !a.enviada);

  const toggle = (avId) => setSeleccion(s => {
    const n = new Set(s);
    if (n.has(avId)) n.delete(avId); else n.add(avId);
    return n;
  });
  const set = (k) => (e) => setFiltros(f => ({ ...f, [k]: e.target.value }));

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) {
    return (
      <div>
        <PageHeader title="Aves al Nacional" backTo={`/competencias/${id}`} />
        <p className="text-sm text-red-600">{error.response?.data?.error || 'No se pudo cargar la información.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aves al Nacional"
        description={data.nacional
          ? `Destino: ${data.nacional.nombre}`
          : 'No existe una competencia nacional vigente para esta federación.'}
        backTo={`/competencias/${id}`}
      />

      {resultado && (
        <div role="status" className={`rounded-lg border p-3 text-sm ${resultado.omitidas
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
          : 'border-green-300 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200'}`}>
          <p className="flex items-center gap-1.5 font-semibold">
            {resultado.omitidas ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {resultado.mensaje}
          </p>
          {resultado.detalleOmitidas?.length > 0 && (
            <ul className="mt-1.5 list-disc pl-5 text-xs space-y-0.5">
              {resultado.detalleOmitidas.map((o, i) => <li key={i}>Anillo {o.numAnillo} ({o.socio}): {o.motivo}</li>)}
            </ul>
          )}
        </div>
      )}
      {enviar.error && (
        <p role="alert" className="text-sm text-red-600">{enviar.error.response?.data?.error || 'Error al enviar. No se guardó ningún cambio.'}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Buscar anillo, jaula, ave, socio..." value={filtros.texto} onChange={set('texto')} />
        </div>
        <select className={selectClass} value={filtros.categoria} onChange={set('categoria')} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {opciones.categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={selectClass} value={filtros.socio} onChange={set('socio')} aria-label="Socio">
          <option value="">Todos los socios</option>
          {opciones.socios.map(([sid, nombre]) => <option key={sid} value={sid}>{nombre}</option>)}
        </select>
        <select className={selectClass} value={filtros.premio} onChange={set('premio')} aria-label="Premio">
          <option value="">Todos los premios</option>
          {opciones.premios.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setSeleccion(new Set([...seleccion, ...seleccionables.map(a => a._id)]))}>
          Seleccionar todos
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSeleccion(new Set())}>Deseleccionar todos</Button>
        <span className="text-sm font-medium" data-testid="contador">{seleccion.size} seleccionados</span>
        <Button className="ml-auto" disabled={!seleccion.size || !data.nacional || enviar.isPending} onClick={() => setConfirmar(true)}>
          <Send className="h-4 w-4 mr-1" /> Enviar al Nacional
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Anillo</TableHead>
              <TableHead>Jaula</TableHead>
              <TableHead>Ave</TableHead>
              <TableHead>Socio</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Premio</TableHead>
              <TableHead className="text-right">Puntos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay aves premiadas para mostrar.</TableCell></TableRow>
            ) : visibles.map(a => (
              <TableRow key={a._id} className={a.enviada ? 'opacity-60' : ''}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${a.numAnillo}`}
                    checked={seleccion.has(a._id)}
                    disabled={a.enviada}
                    onChange={() => toggle(a._id)}
                    className="h-4 w-4 accent-primary"
                  />
                </TableCell>
                <TableCell className="font-mono font-semibold">{a.numAnillo}</TableCell>
                <TableCell>{a.numJaula ?? '-'}</TableCell>
                <TableCell className="text-sm">
                  {a.nombre}
                  {a.tipoPresentacion !== 'individual' && (
                    <Badge variant="outline" className="ml-1 text-xs capitalize">{a.tipoPresentacion}</Badge>
                  )}
                  {a.enviada && <Badge variant="secondary" className="ml-1 text-xs">Enviada</Badge>}
                </TableCell>
                <TableCell className="text-sm">{a.socio?.nombre}</TableCell>
                <TableCell className="font-mono text-sm">{a.categoria}</TableCell>
                <TableCell>
                  {a.premios.map(p => <span key={p} className="mr-1 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800">{p}</span>)}
                </TableCell>
                <TableCell className="text-right font-semibold">{a.puntos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Al seleccionar un integrante de un dúo o cuarteto se envía la composición completa.
      </p>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="¿Enviar al Nacional?"
        description={`Se inscribirán ${seleccion.size} ave/s seleccionada/s en ${data.nacional?.nombre}. La operación es total: si algo falla no se guarda nada.`}
        onConfirm={() => enviar.mutate()}
        loading={enviar.isPending}
      />
    </div>
  );
}
