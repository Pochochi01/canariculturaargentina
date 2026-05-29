import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getCompetencias } from '@/api/competencia.api';
import { getRevistas, publicarRevista, deleteRevista, pdfUrl } from '@/api/revista.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  BookOpen, Trash2, Link2, Loader2, ExternalLink, BookMarked, Copy, CheckCheck
} from 'lucide-react';
import FlipBookViewer from './FlipBookViewer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const FRONTEND = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

export default function CatalogoDigitalPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const esAdmin = hasRole('admin_general', 'admin_sociedad');

  const [competenciaId, setCompetenciaId] = useState('');
  const [revistaAbierta, setRevistaAbierta] = useState(null); // { id, nombre, filename }
  const [copiedToken, setCopiedToken] = useState('');
  const [pubError, setPubError] = useState('');

  // Listados
  const { data: competencias = [] } = useQuery({
    queryKey: ['competencias'],
    queryFn: getCompetencias,
    enabled: esAdmin
  });

  const { data: revistas = [], isLoading } = useQuery({
    queryKey: ['revistas'],
    queryFn: getRevistas
  });

  // Publicar
  const publicarMut = useMutation({
    mutationFn: publicarRevista,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['revistas'] });
      setPubError('');
      setCompetenciaId('');
    },
    onError: e => setPubError(e.response?.data?.error || 'Error al generar la revista')
  });

  // Eliminar
  const deleteMut = useMutation({
    mutationFn: deleteRevista,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['revistas'] });
      if (revistaAbierta) setRevistaAbierta(null);
    }
  });

  const copiarLink = async (token) => {
    const url = `${FRONTEND}/catalogo-publico/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2000);
  };

  const linkPublico = (token) => `${FRONTEND}/catalogo-publico/${token}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo Digital"
        description="Revistas digitales interactivas de las competencias"
      />

      {/* Panel de generación — solo admins */}
      {esAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Publicar nueva revista</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Competencia</Label>
                <Select value={competenciaId} onValueChange={setCompetenciaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar competencia..." />
                  </SelectTrigger>
                  <SelectContent>
                    {competencias.map(c => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.nombre}{c.fecha && ` — ${new Date(c.fecha).getFullYear()}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => {
                  if (!competenciaId) return setPubError('Seleccioná una competencia');
                  setPubError('');
                  publicarMut.mutate(competenciaId);
                }}
                disabled={publicarMut.isPending}
                className="gap-2"
              >
                {publicarMut.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
                  : <><BookOpen className="h-4 w-4" /> Generar y publicar</>}
              </Button>
            </div>
            {pubError && (
              <p className="text-xs text-red-600 mt-2">{pubError}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Se generará la revista con las publicidades cargadas para esa competencia y quedará disponible para todos los usuarios.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Visor de revista abierta */}
      {revistaAbierta && (
        <Card>
          <CardContent className="pt-4 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{revistaAbierta.nombre}</h3>
              <Button variant="ghost" size="sm" onClick={() => setRevistaAbierta(null)}>
                Cerrar
              </Button>
            </div>
            <FlipBookViewer
              pdfUrl={pdfUrl(revistaAbierta.filename)}
              titulo={revistaAbierta.nombre}
            />
          </CardContent>
        </Card>
      )}

      {/* Lista de revistas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Revistas disponibles
            <Badge variant="secondary" className="ml-2">{revistas.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : revistas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <BookMarked className="h-10 w-10" />
              <p className="text-sm">No hay revistas publicadas aún</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {revistas.map(r => (
                <div
                  key={r._id}
                  className={`border rounded-lg p-4 space-y-3 transition-colors cursor-pointer hover:border-primary hover:bg-slate-50
                    ${revistaAbierta?._id === r._id ? 'border-primary bg-indigo-50' : ''}`}
                  onClick={() => setRevistaAbierta(
                    revistaAbierta?._id === r._id ? null : r
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.fecha
                          ? format(new Date(r.fecha), "d 'de' MMMM yyyy", { locale: es })
                          : '—'}
                      </p>
                    </div>
                    <BookOpen className={`h-5 w-5 shrink-0 ${
                      revistaAbierta?._id === r._id ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                    {/* Link público */}
                    <Button
                      variant="outline" size="sm"
                      className="flex-1 gap-1 text-xs h-7"
                      onClick={() => copiarLink(r.token)}
                    >
                      {copiedToken === r.token
                        ? <><CheckCheck className="h-3.5 w-3.5 text-green-600" /> Copiado</>
                        : <><Copy className="h-3.5 w-3.5" /> Copiar link</>}
                    </Button>

                    {/* Abrir en nueva pestaña */}
                    <a
                      href={linkPublico(r.token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                    >
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>

                    {/* Eliminar — solo admins */}
                    {esAdmin && (
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1 text-xs h-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm('¿Eliminar esta revista? Se borrará el archivo PDF.'))
                            deleteMut.mutate(r._id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
