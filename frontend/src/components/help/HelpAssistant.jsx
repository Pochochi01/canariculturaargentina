import { useEffect, useRef, useState } from 'react';
import { useHelp, useModuloActual } from '@/hooks/useHelp';
import { CATEGORIAS } from '@/lib/help/constants';
import HelpArticle from './HelpArticle';
import { MessageCircleQuestion, X, Send } from 'lucide-react';

const BIENVENIDA = {
  autor: 'bot',
  tipo: 'texto',
  texto: 'Hola, escriba su consulta. Por ejemplo: «¿cómo cargar un socio?» o «registrar un pago».'
};

const chip =
  'rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground text-left hover:border-primary hover:text-primary transition-colors';

// Asistente híbrido local: busca en la base de conocimiento, sin IA ni APIs externas
export default function HelpAssistant() {
  const help = useHelp();
  const modulo = useModuloActual(help.rutas);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [mensajes, setMensajes] = useState([BIENVENIDA]);
  const finRef = useRef(null);

  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }); }, [mensajes, abierto]);

  if (!help.articulos.length) return null;

  const agregar = (...m) => setMensajes(prev => [...prev, ...m].slice(-40));

  const preguntar = (e) => {
    e.preventDefault();
    const q = texto.trim();
    if (!q) return;
    setTexto('');
    const pregunta = { autor: 'user', texto: q };
    const r = help.responder(q);
    if (r.tipo === 'unico')
      return agregar(pregunta, { autor: 'bot', tipo: 'articulo', articulo: r.articulo });
    if (r.tipo === 'varios')
      return agregar(pregunta, { autor: 'bot', tipo: 'opciones', texto: 'Encontré varias opciones, ¿cuál busca?', articulos: r.articulos });
    // Sin coincidencias: sugerir categorías, primero las del módulo actual
    const categorias = [...new Set([
      ...help.articulos.filter(a => a.modulo === modulo).map(a => a.categoria),
      ...help.categorias
    ])];
    agregar(pregunta, { autor: 'bot', tipo: 'categorias', texto: 'No encontré una respuesta exacta. Puede explorar estas categorías:', categorias });
  };

  const abrirArticulo = (id) => {
    const a = help.porId.get(id);
    if (a) agregar({ autor: 'user', texto: a.titulo }, { autor: 'bot', tipo: 'articulo', articulo: a });
  };

  const abrirCategoria = (c) => {
    const nombre = CATEGORIAS[c] || c;
    agregar(
      { autor: 'user', texto: nombre },
      { autor: 'bot', tipo: 'opciones', texto: `Artículos de ${nombre}:`, articulos: help.articulos.filter(a => a.categoria === c).slice(0, 8) }
    );
  };

  return (
    <>
      {abierto && (
        <div className="fixed inset-x-2 bottom-20 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Asistente de ayuda</p>
            <button type="button" onClick={() => setAbierto(false)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {mensajes.map((m, i) => (
              <div key={i} className={m.autor === 'user' ? 'flex justify-end' : ''}>
                {m.autor === 'user' ? (
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{m.texto}</p>
                ) : (
                  <div className="max-w-[95%] space-y-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
                    {m.texto && <p>{m.texto}</p>}
                    {m.tipo === 'articulo' && (
                      <HelpArticle articulo={m.articulo} porId={help.porId} onOpen={abrirArticulo} onNavigate={() => setAbierto(false)} compact />
                    )}
                    {m.tipo === 'opciones' && (
                      <div className="flex flex-col gap-1.5">
                        {m.articulos.map(a => (
                          <button key={a.id} type="button" className={chip} onClick={() => abrirArticulo(a.id)}>{a.titulo}</button>
                        ))}
                      </div>
                    )}
                    {m.tipo === 'categorias' && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.categorias.map(c => (
                          <button key={c} type="button" className={chip} onClick={() => abrirCategoria(c)}>{CATEGORIAS[c] || c}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={finRef} />
          </div>

          <form onSubmit={preguntar} className="flex gap-2 border-t border-border p-3">
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Escriba su pregunta…"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <button type="submit" className="rounded-md bg-primary px-3 text-primary-foreground hover:opacity-90" aria-label="Enviar">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
        title="Asistente de ayuda"
        aria-label="Asistente de ayuda"
      >
        {abierto ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
      </button>
    </>
  );
}
