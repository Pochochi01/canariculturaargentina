import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Trophy, Gavel, Bird, Heart, UserCircle, Loader2, Wallet, BookOpen, BookMarked, FileSpreadsheet } from 'lucide-react';
import { getSociedades } from '@/api/sociedad.api';
import { getSocios } from '@/api/socio.api';
import { getCompetencias, getMisCompetencias } from '@/api/competencia.api';
import { getJueces } from '@/api/juez.api';
import { getMiMesa } from '@/api/mesa.api';
import { Link, Navigate } from 'react-router-dom';

function StatCard({ title, value, icon: Icon, color, to }) {
  const content = (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value ?? '...'}</p>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

const ESTADO_COLORS = {
  abierta: 'bg-green-100 text-green-700',
  cerrada: 'bg-yellow-100 text-yellow-700',
  juzgada: 'bg-blue-100 text-blue-700',
};

export default function DashboardPage() {
  const { user, hasRole } = useAuth();

  const { data: sociedades } = useQuery({
    queryKey: ['sociedades'],
    queryFn: () => getSociedades(),
    enabled: hasRole('admin_general'),
  });

  const { data: sociosData } = useQuery({
    queryKey: ['socios', 'dashboard'],
    queryFn: () => getSocios({ limit: 1 }),
    enabled: hasRole('admin_general', 'admin_sociedad'),
  });

  const { data: competencias } = useQuery({
    queryKey: ['competencias', 'dashboard'],
    queryFn: () => getCompetencias(),
    enabled: hasRole('admin_general', 'admin_sociedad'),
  });

  const { data: jueces } = useQuery({
    queryKey: ['jueces', 'dashboard'],
    queryFn: () => getJueces(),
    enabled: hasRole('admin_general'),
  });

  const { data: misCompetencias } = useQuery({
    queryKey: ['misCompetencias', 'dashboard'],
    queryFn: () => getMisCompetencias(),
    enabled: hasRole('socio'),
  });

  const { data: miMesa, isLoading: mesaLoading } = useQuery({
    queryKey: ['miMesa', 'dashboard'],
    queryFn: getMiMesa,
    enabled: hasRole('operador'),
    retry: false,
  });

  // Redirigir operador directamente a su mesa de jura
  if (hasRole('operador')) {
    if (mesaLoading) return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
    if (miMesa?._id) return <Navigate to={`/mesas/${miMesa._id}/jura`} replace />;
  }

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {greet()}{user?.perfil?.nombre ? `, ${user.perfil.nombre}` : ''}
        </h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Tarjetas para admin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasRole('admin_general') && (
          <StatCard title="Sociedades" value={sociedades?.length} icon={Building2} color="bg-blue-500" to="/sociedades" />
        )}
        {hasRole('admin_general', 'admin_sociedad') && (
          <StatCard title="Socios" value={sociosData?.total} icon={Users} color="bg-green-500" to="/socios" />
        )}
        {hasRole('admin_general', 'admin_sociedad') && (
          <StatCard title="Competencias" value={competencias?.length} icon={Trophy} color="bg-purple-500" to="/competencias" />
        )}
        {hasRole('admin_general') && (
          <StatCard title="Jueces" value={jueces?.length} icon={Gavel} color="bg-orange-500" to="/jueces" />
        )}
        {hasRole('admin_general') && (
          <StatCard title="CSV → PDF" value={null} icon={FileSpreadsheet} color="bg-rose-500" to="/nomencladores/csv-to-pdf" />
        )}
        {hasRole('admin_sociedad') && (
          <StatCard title="Gestión" value={null} icon={Wallet} color="bg-teal-500" to="/gestion" />
        )}
        {hasRole('admin_general', 'admin_sociedad') && (
          <StatCard title="Publicidades" value={null} icon={BookOpen} color="bg-indigo-500" to="/publicidades" />
        )}
        {/* Catálogo digital — visible para TODOS los roles */}
        <StatCard title="Catálogo Digital" value={null} icon={BookMarked} color="bg-violet-500" to="/catalogo-digital" />

        {/* Tarjetas para socio */}
        {hasRole('socio') && (
          <StatCard
            title="Mis Competencias"
            value={misCompetencias?.length}
            icon={Trophy}
            color="bg-purple-500"
            to="/mis-competencias"
          />
        )}
        {hasRole('socio') && (
          <StatCard
            title="Mi Criadero"
            value={null}
            icon={Bird}
            color="bg-emerald-500"
            to="/mi-criadero"
          />
        )}
        {hasRole('socio') && (
          <StatCard
            title="Mi Perfil"
            value={null}
            icon={UserCircle}
            color="bg-slate-500"
            to="/mi-perfil"
          />
        )}
        {hasRole('socio') && (
          <StatCard
            title="Mi Cuenta"
            value={null}
            icon={Wallet}
            color="bg-teal-500"
            to="/mi-cuenta"
          />
        )}
      </div>

      {/* Competencias recientes — admin */}
      {hasRole('admin_general', 'admin_sociedad') && competencias && competencias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competencias recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {competencias.slice(0, 5).map(c => (
                <Link key={c._id} to={`/competencias/${c._id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.sociedadId?.nombre}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[c.estadoInscripcion] || 'bg-slate-100 text-slate-700'}`}>
                    {c.estadoInscripcion}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mis competencias — socio */}
      {hasRole('socio') && misCompetencias && misCompetencias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis competencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {misCompetencias.slice(0, 5).map(c => (
                <Link key={c._id} to={`/competencias/${c._id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.sociedadId?.nombre}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[c.estadoInscripcion] || 'bg-slate-100 text-slate-700'}`}>
                    {c.estadoInscripcion}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
