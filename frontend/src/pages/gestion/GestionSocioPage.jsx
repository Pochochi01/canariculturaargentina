import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, DollarSign, FileText, Calendar } from 'lucide-react';
import { getMiPerfil } from '@/api/socio.api';
import { getMiEstadoCuenta, downloadEstadoSocio, downloadRecibo } from '@/api/gestion.api';

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function labelPago(p) {
  if (p.tipo === 'mensual') {
    const m = p.meses?.[0];
    return m ? `Cuota ${MESES[m.mes]} ${m.año}` : 'Cuota mensual';
  }
  if (p.tipo === 'anual') {
    const mStr = (p.meses || []).sort((a,b)=>a.mes-b.mes).map(m=>MESES[m.mes]).join(', ');
    return `Cuota anual (${mStr} ${p.meses?.[0]?.año || ''})`;
  }
  return `Derecho de jaula (${p.cantidadJaulas} jaulas)${p.competenciaId?.nombre ? ' — ' + p.competenciaId.nombre : ''}`;
}

export default function GestionSocioPage() {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingRecibo, setDownloadingRecibo] = useState(null);

  const { data: perfil, isLoading: perfilLoading } = useQuery({
    queryKey: ['miPerfil'],
    queryFn: getMiPerfil
  });

  const socioId = perfil?._id;

  const { data, isLoading } = useQuery({
    queryKey: ['miEstadoCuenta'],
    queryFn: getMiEstadoCuenta,
    enabled: !!socioId   // esperar hasta tener perfil cargado
  });

  const pagos    = data?.pagos || [];
  const total    = data?.totalPagado || 0;

  // Calcular meses pagados del año actual
  const añoActual = new Date().getFullYear();
  const mesesPagadosAñoActual = new Set(
    (data?.mesesPagados || [])
      .filter(k => k.startsWith(String(añoActual)))
      .map(k => Number(k.split('-')[1]))
  );

  const handleDownloadEstado = async () => {
    if (!socioId) return;
    setDownloadingPdf(true);
    try {
      // El endpoint /pdf/estado-socio/:socioId genera el PDF
      const blob = await downloadEstadoSocio(socioId);
      triggerDownload(blob, 'mi_estado_cuenta.pdf');
    } finally { setDownloadingPdf(false); }
  };

  const handleDownloadRecibo = async (p) => {
    setDownloadingRecibo(p._id);
    try {
      const blob = await downloadRecibo(p._id);
      triggerDownload(blob, `recibo_${p.nroRecibo}.pdf`);
    } finally { setDownloadingRecibo(null); }
  };

  if (perfilLoading) return (
    <div className="text-center py-16 text-muted-foreground">Cargando perfil...</div>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi cuenta</h1>
        <p className="text-muted-foreground text-sm">Estado de cuenta y recibos</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-green-100">
              <DollarSign className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total pagado</p>
              <p className="text-lg font-bold text-green-700">
                ${Number(total).toLocaleString('es-AR')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileText className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagos registrados</p>
              <p className="text-lg font-bold">{pagos.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <Calendar className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Meses pagados {añoActual}</p>
              <p className="text-lg font-bold">{mesesPagadosAñoActual.size} / 12</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meses del año actual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cuotas {añoActual}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
            {MESES.slice(1).map((m, i) => {
              const pagado = mesesPagadosAñoActual.has(i + 1);
              return (
                <div key={i} title={m}
                  className={`flex flex-col items-center py-2 rounded text-xs font-medium
                    ${pagado ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  <span>{m.slice(0, 3)}</span>
                  {pagado && <span className="text-green-600 mt-0.5">✓</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Historial de pagos */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Historial de pagos</CardTitle>
            <Button onClick={handleDownloadEstado} disabled={downloadingPdf || !socioId}
              variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
          ) : pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No tenés pagos registrados todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {pagos.map(p => (
                <div key={p._id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{labelPago(p)}</p>
                    <p className="text-xs text-muted-foreground">
                      Recibo N° {p.nroRecibo} — {new Date(p.fechaPago).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <span className="font-bold text-green-700 whitespace-nowrap">
                      ${Number(p.monto).toLocaleString('es-AR')}
                    </span>
                    <Button onClick={() => handleDownloadRecibo(p)} size="sm" variant="ghost"
                      disabled={downloadingRecibo === p._id} className="gap-1 text-xs">
                      <Download className="h-3 w-3" />
                      {downloadingRecibo === p._id ? '...' : 'Recibo'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
