import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const title = isRouteErrorResponse(error)
    ? `Error ${error.status} — ${error.statusText}`
    : 'Error inesperado en la aplicación';

  const message = isRouteErrorResponse(error)
    ? error.data
    : (error?.message || String(error));

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {message && (
          <p className="text-sm text-slate-500 bg-slate-100 rounded p-3 text-left font-mono break-all">
            {message}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>Volver atrás</Button>
          <Button onClick={() => navigate('/dashboard')}>Ir al inicio</Button>
        </div>
      </div>
    </div>
  );
}
