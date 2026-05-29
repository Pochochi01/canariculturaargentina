import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getJueces, deleteJuez } from '@/api/juez.api';
import DataTable from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function JuezListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState(null);

  const { data: jueces = [], isLoading } = useQuery({
    queryKey: ['jueces'],
    queryFn: getJueces
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJuez,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jueces'] }); setDeleteId(null); }
  });

  const columns = [
    { key: 'codigo', label: 'Código', className: 'w-24' },
    { key: 'apellido', label: 'Apellido' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'dni', label: 'DNI' },
    {
      key: 'activo', label: 'Estado',
      render: row => <Badge variant={row.activo ? 'success' : 'secondary'}>{row.activo ? 'Activo' : 'Inactivo'}</Badge>
    },
    {
      key: 'acciones', label: '',
      render: row => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/jueces/${row._id}/editar`)}>
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
        title="Jueces"
        description="Registro de jueces calificadores"
        actions={
          <Button onClick={() => navigate('/jueces/nuevo')}>
            <Plus className="h-4 w-4" /> Nuevo juez
          </Button>
        }
      />
      <DataTable columns={columns} data={jueces} loading={isLoading} emptyMessage="No hay jueces registrados" />
      <ConfirmDialog
        open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="¿Desactivar juez?" description="El juez quedará inactivo."
        onConfirm={() => deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending}
      />
    </div>
  );
}
