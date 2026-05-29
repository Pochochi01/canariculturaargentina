import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tag, Trophy, ChevronRight, ListFilter } from 'lucide-react';

const SECCIONES = [
  {
    titulo: 'Nomencladores',
    descripcion: 'Códigos y nombres de línea utilizados para clasificar canarios en inscripciones y catálogos.',
    items: [
      {
        ruta: '/nomencladores/colores',
        titulo: 'Colores',
        descripcion: 'Rama de colores. Usado en: Inscripción, Catálogo, Planilla de Jura, Listado por Lote, Mesas.',
        icon: Tag
      },
      {
        ruta: '/nomencladores/formas',
        titulo: 'Formas / Postura',
        descripcion: 'Rama de forma y postura. Usado en: Inscripción, Catálogo, Planilla de Jura, Listado por Lote, Mesas.',
        icon: Tag
      },
      {
        ruta: '/nomencladores/canto',
        titulo: 'Canto',
        descripcion: 'Nomenclador de canto. Disponible para competencias de canto.',
        icon: Tag
      }
    ]
  },
  {
    titulo: 'Puntuación',
    descripcion: 'Valores de puntos asignados a cada tipo de premio para el cálculo de posiciones en el catálogo.',
    items: [
      {
        ruta: '/admin/premios',
        titulo: 'Premios y Puntos',
        descripcion: 'CA, RCA, Menciones 1–10. Puntos por tipo de presentación (individual, dúos, cuartetos). Usado en: Catálogo (tabla de posiciones).',
        icon: Trophy
      }
    ]
  },
  {
    titulo: 'Listas desplegables',
    descripcion: 'Opciones que se muestran en selects de los formularios del sistema.',
    items: [
      {
        ruta: '/admin/dropdowns',
        titulo: 'Configurar DropDowns',
        descripcion: 'Federaciones, tipos de juez y opciones de máximo por socio. Usado en: Formulario de Juez, Sociedad y Competencia.',
        icon: ListFilter
      }
    ]
  }
];

export default function ConfiguracionPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Administración de nomencladores, premios y parámetros del sistema"
      />

      {SECCIONES.map(seccion => (
        <div key={seccion.titulo} className="space-y-2">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{seccion.titulo}</h2>
            <p className="text-xs text-muted-foreground">{seccion.descripcion}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seccion.items.map(item => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.ruta}
                  className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/40"
                  onClick={() => navigate(item.ruta)}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800">{item.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.descripcion}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
