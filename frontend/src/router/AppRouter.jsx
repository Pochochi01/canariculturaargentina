import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import SociedadListPage from '@/pages/sociedades/SociedadListPage';
import SociedadFormPage from '@/pages/sociedades/SociedadFormPage';
import SocioListPage from '@/pages/socios/SocioListPage';
import SocioFormPage from '@/pages/socios/SocioFormPage';
import JuezListPage from '@/pages/jueces/JuezListPage';
import JuezFormPage from '@/pages/jueces/JuezFormPage';
import { NomencladorColorPage, NomencladorFormaPage, NomencladorCantoPage } from '@/pages/nomencladores/NomencladorPage';
import CsvToPdfPage from '@/pages/nomencladores/CsvToPdfPage';
import CompetenciaListPage from '@/pages/competencias/CompetenciaListPage';
import CompetenciaFormPage from '@/pages/competencias/CompetenciaFormPage';
import CompetenciaDetailPage from '@/pages/competencias/CompetenciaDetailPage';
import MesasPage from '@/pages/competencias/MesasPage';
import JuraPage from '@/pages/competencias/JuraPage';
import InscripcionFormPage from '@/pages/inscripciones/InscripcionFormPage';
import HistoricoPage from '@/pages/historico/HistoricoPage';
import MisCompetenciasPage from '@/pages/competencias/MisCompetenciasPage';
import MiCriaderoPage from '@/pages/criadero/MiCriaderoPage';
import MiPerfilPage from '@/pages/perfil/MiPerfilPage';
import ConfiguracionPage from '@/pages/admin/ConfiguracionPage';
import PremiosPage from '@/pages/admin/PremiosPage';
import DropDownsPage from '@/pages/admin/DropDownsPage';
import GestionAdminPage from '@/pages/gestion/GestionAdminPage';
import GestionSocioPage from '@/pages/gestion/GestionSocioPage';
import PublicidadPage from '@/pages/publicidades/PublicidadPage';
import CatalogoDigitalPage from '@/pages/catalogo/CatalogoDigitalPage';
import CatalogoPublicoPage from '@/pages/catalogo/CatalogoPublicoPage';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Ruta pública — accesible sin autenticación
  { path: '/catalogo-publico/:token', element: <CatalogoPublicoPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      // Sociedades — admin_general
      {
        path: 'sociedades',
        element: <ProtectedRoute allowedRoles={['admin_general']}><SociedadListPage /></ProtectedRoute>
      },
      {
        path: 'sociedades/nueva',
        element: <ProtectedRoute allowedRoles={['admin_general']}><SociedadFormPage /></ProtectedRoute>
      },
      {
        path: 'sociedades/:id/editar',
        element: <ProtectedRoute allowedRoles={['admin_general']}><SociedadFormPage /></ProtectedRoute>
      },
      {
        path: 'sociedades/:id/admin',
        element: <ProtectedRoute allowedRoles={['admin_general']}><SociedadFormPage adminMode /></ProtectedRoute>
      },

      // Socios
      {
        path: 'socios',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><SocioListPage /></ProtectedRoute>
      },
      {
        path: 'socios/nuevo',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><SocioFormPage /></ProtectedRoute>
      },
      {
        path: 'socios/:id/editar',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad', 'socio']}><SocioFormPage /></ProtectedRoute>
      },

      // Jueces — admin_general
      {
        path: 'jueces',
        element: <ProtectedRoute allowedRoles={['admin_general']}><JuezListPage /></ProtectedRoute>
      },
      {
        path: 'jueces/nuevo',
        element: <ProtectedRoute allowedRoles={['admin_general']}><JuezFormPage /></ProtectedRoute>
      },
      {
        path: 'jueces/:id/editar',
        element: <ProtectedRoute allowedRoles={['admin_general']}><JuezFormPage /></ProtectedRoute>
      },

      // Admin configuracion
      {
        path: 'admin/configuracion',
        element: <ProtectedRoute allowedRoles={['admin_general']}><ConfiguracionPage /></ProtectedRoute>
      },
      {
        path: 'admin/premios',
        element: <ProtectedRoute allowedRoles={['admin_general']}><PremiosPage /></ProtectedRoute>
      },
      {
        path: 'admin/dropdowns',
        element: <ProtectedRoute allowedRoles={['admin_general']}><DropDownsPage /></ProtectedRoute>
      },

      // Nomencladores — admin_general
      {
        path: 'nomencladores/colores',
        element: <ProtectedRoute allowedRoles={['admin_general']}><NomencladorColorPage /></ProtectedRoute>
      },
      {
        path: 'nomencladores/formas',
        element: <ProtectedRoute allowedRoles={['admin_general']}><NomencladorFormaPage /></ProtectedRoute>
      },
      {
        path: 'nomencladores/canto',
        element: <ProtectedRoute allowedRoles={['admin_general']}><NomencladorCantoPage /></ProtectedRoute>
      },
      {
        path: 'nomencladores/csv-to-pdf',
        element: <ProtectedRoute allowedRoles={['admin_general']}><CsvToPdfPage /></ProtectedRoute>
      },

      // Competencias
      {
        path: 'competencias',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><CompetenciaListPage /></ProtectedRoute>
      },
      {
        path: 'competencias/nueva',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><CompetenciaFormPage /></ProtectedRoute>
      },
      {
        path: 'competencias/:id',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad', 'socio']}><CompetenciaDetailPage /></ProtectedRoute>
      },
      {
        path: 'competencias/:id/editar',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><CompetenciaFormPage /></ProtectedRoute>
      },
      {
        path: 'competencias/:id/mesas',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><MesasPage /></ProtectedRoute>
      },
      {
        path: 'competencias/:competenciaId/inscripciones/nueva',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><InscripcionFormPage /></ProtectedRoute>
      },

      // Pantalla de jura (operador o admin)
      {
        path: 'mesas/:mesaId/jura',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad', 'operador']}><JuraPage /></ProtectedRoute>
      },

      // Histórico — accesible por admins y socios
      {
        path: 'historico',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad', 'socio']}><HistoricoPage /></ProtectedRoute>
      },

      // Publicidades / revista
      {
        path: 'publicidades',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><PublicidadPage /></ProtectedRoute>
      },
      // Catálogo digital — todos los roles autenticados
      {
        path: 'catalogo-digital',
        element: <ProtectedRoute><CatalogoDigitalPage /></ProtectedRoute>
      },

      // Gestión financiera
      {
        path: 'gestion',
        element: <ProtectedRoute allowedRoles={['admin_general', 'admin_sociedad']}><GestionAdminPage /></ProtectedRoute>
      },
      {
        path: 'mi-cuenta',
        element: <ProtectedRoute allowedRoles={['socio']}><GestionSocioPage /></ProtectedRoute>
      },

      // Vistas exclusivas del socio
      {
        path: 'mis-competencias',
        element: <ProtectedRoute allowedRoles={['socio']}><MisCompetenciasPage /></ProtectedRoute>
      },
      {
        path: 'mi-criadero',
        element: <ProtectedRoute allowedRoles={['socio']}><MiCriaderoPage /></ProtectedRoute>
      },
      {
        path: 'mi-perfil',
        element: <ProtectedRoute allowedRoles={['socio']}><MiPerfilPage /></ProtectedRoute>
      }
    ]
  }
]);

export default function AppRouter() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
