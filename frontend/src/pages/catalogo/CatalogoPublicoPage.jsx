/**
 * Página pública accesible sin login.
 * Ruta: /catalogo-publico/:token
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRevistaPublica, pdfUrl } from '@/api/revista.api';
import FlipBookViewer from './FlipBookViewer';
import { Loader2, BookOpen } from 'lucide-react';

export default function CatalogoPublicoPage() {
  const { token } = useParams();

  const { data: revista, isLoading, isError } = useQuery({
    queryKey: ['revista-publica', token],
    queryFn: () => getRevistaPublica(token),
    retry: false
  });

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header mínimo */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
        <BookOpen className="h-6 w-6 text-indigo-400" />
        <span className="text-white font-semibold text-lg">
          {revista?.nombre || 'Catálogo Digital'}
        </span>
        <span className="text-slate-400 text-sm ml-auto">
          Federación Argentina de Canaricultura
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-6">
        {isLoading && (
          <div className="flex flex-col items-center gap-3 mt-20 text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Cargando revista...</p>
          </div>
        )}

        {isError && (
          <div className="mt-20 text-center text-slate-400">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium text-slate-200">Revista no encontrada</p>
            <p className="text-sm mt-1">El link puede haber expirado o ser incorrecto.</p>
          </div>
        )}

        {revista && (
          <div className="w-full max-w-5xl">
            <FlipBookViewer
              pdfUrl={pdfUrl(revista.filename)}
              titulo={revista.nombre}
            />
          </div>
        )}
      </main>
    </div>
  );
}
