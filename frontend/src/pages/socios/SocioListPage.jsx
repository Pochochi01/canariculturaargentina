import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getSocios, deleteSocio } from '@/api/socio.api';
import DataTable from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

export default function SocioListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['socios', page],
    queryFn: () => getSocios({ page, limit: 30 })
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSocio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socios'] });
      setDeleteId(null);
    }
  });

  const columns = [
    { key: 'anilloCriador', label: 'Anillo Criador', className: 'w-32 font-mono' },
    { key: 'apellido', label: 'Apellido' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'dni', label: 'DNI' },
    {
      key: 'sociedadId', label: 'Sociedad',
      render: row => row.sociedadId?.nombre || '-'
    },
    { key: 'telefono', label: 'Teléfono' },
    {
      key: 'activo', label: 'Estado',
      render: row => <Badge variant={row.activo ? 'success' : 'secondary'}>{row.activo ? 'Activo' : 'Inactivo'}</Badge>
    },
    {
      key: 'acciones', label: '',
      render: row => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/socios/${row._id}/editar`)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(row._id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Socios"
        description="Gestión de socios criadores"
        actions={
          <Button onClick={() => navigate('/socios/nuevo')}>
            <Plus className="h-4 w-4" /> Nuevo socio
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.socios || []}
        loading={isLoading}
        emptyMessage="No hay socios registrados"
        pagination={data ? { page: data.page, pages: data.pages, total: data.total } : null}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="¿Desactivar socio?"
        description="El socio quedará inactivo pero sus datos se conservarán."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
