import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCompetencias, deleteCompetencia, finalizarCompetencia, reabrirCompetencia } from '@/api/competencia.api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/shared/DataTable';
import { FILTROS, filtrar, agrupar, MSG_FINALIZAR_ABIERTA } from '@/lib/competencias';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Eye, CheckCheck, RotateCcw, History, CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_COLORS = {
  abierta: 'success',
  cerrada: 'warning',
  juzgada: 'default'
};

const TIPO_LABELS = {
  clasica: 'Clásica',
  abierto: 'Abierto',
  nacional: 'Nacional',
  mundial: 'Mundial'
};

export default function CompetenciaListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [deleteId,    setDeleteId]    = useState(null);
  const [finalizarId, setFinalizarId] = useState(null);
  const [reabrirId,   setReopenId]    = useState(null);
  const [aviso,       setAviso]       = useState('');
  const [filtro,      setFiltro]      = useState('todas');
  const esAdminSociedad = user?.role === 'admin_sociedad';

  const { data: competencias = [], isLoading } = useQuery({
    queryKey: ['competencias'],
    queryFn: () => getCompetencias()
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['competencias'] });

  const deleteMutation = useMutation({
    mutationFn: deleteCompetencia,
    onSuccess: () => { invalidate(); setDeleteId(null); }
  });

  const finalizarMutation = useMutation({
    mutationFn: finalizarCompetencia,
    onSuccess: () => { invalidate(); setFinalizarId(null); },
    // El backend es la autoridad: muestra su mensaje si rechaza la finalización
    onError: (e) => { setFinalizarId(null); setAviso(e.response?.data?.error || 'No se pudo finalizar la competencia'); }
  });

  // Inscripción abierta: no se pide confirmación, se explica por qué no se puede
  const pedirFinalizar = (row) =>
    row.estadoInscripcion === 'abierta' ? setAviso(MSG_FINALIZAR_ABIERTA) : setFinalizarId(row._id);

  const reabrirMutation = useMutation({
    mutationFn: reabrirCompetencia,
    onSuccess: () => { invalidate(); setReopenId(null); }
  });

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'tipo', label: 'Tipo', render: row => TIPO_LABELS[row.tipoCompetencia] || '-' },
    {
      key: 'sociedadId',
      label: 'Sociedad / Federación',
      render: row =>
        row.federacionId?.nombre || row.federacionId?.codigo ||
        row.sociedadId?.nombre   || '-'
    },
    {
      key: 'fecha', label: 'Fecha',
      render: row => row.fecha ? format(new Date(row.fecha), 'dd/MM/yyyy', { locale: es }) : '-'
    },
    { key: 'juezId', label: 'Juez', render: row => row.juezId ? `${row.juezId.apellido}, ${row.juezId.nombre}` : '-' },
    {
      key: 'estadoInscripcion', label: 'Inscripción',
      render: row => (
        <Badge variant={ESTADO_COLORS[row.estadoInscripcion] || 'secondary'} className="capitalize">
          {row.estadoInscripcion}
        </Badge>
      )
    },
    {
      key: 'estadoCompetencia', label: 'Estado',
      render: row => row.estadoCompetencia === 'finalizada'
        ? <Badge variant="default" className="bg-slate-700 capitalize">Finalizada</Badge>
        : <Badge variant="outline" className="text-blue-700 border-blue-300 capitalize">En curso</Badge>
    },
    {
      key: 'acciones', label: '',
      render: row => {
        const esOrganizador = user?.role === 'admin_general' ||
          (user?.role === 'admin_sociedad' &&
            row.sociedadId?._id?.toString() === user?.sociedadId?.toString());
        const finalizada = row.estadoCompetencia === 'finalizada';
        return (
          <div className="flex gap-1 justify-end">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/competencias/${row._id}`)}>
              <Eye className="h-4 w-4" />
            </Button>
            {esOrganizador && (
              <Button variant="ghost" size="icon" onClick={() => navigate(`/competencias/${row._id}/editar`)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {/* Finalizar / Reabrir — solo admin_general puede reabrir */}
            {esOrganizador && !finalizada && (
              <Button
                variant="ghost" size="icon"
                className="text-slate-600 hover:text-slate-900"
                title={row.estadoInscripcion === 'abierta' ? 'Cierre la inscripción para poder finalizar' : 'Finalizar competencia'}
                onClick={() => pedirFinalizar(row)}
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
            {user?.role === 'admin_general' && finalizada && (
              <Button
                variant="ghost" size="icon"
                className="text-amber-600 hover:text-amber-800"
                title="Reabrir competencia"
                onClick={() => setReopenId(row._id)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            {esOrganizador && (
              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(row._id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <PageHeader
        title="Competencias"
        description="Gestión de competencias y exposiciones"
        actions={
          <Button onClick={() => navigate('/competencias/nueva')}>
            <Plus className="h-4 w-4" /> Nueva competencia
          </Button>
        }
      />
      {esAdminSociedad ? (
        <ListadoAgrupado
          competencias={filtrar(competencias, filtro, user)}
          filtro={filtro}
          onFiltro={setFiltro}
          columns={columns}
          loading={isLoading}
        />
      ) : (
        <DataTable columns={columns} data={competencias} loading={isLoading} emptyMessage="No hay competencias registradas" />
      )}

      <Dialog open={!!aviso} onOpenChange={(v) => !v && setAviso('')}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No se puede finalizar</DialogTitle>
            <DialogDescription>{aviso}</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={() => setAviso('')}>Entendido</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="¿Eliminar competencia?"
        description="Se eliminarán también todas las inscripciones asociadas."
        onConfirm={() => deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={!!finalizarId} onOpenChange={() => setFinalizarId(null)}
        title="¿Finalizar competencia?"
        description="La competencia quedará marcada como finalizada y aparecerá en el histórico."
        onConfirm={() => finalizarMutation.mutate(finalizarId)} loading={finalizarMutation.isPending}
      />
      <ConfirmDialog
        open={!!reabrirId} onOpenChange={() => setReopenId(null)}
        title="¿Reabrir competencia?"
        description="La competencia volverá al estado 'En curso' y dejará de aparecer en el histórico."
        onConfirm={() => reabrirMutation.mutate(reabrirId)} loading={reabrirMutation.isPending}
      />
    </div>
  );
}

// Admin de sociedad: filtros + bloque de activas arriba y el historial separado debajo
export function ListadoAgrupado({ competencias, filtro, onFiltro, columns, loading }) {
  const { activas, historial } = agrupar(competencias);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros">
        {FILTROS.map(f => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={filtro === f.valor}
            onClick={() => onFiltro(f.valor)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${filtro === f.valor
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section aria-labelledby="bloque-activas">
        <h2 id="bloque-activas" className="mb-2 flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-green-600" /> Competencias Activas
          <span className="text-xs font-normal text-muted-foreground">({activas.length}) · inscripción abierta, la más próxima primero</span>
        </h2>
        <DataTable columns={columns} data={activas} loading={loading} emptyMessage="No hay competencias con inscripción abierta" />
      </section>

      <div className="flex items-center gap-3" role="separator">
        <div className="h-px flex-1 bg-border" />
        <h2 id="bloque-historial" className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
          <History className="h-4 w-4" /> Historial de Competencias
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <section aria-labelledby="bloque-historial">
        <p className="mb-2 text-xs text-muted-foreground">({historial.length}) · finalizadas, cerradas e históricas, la más reciente primero</p>
        <DataTable columns={columns} data={historial} loading={loading} emptyMessage="Sin competencias en el historial" />
      </section>
    </div>
  );
}
