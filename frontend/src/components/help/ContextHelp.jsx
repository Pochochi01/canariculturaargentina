import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHelp, useModuloActual } from '@/hooks/useHelp';
import { MODULOS } from '@/lib/help/constants';
import HelpArticle from './HelpArticle';
import { HelpCircle, ArrowLeft, ChevronRight, AlertTriangle } from 'lucide-react';

// Botón "Ayuda" del encabezado: muestra solo la ayuda del módulo de la pantalla actual
export default function ContextHelp() {
  const help = useHelp();
  const modulo = useModuloActual(help.rutas);
  const [open, setOpen] = useState(false);
  const [articuloId, setArticuloId] = useState(null);

  const delModulo = help.articulos.filter(a => a.modulo === modulo);
  const errores = [...new Set(delModulo.flatMap(a => a.erroresFrecuentes || []))].slice(0, 6);
  const articulo = articuloId && help.porId.get(articuloId);

  const cerrar = (v) => { setOpen(v); if (!v) setArticuloId(null); };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Ayuda de esta pantalla"
      >
        <HelpCircle className="h-5 w-5" />
        <span className="hidden sm:inline">Ayuda</span>
      </button>

      <Dialog open={open} onOpenChange={cerrar}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ayuda{modulo ? ` — ${MODULOS[modulo] || modulo}` : ''}</DialogTitle>
          </DialogHeader>

          {articulo ? (
            <div>
              <button
                type="button"
                onClick={() => setArticuloId(null)}
                className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
              <HelpArticle articulo={articulo} roles={help.roles} porId={help.porId} onOpen={setArticuloId} onNavigate={() => cerrar(false)} />
            </div>
          ) : delModulo.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay guías específicas para esta pantalla.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Operaciones disponibles
                </p>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {delModulo.map(a => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setArticuloId(a.id)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted/60"
                      >
                        <span className="flex-1">{a.titulo}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {errores.length > 0 && (
                <div>
                  <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Errores comunes
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {errores.map(e => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Link to="/ayuda" onClick={() => cerrar(false)} className="block text-center text-sm text-primary hover:underline pt-2">
            Ir al Centro de Ayuda
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
