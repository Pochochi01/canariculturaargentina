import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Building2, Users, Gavel, Tag, Trophy, LogOut, Bird, Menu, X, BookOpen, Settings, FileSpreadsheet, ShieldCheck
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const ROLE_LABELS = {
  admin_general: 'Administrador General',
  admin_sociedad: 'Admin. de Sociedad',
  socio: 'Socio',
  operador: 'Operador de Jura'
};

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

function NavSection({ title, children }) {
  return (
    <div className="space-y-1">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      {children}
    </div>
  );
}

export default function Sidebar({ onClose }) {
  const { user, logout, hasRole } = useAuth();

  return (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Bird className="h-6 w-6 text-primary" />
        <div>
          <p className="text-sm font-bold text-slate-900 leading-tight">Canaricultura</p>
          <p className="text-xs text-slate-500 leading-tight">Sistema de Gestión</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-slate-100 md:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="border-b px-4 py-3">
        <p className="text-xs font-medium text-slate-500">Sesión activa</p>
        <p className="text-sm font-semibold text-slate-800">{user?.dni}</p>
        <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5">
          {ROLE_LABELS[user?.role] || user?.role}
        </span>
        {user?.perfil?.nombre && (
          <p className="text-xs text-slate-500 mt-1">{user.perfil.nombre}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        <NavSection title="General">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={onClose} />
        </NavSection>

        {hasRole('admin_general') && (
          <NavSection title="Administración">
            <NavItem to="/admin/admins-sociedad" icon={ShieldCheck} label="Admins. Sociedad" onClick={onClose} />
            <NavItem to="/sociedades" icon={Building2} label="Sociedades" onClick={onClose} />
            <NavItem to="/jueces" icon={Gavel} label="Jueces" onClick={onClose} />
            <NavItem to="/nomencladores/csv-to-pdf" icon={FileSpreadsheet} label="CSV → PDF" onClick={onClose} />
            <NavItem to="/admin/configuracion" icon={Settings} label="Configuración" onClick={onClose} />
          </NavSection>
        )}

        {hasRole('admin_general', 'admin_sociedad') && (
          <NavSection title="Gestión">
            <NavItem to="/socios" icon={Users} label="Socios" onClick={onClose} />
            <NavItem to="/competencias" icon={Trophy} label="Competencias" onClick={onClose} />
          </NavSection>
        )}

        {!hasRole('operador') && (
          <NavSection title="Historico">
            <NavItem to="/historico" icon={BookOpen} label="Historico" onClick={onClose} />
          </NavSection>
        )}

        {hasRole('socio') && (
          <NavSection title="Mi cuenta">
            <NavItem to="/mi-perfil" icon={Users} label="Mi Perfil" onClick={onClose} />
          </NavSection>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t px-3 py-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}
