/**
 * FlipBookViewer
 * Carga un PDF desde una URL, renderiza cada página como imagen usando
 * pdfjs-dist y las alimenta a StPageFlip (page-flip).
 */
import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PageFlip } from 'page-flip';
import { Loader2, ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Worker de PDF.js para Vite
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RENDER_SCALE = 1.8;   // resolución de renderizado (más alto = más nítido)

export default function FlipBookViewer({ pdfUrl, titulo = '' }) {
  const bookRef   = useRef(null);
  const flipRef   = useRef(null);   // instancia PageFlip
  const [pages,   setPages]   = useState([]);   // data URLs de las páginas
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [current, setCurrent] = useState(0);
  const [total,   setTotal]   = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // ── Cargar y renderizar PDF ────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');
        setPages([]);

        const loadTask = pdfjs.getDocument({ url: pdfUrl, withCredentials: false });
        const pdf = await loadTask.promise;
        if (cancelled) return;

        const total = pdf.numPages;
        setTotal(total);
        const rendered = [];

        for (let i = 1; i <= total; i++) {
          if (cancelled) return;
          const page     = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas   = document.createElement('canvas');
          canvas.width   = viewport.width;
          canvas.height  = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered.push(canvas.toDataURL('image/jpeg', 0.88));
        }

        if (!cancelled) setPages(rendered);
      } catch (e) {
        if (!cancelled) setError('No se pudo cargar el PDF: ' + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfUrl]);

  // ── Inicializar PageFlip cuando las páginas estén listas ───────────────────
  useEffect(() => {
    if (pages.length === 0 || !bookRef.current) return;

    // Destruir instancia anterior si existe
    if (flipRef.current) {
      try { flipRef.current.destroy(); } catch (_) {}
      flipRef.current = null;
    }

    const pf = new PageFlip(bookRef.current, {
      width:        550,
      height:       780,
      size:         'stretch',
      minWidth:     300,
      maxWidth:     900,
      minHeight:    400,
      maxHeight:    1300,
      showCover:    true,
      flippingTime: 900,
      usePortrait:  true,
      autoSize:     true,
      drawShadow:   true,
    });

    pf.loadFromImages(pages);
    pf.on('flip', e => setCurrent(e.data));
    flipRef.current = pf;

    return () => {
      try { pf.destroy(); } catch (_) {}
    };
  }, [pages]);

  const goTo = (n) => flipRef.current?.flip(n);
  const prev = () => flipRef.current?.flipPrev();
  const next = () => flipRef.current?.flipNext();

  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-600 text-sm">
      {error}
    </div>
  );

  return (
    <div className={`flex flex-col items-center gap-4 ${fullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-4' : ''}`}>
      {/* Cabecera */}
      <div className="flex items-center justify-between w-full max-w-4xl">
        {titulo && (
          <h2 className={`font-semibold ${fullscreen ? 'text-white' : 'text-slate-800'}`}>
            {titulo}
          </h2>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {total > 0 && (
            <span className={`text-xs ${fullscreen ? 'text-slate-300' : 'text-muted-foreground'}`}>
              Página {current + 1} / {total}
            </span>
          )}
          <Button
            variant="ghost" size="icon"
            className={fullscreen ? 'text-white hover:bg-slate-700' : ''}
            onClick={() => setFullscreen(f => !f)}
          >
            {fullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Libro */}
      <div className={`relative w-full flex justify-center ${fullscreen ? 'flex-1' : ''}`}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando páginas...</p>
          </div>
        )}
        <div ref={bookRef} className="shadow-2xl rounded-sm overflow-hidden" />
      </div>

      {/* Controles de navegación */}
      {!loading && pages.length > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={prev}
            className={fullscreen ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : ''}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(total / 2) }, (_, i) => (
              <button
                key={i}
                onClick={() => goTo(i * 2)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  Math.floor(current / 2) === i
                    ? 'bg-primary'
                    : fullscreen ? 'bg-slate-500 hover:bg-slate-400' : 'bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={next}
            className={fullscreen ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : ''}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
