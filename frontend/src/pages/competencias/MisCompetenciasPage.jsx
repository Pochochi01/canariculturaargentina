import { useQuery } from '@tanstack/react-query';
import { getMisCompetencias } from '@/api/competencia.api';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_COLORS = {
  abierta: 'bg-green-100 text-green-700',
  cerrada: 'bg-yellow-100 text-yellow-700',
  juzgada: 'bg-blue-100 text-blue-700',
};

const TIPO_LABELS = {
  clasica: 'Clásica', abierto: 'Abierto', nacional: 'Nacional', mundial: 'Mundial',
};

export default function MisCompetenciasPage() {
  const { data: competencias = [], isLoading } = useQuery({
    queryKey: ['misCompetencias'],
    queryFn: () => getMisCompetencias(),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Mis Competencias" backTo="/dashboard" />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : competencias.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Todavía no participaste en ninguna competencia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {competencias.map(c => (
            <Link key={c._id} to={`/competencias/${c._id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{c.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.sociedadId?.nombre}
                      {c.fecha && (
                        <span className="ml-2">
                          · {format(new Date(c.fecha), 'dd/MM/yyyy', { locale: es })}
                        </span>
                      )}
                    </p>
                    {c.tipoCompetencia && (
                      <span className="text-xs text-slate-500">{TIPO_LABELS[c.tipoCompetencia] || c.tipoCompetencia}</span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLORS[c.estadoInscripcion] || 'bg-slate-100 text-slate-700'}`}>
                    {c.estadoInscripcion}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
