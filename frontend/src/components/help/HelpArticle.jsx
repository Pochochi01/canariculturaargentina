import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, ListOrdered, Link2, ShieldCheck, ExternalLink } from 'lucide-react';
import { CATEGORIAS, MODULOS, TIPOS } from '@/lib/help/constants';

// Detalle de un artículo. compact = versión reducida para el asistente.
// onNavigate: se llama al seguir el enlace (p. ej. para cerrar el diálogo que lo contiene)
export default function HelpArticle({ articulo, roles = {}, porId, onOpen, onNavigate, compact = false }) {
  if (!articulo) return null;
  const relacionados = (articulo.relacionados || []).map(id => porId?.get(id)).filter(Boolean);

  return (
    <article className="space-y-4">
      <header className="space-y-2">
        <h2 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-foreground leading-snug`}>{articulo.titulo}</h2>
        <p className="text-sm text-muted-foreground">{articulo.descripcion}</p>
        {!compact && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{CATEGORIAS[articulo.categoria] || articulo.categoria}</Badge>
            <Badge variant="outline">{MODULOS[articulo.modulo] || articulo.modulo}</Badge>
            {TIPOS[articulo.tipo] && <Badge variant="outline">{TIPOS[articulo.tipo]}</Badge>}
          </div>
        )}
        {articulo.enlace && (
          <Link
            to={articulo.enlace}
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ir a la pantalla <code className="font-mono opacity-80">{articulo.enlace}</code>
          </Link>
        )}
      </header>

      {articulo.pasos?.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
            <ListOrdered className="h-4 w-4 text-primary" /> Pasos
          </h3>
          <ol className="space-y-2">
            {articulo.pasos.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {articulo.erroresFrecuentes?.length > 0 && (
        <section className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1.5">
            <AlertTriangle className="h-4 w-4" /> Errores frecuentes
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-amber-900 dark:text-amber-200">
            {articulo.erroresFrecuentes.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </section>
      )}

      {articulo.soluciones?.length > 0 && (
        <section className="rounded-lg border border-green-300/60 bg-green-50 dark:bg-green-950/30 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-green-800 dark:text-green-300 mb-1.5">
            <CheckCircle2 className="h-4 w-4" /> Soluciones
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-green-900 dark:text-green-200">
            {articulo.soluciones.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </section>
      )}

      {!compact && (
        <section className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Pueden realizarlo:</span>
          {(articulo.rolesEjecucion || articulo.rolesPermitidos || []).map(r => (
            <Badge key={r} variant="outline" className="text-xs">{roles[r] || r}</Badge>
          ))}
          {articulo.permisos?.length > 0 && (
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5 break-all">{articulo.permisos.join(' · ')}</code>
          )}
        </section>
      )}

      {relacionados.length > 0 && onOpen && (
        <section>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-1.5">
            <Link2 className="h-4 w-4 text-primary" /> Relacionados
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {relacionados.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpen(r.id)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {r.titulo}
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
