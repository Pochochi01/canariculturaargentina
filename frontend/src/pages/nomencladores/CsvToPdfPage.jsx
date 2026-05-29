import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { convertirCSV, listarPDFs, descargarPDF, eliminarPDF } from '@/api/csvToPdf.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Upload, FileText, Download, Trash2, Loader2, CheckCircle2, AlertCircle, FilePlus2
} from 'lucide-react';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CsvToPdfPage() {
  const qc            = useQueryClient();
  const inputRef      = useRef(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [descLoading, setDescLoading] = useState('');

  const { data: pdfs = [], isLoading: loadingPdfs } = useQuery({
    queryKey: ['csv-to-pdf-files'],
    queryFn: listarPDFs
  });

  const convertMutation = useMutation({
    mutationFn: () => convertirCSV(file),
    onSuccess: (data) => {
      setResult({ ok: true, data });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['csv-to-pdf-files'] });
    },
    onError: (err) => {
      setResult({ ok: false, msg: err.response?.data?.error || err.message });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: eliminarPDF,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csv-to-pdf-files'] })
  });

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setResult(null);
    setFile(f || null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith('.csv')) {
      setFile(f);
      setResult(null);
    }
  };

  const handleDownload = async (filename) => {
    setDescLoading(filename);
    try { await descargarPDF(filename); }
    finally { setDescLoading(''); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Convertir CSV a PDF"
        subtitle="Genera un PDF de nomenclador compatible con el importador de colores, formas y canto"
        backTo="/dashboard"
      />

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FilePlus2 className="h-4 w-4" />
            Subir archivo CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instrucciones */}
          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Formato esperado del CSV:</p>
            <code className="block bg-blue-100 rounded px-2 py-1 text-xs font-mono">
              codigo,descripcion<br />
              CO001,NEGRO INTENSO<br />
              CO002,NEGRO BRUNO
            </code>
            <p className="text-xs text-blue-600 mt-1">
              El PDF generado es compatible con "Seleccionar PDF" en /nomencladores/colores, /formas y /canto.
            </p>
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${file ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-green-600" />
                <p className="font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-green-600">{formatBytes(file.size)}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload className="h-8 w-8" />
                <p className="font-medium">Arrastrar CSV aquí o hacer clic</p>
                <p className="text-xs">Solo archivos .csv · máx. 5 MB</p>
              </div>
            )}
          </div>

          {/* Feedback */}
          {result && (
            <div className={`flex items-start gap-3 rounded-md px-4 py-3 text-sm border
              ${result.ok
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'}`}>
              {result.ok
                ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />}
              <div>
                {result.ok ? (
                  <>
                    <p className="font-semibold">PDF generado correctamente — {result.data.total} registros</p>
                    <p className="text-xs mt-0.5">Archivo: <span className="font-mono">{result.data.filename}</span></p>
                    <p className="text-xs text-green-600">
                      Muestra: {result.data.muestra?.map(r => `${r.codigo} ${r.descripcion}`).join(' · ')}
                    </p>
                  </>
                ) : (
                  <p>{result.msg}</p>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={() => convertMutation.mutate()}
            disabled={!file || convertMutation.isPending}
            className="w-full sm:w-auto"
          >
            {convertMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Convirtiendo...</>
              : <><Upload className="mr-2 h-4 w-4" />Convertir a PDF</>}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de PDFs generados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            PDFs generados en /uploads/nomencladores
            {!loadingPdfs && (
              <Badge variant="secondary" className="ml-1">{pdfs.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPdfs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pdfs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No hay PDFs generados aún. Subí un CSV para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-32 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pdfs.map(pdf => (
                  <TableRow key={pdf.filename}>
                    <TableCell className="font-mono text-sm">{pdf.filename}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatBytes(pdf.size)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(pdf.fecha).toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon" variant="ghost"
                          title="Descargar PDF"
                          disabled={descLoading === pdf.filename}
                          onClick={() => handleDownload(pdf.filename)}
                        >
                          {descLoading === pdf.filename
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Download className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Eliminar"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(pdf.filename)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
