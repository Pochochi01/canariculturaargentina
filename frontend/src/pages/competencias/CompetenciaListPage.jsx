import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCompetencias, deleteCompetencia, finalizarCompetencia, reabrirCompetencia } from '@/api/competencia.api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Eye, CheckCheck, RotateCcw } from 'lucide-react';
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

  const { data: competencias = [], isLoading } = useQuery({
    queryKey: ['competencias'],
    queryFn: getCompetencias
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['competencias'] });

  const deleteMutation = useMutation({
    mutationFn: deleteCompetencia,
    onSuccess: () => { invalidate(); setDeleteId(null); }
  });

  const finalizarMutation = useMutation({
    mutationFn: finalizarCompetencia,
    onSuccess: () => { invalidate(); setFinalizarId(null); }
  });

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
                title="Finalizar competencia"
                onClick={() => setFinalizarId(row._id)}
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
      <DataTable columns={columns} data={competencias} loading={isLoading} emptyMessage="No hay competencias registradas" />

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
