import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComposicion, recomponer } from '@/api/inscripcion.api';
import {
  desdeServidor, formar, aIndividual, eliminar, validar, construirPayload, hayCambios, TIPO_LABEL
} from '@/lib/composicion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, User, Trash2, Undo2, AlertTriangle } from 'lucide-react';

/**
 * Edición de composición de un socio en una competencia clásica.
 * Se arma un borrador local (seleccionar aves → formar dúo/cuarteto, pasar a individual
 * o eliminar) y se guarda en una sola operación atómica y auditada.
 */
export default function ComposicionEditor({ open, onClose, competenciaId, socio }) {
  const qc = useQueryClient();
  const [original, setOriginal] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [seleccion, setSeleccion] = useState([]);
  const [suplente, setSuplente] = useState(null);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['composicion', competenciaId, socio?._id],
    queryFn: () => getComposicion(competenciaId, socio._id),
    enabled: open && !!socio?._id
  });

  useEffect(() => {
    if (data) {
      const b = desdeServidor(data);
      setOriginal(b); setBorrador(b); setSeleccion([]); setSuplente(null); setError('');
    }
  }, [data]);

  const guardar = useMutation({
    mutationFn: () => recomponer({ competenciaId, socioId: socio._id, ...construirPayload(original, borrador) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inscripciones'] });
      qc.invalidateQueries({ queryKey: ['composicion', competenciaId, socio._id] });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.error || 'No se pudo guardar la composición')
  });

  const problemas = useMemo(() => (borrador ? validar(borrador) : []), [borrador]);
  const cambios = original && borrador && hayCambios(original, borrador);

  const toggle = (id) => {
    setError('');
    setSeleccion(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
    if (suplente === id) setSuplente(null);
  };

  const aplicar = (fn) => {
    try {
      setBorrador(fn(borrador));
      setSeleccion([]); setSuplente(null); setError('');
    } catch (e) { setError(e.message); }
  };

  const n = seleccion.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Composición — {socio?.label}</DialogTitle>
          <DialogDescription>
            Seleccione aves y elija una operación. Los cambios se aplican juntos al guardar.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !borrador ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2" data-testid="unidades">
              {borrador.unidades.map(u => {
                const incompleta = problemas.some(p => p.clave === u.clave);
                return (
                  <div key={u.clave} className={`rounded-lg border p-3 ${incompleta ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-border bg-card'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {u.tipo === 'individual' ? <User className="h-4 w-4 text-muted-foreground" /> : <Users className="h-4 w-4 text-primary" />}
                      <span className="text-sm font-semibold">{TIPO_LABEL[u.tipo]}</span>
                      <Badge variant="outline" className="text-xs font-mono">{u.titulares[0]?.codigo || u.suplente?.codigo}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[...u.titulares, ...(u.suplente ? [u.suplente] : [])].map(a => {
                        const sel = seleccion.includes(a._id);
                        return (
                          <button
                            key={a._id}
                            type="button"
                            aria-pressed={sel}
                            onClick={() => toggle(a._id)}
                            className={`rounded-md border px-2 py-1 font-mono text-xs transition-colors ${sel
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background hover:border-primary'}`}
                          >
                            {a.numAnillo}{u.suplente?._id === a._id ? ' (S)' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {borrador.eliminadas.length > 0 && (
              <p className="text-xs text-red-600">
                Se eliminarán: {borrador.eliminadas.map(a => a.numAnillo).join(', ')}
              </p>
            )}

            {n === 5 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Suplente del cuarteto:</span>
                {avesSeleccionadas(borrador, seleccion).map(a => (
                  <label key={a._id} className="flex items-center gap-1 font-mono text-xs">
                    <input type="radio" name="suplente" checked={suplente === a._id} onChange={() => setSuplente(a._id)} />
                    {a.numAnillo}
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground self-center">{n} seleccionada/s</span>
              <Button size="sm" variant="outline" disabled={n !== 2} onClick={() => aplicar(b => formar(b, seleccion, 'duos'))}>
                Formar dúo
              </Button>
              <Button size="sm" variant="outline" disabled={!(n === 4 || (n === 5 && suplente))}
                onClick={() => aplicar(b => formar(b, seleccion, 'cuartetos', n === 5 ? suplente : null))}>
                Formar cuarteto
              </Button>
              <Button size="sm" variant="outline" disabled={!n} onClick={() => aplicar(b => aIndividual(b, seleccion))}>
                Pasar a individual
              </Button>
              <Button size="sm" variant="outline" className="text-red-600" disabled={!n} onClick={() => aplicar(b => eliminar(b, seleccion))}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
              </Button>
              <Button size="sm" variant="ghost" disabled={!cambios} onClick={() => { setBorrador(original); setSeleccion([]); setError(''); }}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Deshacer todo
              </Button>
            </div>

            {problemas.map(p => (
              <p key={p.clave} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {p.mensaje}
              </p>
            ))}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => guardar.mutate()} disabled={!cambios || problemas.length > 0 || guardar.isPending}>
            {guardar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function avesSeleccionadas(borrador, ids) {
  const todas = borrador.unidades.flatMap(u => [...u.titulares, ...(u.suplente ? [u.suplente] : [])]);
  return ids.map(id => todas.find(a => a._id === id)).filter(Boolean);
}
