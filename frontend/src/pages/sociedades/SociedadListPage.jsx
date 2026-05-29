import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getSociedades, deleteSociedad } from '@/api/sociedad.api';
import DataTable from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react';

export default function SociedadListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState(null);

  const { data: sociedades = [], isLoading } = useQuery({
    queryKey: ['sociedades'],
    queryFn: () => getSociedades()
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSociedad,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sociedades'] });
      setDeleteId(null);
    }
  });

  const columns = [
    { key: 'codigo', label: 'Código', className: 'w-24' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'provincia', label: 'Provincia' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'mail', label: 'Mail' },
    {
      key: 'activa', label: 'Estado',
      render: (row) => (
        <Badge variant={row.activa ? 'success' : 'secondary'}>
          {row.activa ? 'Activa' : 'Inactiva'}
        </Badge>
      )
    },
    {
      key: 'acciones', label: '',
      render: (row) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" title="Asignar admin" onClick={() => navigate(`/sociedades/${row._id}/admin`)}>
            <UserCog className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/sociedades/${row._id}/editar`)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
            onClick={() => setDeleteId(row._id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Sociedades"
        description="Gestión de sociedades de canaricultura"
        actions={
          <Button onClick={() => navigate('/sociedades/nueva')}>
            <Plus className="h-4 w-4" /> Nueva sociedad
          </Button>
        }
      />

      <DataTable columns={columns} data={sociedades} loading={isLoading} emptyMessage="No hay sociedades registradas" />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="¿Desactivar sociedad?"
        description="La sociedad quedará inactiva pero sus datos se conservarán."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
