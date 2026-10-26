import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useHelp } from '@/hooks/useHelp';
import { regenerarAyuda } from '@/api/ayuda.api';
import { CATEGORIAS, MODULOS } from '@/lib/help/constants';
import HelpArticle from './HelpArticle';
import { Search, Loader2, ChevronRight, ArrowLeft, RefreshCw, BookOpen } from 'lucide-react';

const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// Centro de ayuda: búsqueda por texto/palabra clave + filtros por categoría, módulo y rol
export default function HelpCenter() {
  const { hasRole } = useAuth();
  const help = useHelp();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [categoria, setCategoria] = useState('');
  const [modulo, setModulo] = useState('');
  const [rol, setRol] = useState('');

  const q = params.get('q') || '';
  const abierto = params.get('articulo');
  const setParam = (k, v) =>
    setParams(p => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: k === 'q' });

  const regenerar = useMutation({
    mutationFn: regenerarAyuda,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ayuda'] })
  });

  const resultados = useMemo(() => {
    const base = q.trim() ? help.buscar(q, 100).map(r => r.articulo) : help.articulos;
    return base.filter(a =>
      (!categoria || a.categoria === categoria) &&
      (!modulo || a.modulo === modulo) &&
      (!rol || (a.rolesEjecucion || a.rolesPermitidos).includes(rol))
    );
  }, [help, q, categoria, modulo, rol]);

  const articulo = abierto && help.porId.get(abierto);

  if (help.isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title="Centro de Ayuda"
        description="Guías de uso del sistema según su perfil"
        actions={hasRole('admin_general') && (
          <Button variant="outline" size="sm" onClick={() => regenerar.mutate()} disabled={regenerar.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${regenerar.isPending ? 'animate-spin' : ''}`} />
            Regenerar
          </Button>
        )}
      />

      {(regenerar.error || regenerar.data) && (
        <div className={`rounded-md border px-3 py-2 text-sm ${regenerar.error
          ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
          : 'border-green-200 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'}`}>
          {regenerar.error?.response?.data?.error || `${regenerar.data?.message}: ${regenerar.data?.articulos} artículos.`}
        </div>
      )}

      {articulo ? (
        <div className="rounded-xl border border-border bg-card p-4 md:p-6">
          <button
            type="button"
            onClick={() => setParam('articulo', null)}
            className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a los resultados
          </button>
          <HelpArticle articulo={articulo} roles={help.roles} porId={help.porId} onOpen={id => setParam('articulo', id)} />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Escriba su pregunta, por ejemplo: ¿cómo cargar un socio?"
                value={q}
                onChange={e => setParam('q', e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select className={selectClass} value={modulo} onChange={e => setModulo(e.target.value)} aria-label="Módulo">
                <option value="">Todos los módulos</option>
                {help.modulos.map(m => <option key={m} value={m}>{MODULOS[m] || m}</option>)}
              </select>
              {hasRole('admin_general') && (
                <select className={selectClass} value={rol} onChange={e => setRol(e.target.value)} aria-label="Rol">
                  <option value="">Todos los roles</option>
                  {Object.entries(help.roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['', ...help.categorias].map(c => (
                <button
                  key={c || 'todas'}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${categoria === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary'}`}
                >
                  {c ? CATEGORIAS[c] || c : 'Todas'}
                </button>
              ))}
            </div>
          </div>

          {resultados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No se encontraron artículos. Pruebe con otras palabras o quite los filtros.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
              {resultados.map(a => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setParam('articulo', a.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{a.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {CATEGORIAS[a.categoria] || a.categoria} · {a.descripcion}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
