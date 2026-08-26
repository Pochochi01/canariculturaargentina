import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { getNotificaciones, marcarLeida, marcarTodasLeidas, deleteNotificacion } from '@/api/notificacion.api';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_STYLE = {
  fertilidad: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  nacimiento:  'bg-green-100 text-green-700 border-green-200',
  anillado:    'bg-blue-100 text-blue-700 border-blue-200',
};

const TIPO_LABEL = {
  fertilidad: 'Fertilidad',
  nacimiento:  'Nacimiento',
  anillado:    'Anillado',
};

export default function NotificacionBell() {
  const { isAuthenticated, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const queryClient = useQueryClient();

  const enabled = isAuthenticated && hasRole('socio');

  const { data: notificaciones = [] } = useQuery({
    queryKey: ['notificaciones'],
    queryFn: getNotificaciones,
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  const leerMutation = useMutation({
    mutationFn: marcarLeida,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const leerTodasMutation = useMutation({
    mutationFn: marcarTodasLeidas,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotificacion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  if (!enabled) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {noLeidas > 0 && (
          <span className="absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-[30rem] flex flex-col rounded-xl border bg-white shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
            <span className="font-semibold text-sm text-slate-800">
              Notificaciones
              {noLeidas > 0 && (
                <span className="ml-1.5 text-xs text-red-500 font-medium">({noLeidas} nuevas)</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {noLeidas > 0 && (
                <button
                  onClick={() => leerTodasMutation.mutate()}
                  disabled={leerTodasMutation.isPending}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {notificaciones.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="h-8 w-8 mx-auto mb-2 text-slate-200" />
                <p className="text-sm text-muted-foreground">Sin notificaciones pendientes</p>
              </div>
            ) : (
              notificaciones.map(n => (
                <div
                  key={n._id}
                  className={`flex gap-3 px-4 py-3 border-b last:border-0 ${n.leida ? 'bg-white' : 'bg-blue-50/40'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${TIPO_STYLE[n.tipo] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {TIPO_LABEL[n.tipo] || n.tipo}
                      </span>
                      {!n.leida && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 leading-snug">{n.titulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.mensaje}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(n.fechaVencimiento), "d 'de' MMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                    {!n.leida && (
                      <button
                        onClick={() => leerMutation.mutate(n._id)}
                        disabled={leerMutation.isPending}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-green-600 transition-colors"
                        title="Marcar como leída"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(n._id)}
                      disabled={deleteMutation.isPending}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
