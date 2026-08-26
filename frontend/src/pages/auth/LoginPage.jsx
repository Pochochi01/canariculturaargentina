import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, homeByRole, ROLE_LABELS } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bird, Loader2, Shield, Building2, UserRound, Gavel, ChevronRight, ArrowLeft } from 'lucide-react';

const ROLE_ICONS = {
  admin_general:  Shield,
  admin_sociedad: Building2,
  socio:          UserRound,
  operador:       Gavel
};

const ROLE_DESC = {
  admin_general:  'Acceso completo al sistema',
  admin_sociedad: 'Gestión de socios y competencias de la sociedad',
  socio:          'Mis competencias, criadero y perfil',
  operador:       'Pantalla de jura y carga de puntajes'
};

// ── Paso 1: formulario de credenciales ────────────────────────────────────────
function CredencialesForm({ onSuccess }) {
  const { login } = useAuth();
  const [form, setForm]     = useState({ dni: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(form.dni, form.password);
      onSuccess(result);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingrese con su DNI y contraseña</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dni">DNI / Usuario</Label>
            <Input
              id="dni"
              placeholder="Ej: 12345678"
              value={form.dni}
              onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
              disabled={loading}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ingresar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Paso 2: selección de rol ──────────────────────────────────────────────────
function RoleSelector({ roles, onSelect, onBack }) {
  const { loading } = useAuth();
  const [selecting, setSelecting] = useState(null);
  const [error, setError]         = useState('');

  const handleSelect = async (role) => {
    setError('');
    setSelecting(role);
    try {
      await onSelect(role);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al seleccionar rol');
      setSelecting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-2 -mt-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </button>
        <CardTitle>Seleccionar perfil</CardTitle>
        <CardDescription>
          Tu cuenta tiene varios perfiles. Elegí con cuál querés continuar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {roles.map(role => {
          const Icon = ROLE_ICONS[role] || UserRound;
          const isSelecting = selecting === role;
          return (
            <button
              key={role}
              onClick={() => handleSelect(role)}
              disabled={!!selecting}
              className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all
                hover:border-primary hover:bg-primary/5 hover:shadow-sm
                disabled:opacity-60 disabled:cursor-not-allowed
                ${isSelecting ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                {isSelecting
                  ? <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  : <Icon className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800">{ROLE_LABELS[role] || role}</p>
                <p className="text-xs text-slate-500 truncate">{ROLE_DESC[role] || ''}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          );
        })}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const { selectRole, pendingRoles } = useAuth();
  const navigate = useNavigate();
  // null = formulario | 'roles' = selector de rol
  const [step, setStep] = useState(null);

  const handleLoginSuccess = (result) => {
    if (result.requiresRoleSelection) {
      setStep('roles');
    } else {
      navigate(homeByRole(result.user), { replace: true });
    }
  };

  const handleRoleSelect = async (role) => {
    const user = await selectRole(role);
    navigate(homeByRole(user), { replace: true });
  };

  const handleBack = () => setStep(null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Bird className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Canaricultura</h1>
          <p className="text-slate-500 mt-1">Sistema de Gestión de Competencias</p>
        </div>

        {step === 'roles' && pendingRoles ? (
          <RoleSelector
            roles={pendingRoles}
            onSelect={handleRoleSelect}
            onBack={handleBack}
          />
        ) : (
          <CredencialesForm onSuccess={handleLoginSuccess} />
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          Los socios acceden con su DNI. Contraseña inicial: su DNI.
        </p>
      </div>
    </div>
  );
}
