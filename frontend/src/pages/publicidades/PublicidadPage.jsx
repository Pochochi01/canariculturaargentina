import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompetencias } from '@/api/competencia.api';
import {
  uploadPublicidad, getPublicidades, deletePublicidad, descargarRevista
} from '@/api/publicidad.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Trash2, Download, Loader2, ImageIcon, BookOpen
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'cover',       label: 'Tapa',               subtipo: null,    max: 1,    desc: 'Portada del catálogo — 1 imagen, página completa' },
  { key: 'backcover',   label: 'Contratapa',          subtipo: null,    max: 1,    desc: 'Contraportada — 1 imagen, página completa' },
  { key: 'fullpage',    label: 'Página completa',     subtipo: 'peers', max: null, desc: 'Páginas PARES — imagen a página completa' },
  { key: 'fullpage_odd',label: 'Página completa impar', subtipo: 'odd', max: null, desc: 'Páginas IMPARES — imagen a página completa' },
  { key: 'halfpage',    label: 'Media página',        subtipo: null,    max: null, desc: 'Se combina en página con otras medias o cuartos' },
  { key: 'quarterpage', label: 'Cuarto de página',    subtipo: null,    max: null, desc: 'Se combina en página con otras imágenes' },
  { key: 'grades',      label: 'Notas / Artículos',   subtipo: null,    max: null, desc: 'Páginas de contenido editorial — antes y después del catálogo' },
];

const TAB_TIPO    = t => t.key.startsWith('fullpage') ? 'fullpage' : t.key;
const TAB_SUBTIPO = t => t.subtipo;
const MAX_SIZE_MB = 20;
const ACCEPT      = 'image/jpeg,image/png,image/webp';

// ── Componente ────────────────────────────────────────────────────────────────

export default function PublicidadPage() {
  const qc = useQueryClient();
  const [competenciaId, setCompetenciaId] = useState('');
  const [tabKey, setTabKey] = useState('cover');
  const [downloading, setDownloading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const tab = TABS.find(t => t.key === tabKey) || TABS[0];

  // Competencias
  const { data: competencias = [] } = useQuery({
    queryKey: ['competencias'],
    queryFn: getCompetencias
  });

  // Publicidades de la tab activa
  const { data: pubs = [], isLoading: loadingPubs } = useQuery({
    queryKey: ['publicidades', competenciaId, tabKey],
    queryFn: () => getPublicidades(competenciaId, TAB_TIPO(tab)),
    enabled: !!competenciaId,
    select: data => {
      // Para fullpage, filtrar por subtipo del tab
      if (TAB_TIPO(tab) === 'fullpage') {
        return data.filter(p => p.subtipo === TAB_SUBTIPO(tab));
      }
      return data;
    }
  });

  // Upload
  const uploadMut = useMutation({
    mutationFn: uploadPublicidad,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['publicidades', competenciaId, tabKey] });
      setUploadErr('');
    },
    onError: e => setUploadErr(e.response?.data?.error || 'Error al subir imagen')
  });

  // Delete
  const deleteMut = useMutation({
    mutationFn: deletePublicidad,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['publicidades', competenciaId, tabKey] })
  });

  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!competenciaId) return setUploadErr('Seleccioná una competencia primero');
    if (!file)          return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024)
      return setUploadErr(`El archivo supera ${MAX_SIZE_MB} MB`);
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type))
      return setUploadErr('Solo se permiten imágenes JPG, PNG o WEBP');
    if (tab.max === 1 && pubs.length >= 1)
      return setUploadErr(`Solo se permite 1 imagen para ${tab.label}`);

    const fd = new FormData();
    fd.append('imagen',       file);
    fd.append('tipo',         TAB_TIPO(tab));
    fd.append('competenciaId', competenciaId);
    if (TAB_SUBTIPO(tab)) fd.append('subtipo', TAB_SUBTIPO(tab));

    setUploadErr('');
    uploadMut.mutate(fd);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDownload = async () => {
    const comp = competencias.find(c => c._id === competenciaId);
    setDownloading(true);
    try { await descargarRevista(competenciaId, comp?.nombre); }
    finally { setDownloading(false); }
  };

  // URL de vista previa (usa el endpoint de uploads del backend)
  const previewUrl = (filename) =>
    `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/advertisements/${filename}`;

  const compSeleccionada = competencias.find(c => c._id === competenciaId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publicidades del Catálogo"
        description="Gestión de imágenes para la revista digital"
      />

      {/* Selector de competencia */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Competencia</Label>
              <Select value={competenciaId} onValueChange={setCompetenciaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar competencia..." />
                </SelectTrigger>
                <SelectContent>
                  {competencias.map(c => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.nombre}
                      {c.fecha && ` — ${new Date(c.fecha).getFullYear()}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {competenciaId && (
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                {downloading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <BookOpen className="h-4 w-4" />}
                {downloading ? 'Generando revista...' : 'Descargar Revista PDF'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {competenciaId && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Barra de tabs lateral */}
          <div className="space-y-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setTabKey(t.key); setUploadErr(''); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${tabKey === t.key
                    ? 'bg-primary text-white'
                    : 'hover:bg-slate-100 text-slate-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>{t.label}</span>
                  {t.max === 1 && (
                    <Badge variant="outline" className="text-xs ml-1 shrink-0">1 img</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Panel de contenido */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{tab.label}</CardTitle>
                  <span className="text-xs text-muted-foreground">{tab.desc}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Zona de carga */}
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-slate-50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                >
                  {uploadMut.isPending ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-sm">Subiendo imagen...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="h-8 w-8" />
                      <p className="text-sm font-medium">
                        Arrastrá o hacé clic para subir una imagen
                      </p>
                      <p className="text-xs">JPG, PNG, WEBP — máx {MAX_SIZE_MB} MB</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={e => handleFile(e.target.files?.[0])}
                  />
                </div>

                {uploadErr && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {uploadErr}
                  </p>
                )}

                {/* Lista de imágenes cargadas */}
                {loadingPubs ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : pubs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <p className="text-sm">Sin imágenes cargadas para este tipo</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {pubs.map(pub => (
                      <div key={pub._id} className="relative group rounded-lg overflow-hidden border bg-slate-50">
                        <img
                          src={previewUrl(pub.filename)}
                          alt={pub.originalName}
                          className="w-full aspect-[3/4] object-cover"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <button
                            onClick={() => {
                              if (confirm('¿Eliminar esta imagen?')) deleteMut.mutate(pub._id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white rounded-full p-2 hover:bg-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="px-2 py-1 text-xs text-muted-foreground truncate">
                          {pub.originalName || pub.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mini guía de layouts */}
            {(tabKey === 'halfpage' || tabKey === 'quarterpage') && (
              <Card className="bg-slate-50">
                <CardContent className="pt-4">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Combinaciones posibles por página</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                    {[
                      { label: 'Layout A', desc: '½ arriba + 2×¼ abajo' },
                      { label: 'Layout B', desc: '2×¼ arriba + ½ abajo' },
                      { label: 'Layout C', desc: '4 cuartos en grilla 2×2' },
                      { label: 'Layout D', desc: '2 mitades apiladas' },
                    ].map(l => (
                      <div key={l.label} className="border rounded p-2 bg-white">
                        <p className="font-medium">{l.label}</p>
                        <p className="text-muted-foreground mt-0.5">{l.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
