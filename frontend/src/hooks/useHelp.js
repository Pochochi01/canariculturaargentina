import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { matchPath, useLocation } from 'react-router-dom';
import { getAyuda } from '@/api/ayuda.api';
import { useAuth } from '@/context/AuthContext';
import { crearDiccionario, crearIndice, buscar, responder } from '@/lib/help/search';

// Base de conocimiento del rol activo (el backend ya filtra por permisos).
// Se descarga una vez por sesión/rol y el índice se construye en memoria.
export function useHelp() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['ayuda', user?.role],
    queryFn: getAyuda,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity
  });

  return useMemo(() => {
    const articulos = data?.articulos || [];
    const dic = crearDiccionario(data?.sinonimos);
    const indice = crearIndice(articulos, dic);
    const porId = new Map(articulos.map(a => [a.id, a]));
    return {
      isLoading,
      error,
      articulos,
      roles: data?.roles || {},
      rutas: data?.rutas || {},
      generado: data?.generado,
      porId,
      buscar: (q, limite) => buscar(indice, q, dic, limite),
      responder: (q) => responder(indice, q, dic),
      categorias: [...new Set(articulos.map(a => a.categoria))],
      modulos: [...new Set(articulos.map(a => a.modulo))]
    };
  }, [data, isLoading, error]);
}

// Módulo correspondiente a la pantalla actual
export function useModuloActual(rutas) {
  const { pathname } = useLocation();
  return useMemo(() => {
    const patron = Object.keys(rutas)
      .sort((a, b) => b.length - a.length)
      .find(p => matchPath({ path: p, end: true }, pathname));
    return patron ? rutas[patron] : null;
  }, [rutas, pathname]);
}
