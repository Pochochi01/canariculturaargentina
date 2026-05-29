import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DollarSign, Users, TrendingUp, Settings, Search, Download,
  Plus, Trash2, Pencil, Upload, X, CheckCircle, AlertCircle,
  FileText, Building2, ChevronDown, ChevronUp
} from 'lucide-react';
import { getSocios } from '@/api/socio.api';
import {
  getSociedadGestion, uploadLogo,
  getConfigCuota, upsertConfigCuota,
  getPagos, getUltimoPago, createPago, updatePago, deletePago,
  getEstadoSocio,
  getMovimientos, createMovimiento, updateMovimiento, deleteMovimiento,
  downloadRecibo, downloadEstadoSocio, downloadEstadoSociedad
} from '@/api/gestion.api';

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Buscador de socios ────────────────────────────────────────────────────────
function SocioBuscador({ onSelect, selected, label = 'Buscar socio' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['socios', 'gestion', q],
    queryFn: () => getSocios({ q, limit: 10 }),
    enabled: q.length >= 2
  });
  const socios = data?.socios || data?.items || [];

  const handleSelect = (s) => {
    onSelect(s);
    setQ('');
    setOpen(false);
  };
  return (
    <div className="relative">
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      {selected ? (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-slate-50">
          <span className="text-sm font-medium flex-1">
            {selected.apellido}, {selected.nombre}
            <span className="text-xs text-muted-foreground ml-2">({selected.anilloCriador})</span>
          </span>
          <button onClick={() => onSelect(null)} className="text-muted-foreground hover:text-red-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => { setQ(e.target.value); setOpen(true); }}
              placeholder="Nombre, apellido o N° criador..."
              className="pl-9"
            />
          </div>
          {open && socios.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg max-h-52 overflow-y-auto">
              {socios.map(s => (
                <button key={s._id} onClick={() => handleSelect(s)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b last:border-0">
                  <span className="font-medium">{s.apellido}, {s.nombre}</span>
                  <span className="text-muted-foreground ml-2 text-xs">({s.anilloCriador})</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── TAB PAGOS ─────────────────────────────────────────────────────────────────
function TabPagos({ config }) {
  const qc = useQueryClient();
  const [socio, setSocio] = useState(null);
  const [form, setForm] = useState({
    tipo: 'mensual',
    mes: new Date().getMonth() + 1,
    año: new Date().getFullYear(),
    meses: [],     // para anual
    cantidadJaulas: 1,
    monto: '',
    concepto: '',
    fechaPago: new Date().toISOString().slice(0, 10)
  });
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');

  const { data: ultimoData } = useQuery({
    queryKey: ['ultimoPago', socio?._id],
    queryFn: () => getUltimoPago(socio._id),
    enabled: !!socio
  });

  // Sugerir próximo mes al cargar el último pago
  useEffect(() => {
    if (!ultimoData) return;
    if (form.tipo === 'derecho_jaula') return;
    setForm(f => ({
      ...f,
      mes: ultimoData.proximoMes || f.mes,
      año: ultimoData.proximoAño || f.año,
      monto: f.tipo === 'mensual'
        ? (config?.montoCuotaMensual || '')
        : (config?.montoCuotaAnual || '')
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoData]);

  const { data: pagosData, isLoading } = useQuery({
    queryKey: ['pagos', socio?._id],
    queryFn: () => getPagos({ socioId: socio._id }),
    enabled: !!socio
  });
  const pagos = pagosData?.pagos || [];

  const createMut = useMutation({
    mutationFn: createPago,
    onSuccess: () => {
      qc.invalidateQueries(['pagos', socio?._id]);
      qc.invalidateQueries(['ultimoPago', socio?._id]);
      resetForm();
    },
    onError: e => setErr(e.response?.data?.error || 'Error al guardar')
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updatePago(id, data),
    onSuccess: () => {
      qc.invalidateQueries(['pagos', socio?._id]);
      resetForm();
    },
    onError: e => setErr(e.response?.data?.error || 'Error al actualizar')
  });
  const deleteMut = useMutation({
    mutationFn: deletePago,
    onSuccess: () => qc.invalidateQueries(['pagos', socio?._id])
  });

  const resetForm = () => {
    setEditId(null);
    setErr('');
    setForm({
      tipo: 'mensual',
      mes: new Date().getMonth() + 1,
      año: new Date().getFullYear(),
      meses: [],
      cantidadJaulas: 1,
      monto: '',
      concepto: '',
      fechaPago: new Date().toISOString().slice(0, 10)
    });
  };

  const handleTipoChange = (tipo) => {
    let monto = '';
    if (tipo === 'mensual') monto = config?.montoCuotaMensual || '';
    else if (tipo === 'anual') monto = config?.montoCuotaAnual || '';
    else if (tipo === 'derecho_jaula') monto = config?.montoDerechoJaula || '';
    setForm(f => ({ ...f, tipo, monto }));
  };

  const handleMesAnualToggle = (m) => {
    setForm(f => {
      const meses = f.meses.includes(m)
        ? f.meses.filter(x => x !== m)
        : [...f.meses, m].sort((a, b) => a - b);
      return { ...f, meses };
    });
  };

  const handleSubmit = () => {
    setErr('');
    if (!socio) return setErr('Seleccioná un socio');
    if (!form.monto || isNaN(Number(form.monto))) return setErr('Ingresá un monto válido');
    if (form.tipo === 'anual' && form.meses.length === 0) return setErr('Seleccioná al menos un mes');

    const meses = form.tipo === 'mensual'
      ? [{ mes: Number(form.mes), año: Number(form.año) }]
      : form.tipo === 'anual'
        ? form.meses.map(m => ({ mes: m, año: Number(form.año) }))
        : [];

    const data = {
      socioId: socio._id,
      tipo: form.tipo,
      meses,
      cantidadJaulas: form.tipo === 'derecho_jaula' ? Number(form.cantidadJaulas) : 0,
      monto: Number(form.monto),
      concepto: form.concepto,
      fechaPago: form.fechaPago
    };

    if (editId) updateMut.mutate({ id: editId, data });
    else createMut.mutate(data);
  };

  const handleEdit = (p) => {
    setEditId(p._id);
    const mes0 = p.meses?.[0];
    setForm({
      tipo: p.tipo,
      mes: mes0?.mes || new Date().getMonth() + 1,
      año: mes0?.año || new Date().getFullYear(),
      meses: p.meses?.map(m => m.mes) || [],
      cantidadJaulas: p.cantidadJaulas || 1,
      monto: p.monto,
      concepto: p.concepto || '',
      fechaPago: p.fechaPago ? new Date(p.fechaPago).toISOString().slice(0, 10) : ''
    });
  };

  const handleDownloadRecibo = async (pagoId, nroRecibo) => {
    const blob = await downloadRecibo(pagoId);
    triggerDownload(blob, `recibo_${nroRecibo}.pdf`);
  };

  const labelPago = (p) => {
    if (p.tipo === 'mensual') {
      const m = p.meses?.[0];
      return m ? `${MESES[m.mes]} ${m.año}` : 'Mensual';
    }
    if (p.tipo === 'anual') {
      const mStr = (p.meses || []).sort((a,b)=>a.mes-b.mes).map(m=>MESES[m.mes]).join(', ');
      return `Anual ${p.meses?.[0]?.año || ''} (${mStr})`;
    }
    return `Derecho jaula (${p.cantidadJaulas})`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel izquierdo: búsqueda + formulario */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Registrar pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SocioBuscador onSelect={setSocio} selected={socio} />

            {socio && ultimoData?.ultimoPago && (
              <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
                <span className="font-medium">Último pago:</span>{' '}
                {labelPago(ultimoData.ultimoPago)} — ${ultimoData.ultimoPago.monto}
                {ultimoData.proximoMes && (
                  <span className="ml-2 text-green-700">
                    → Sugerido: {MESES[ultimoData.proximoMes]} {ultimoData.proximoAño}
                  </span>
                )}
              </div>
            )}

            {/* Tipo */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo de pago</Label>
              <div className="flex gap-2">
                {['mensual', 'anual', 'derecho_jaula'].map(t => (
                  <button key={t} onClick={() => handleTipoChange(t)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border transition
                      ${form.tipo === t ? 'bg-primary text-white border-primary' : 'border-slate-200 hover:bg-slate-50'}`}>
                    {t === 'mensual' ? 'Mensual' : t === 'anual' ? 'Anual' : 'Der. Jaula'}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos según tipo */}
            {form.tipo === 'mensual' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Mes</Label>
                  <select value={form.mes} onChange={e => setForm(f => ({ ...f, mes: Number(e.target.value) }))}
                    className="w-full border rounded-md px-3 py-1.5 text-sm">
                    {MESES.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Año</Label>
                  <Input type="number" value={form.año} onChange={e => setForm(f => ({ ...f, año: e.target.value }))}
                    className="text-sm" />
                </div>
              </div>
            )}

            {form.tipo === 'anual' && (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Año</Label>
                    <Input type="number" value={form.año} onChange={e => setForm(f => ({ ...f, año: e.target.value }))}
                      className="text-sm" />
                  </div>
                </div>
                <Label className="text-xs text-muted-foreground mb-1 block">Meses a cubrir</Label>
                <div className="grid grid-cols-4 gap-1">
                  {MESES.slice(1).map((m, i) => (
                    <button key={i+1} onClick={() => handleMesAnualToggle(i+1)}
                      className={`text-xs py-1 rounded border transition
                        ${form.meses.includes(i+1) ? 'bg-primary text-white border-primary' : 'border-slate-200 hover:bg-slate-50'}`}>
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.tipo === 'derecho_jaula' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Cantidad jaulas</Label>
                  <Input type="number" min="1" value={form.cantidadJaulas}
                    onChange={e => setForm(f => ({ ...f, cantidadJaulas: e.target.value }))}
                    className="text-sm" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Monto ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  placeholder="0.00" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Fecha de pago</Label>
                <Input type="date" value={form.fechaPago}
                  onChange={e => setForm(f => ({ ...f, fechaPago: e.target.value }))}
                  className="text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Concepto / nota (opcional)</Label>
              <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                placeholder="Observación..." className="text-sm" />
            </div>

            {err && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded p-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {err}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}
                className="flex-1">
                {editId ? 'Actualizar pago' : 'Registrar pago'}
              </Button>
              {editId && (
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Panel derecho: historial */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {socio ? `Pagos de ${socio.apellido}, ${socio.nombre}` : 'Historial de pagos'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!socio && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Seleccioná un socio para ver su historial
              </p>
            )}
            {socio && isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
            )}
            {socio && !isLoading && pagos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Sin pagos registrados</p>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pagos.map(p => (
                <div key={p._id}
                  className="flex items-center justify-between p-2 border rounded text-sm hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{labelPago(p)}</p>
                    <p className="text-xs text-muted-foreground">
                      Rec. {p.nroRecibo} — {new Date(p.fechaPago).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="font-bold text-green-700 whitespace-nowrap">
                      ${Number(p.monto).toLocaleString('es-AR')}
                    </span>
                    <button onClick={() => handleDownloadRecibo(p._id, p.nroRecibo)}
                      title="Descargar recibo"
                      className="text-muted-foreground hover:text-primary">
                      <Download className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleEdit(p)}
                      className="text-muted-foreground hover:text-blue-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => { if (confirm('¿Eliminar este pago?')) deleteMut.mutate(p._id); }}
                      className="text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── TAB ESTADO DE CUENTA DEL SOCIO ────────────────────────────────────────────
function TabEstadoSocio() {
  const [socio, setSocio] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['estadoSocio', socio?._id],
    queryFn: () => getEstadoSocio(socio._id),
    enabled: !!socio
  });

  const pagos = data?.pagos || [];
  const total = data?.totalPagado || 0;

  const labelPago = (p) => {
    if (p.tipo === 'mensual') {
      const m = p.meses?.[0];
      return m ? `Cuota ${MESES[m.mes]} ${m.año}` : 'Cuota mensual';
    }
    if (p.tipo === 'anual') {
      const mStr = (p.meses || []).sort((a,b)=>a.mes-b.mes).map(m=>MESES[m.mes]).join(', ');
      return `Cuota anual (${mStr} ${p.meses?.[0]?.año || ''})`;
    }
    return `Derecho jaula (${p.cantidadJaulas})${p.competenciaId?.nombre ? ' - ' + p.competenciaId.nombre : ''}`;
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadEstadoSocio(socio._id);
      triggerDownload(blob, `estado_cuenta_${socio.anilloCriador}.pdf`);
    } finally { setDownloading(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <SocioBuscador onSelect={setSocio} selected={socio} label="Seleccionar socio" />
            </div>
            {socio && (
              <Button onClick={handleDownload} disabled={downloading} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                {downloading ? 'Generando...' : 'Descargar PDF'}
              </Button>
            )}
          </div>

          {socio && isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          )}

          {socio && !isLoading && (
            <>
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-sm">
                  Estado de cuenta — {socio.apellido}, {socio.nombre}
                </h3>
                <span className="text-sm text-green-700 font-bold">
                  Total pagado: ${Number(total).toLocaleString('es-AR')}
                </span>
              </div>

              {pagos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin pagos registrados</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-xs">
                        <th className="text-left px-3 py-2">Fecha</th>
                        <th className="text-left px-3 py-2">Concepto</th>
                        <th className="text-left px-3 py-2">Recibo</th>
                        <th className="text-right px-3 py-2">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagos.map(p => (
                        <tr key={p._id} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(p.fechaPago).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-3 py-2">{labelPago(p)}</td>
                          <td className="px-3 py-2 text-xs">{p.nroRecibo}</td>
                          <td className="px-3 py-2 text-right font-medium text-green-700">
                            ${Number(p.monto).toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── TAB MOVIMIENTOS ───────────────────────────────────────────────────────────
function TabMovimientos() {
  const qc = useQueryClient();
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', tipo: '' });
  const [form, setForm] = useState({ tipo: 'ingreso', concepto: '', monto: '', fecha: new Date().toISOString().slice(0, 10) });
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['movimientos', filtros],
    queryFn: () => getMovimientos(filtros)
  });

  const movimientos = data?.movimientos || [];
  const totalIngresos = data?.totalIngresos || 0;
  const totalEgresos = data?.totalEgresos || 0;
  const saldo = data?.saldo || 0;

  const createMut = useMutation({
    mutationFn: createMovimiento,
    onSuccess: () => { qc.invalidateQueries(['movimientos']); resetForm(); },
    onError: e => setErr(e.response?.data?.error || 'Error al guardar')
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateMovimiento(id, data),
    onSuccess: () => { qc.invalidateQueries(['movimientos']); resetForm(); },
    onError: e => setErr(e.response?.data?.error || 'Error al actualizar')
  });
  const deleteMut = useMutation({
    mutationFn: deleteMovimiento,
    onSuccess: () => qc.invalidateQueries(['movimientos'])
  });

  const resetForm = () => { setEditId(null); setErr(''); setForm({ tipo: 'ingreso', concepto: '', monto: '', fecha: new Date().toISOString().slice(0, 10) }); };

  const handleSubmit = () => {
    setErr('');
    if (!form.concepto.trim()) return setErr('Ingresá un concepto');
    if (!form.monto || isNaN(Number(form.monto))) return setErr('Ingresá un monto válido');
    const data = { tipo: form.tipo, concepto: form.concepto, monto: Number(form.monto), fecha: form.fecha };
    if (editId) updateMut.mutate({ id: editId, data });
    else createMut.mutate(data);
  };

  const handleEdit = (m) => {
    setEditId(m._id);
    setForm({ tipo: m.tipo, concepto: m.concepto, monto: m.monto, fecha: m.fecha ? new Date(m.fecha).toISOString().slice(0, 10) : '' });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadEstadoSociedad(filtros);
      triggerDownload(blob, 'estado_sociedad.pdf');
    } finally { setDownloading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tarjetas resumen */}
        <div className="p-4 border rounded-lg bg-green-50">
          <p className="text-xs text-muted-foreground">Total ingresos</p>
          <p className="text-xl font-bold text-green-700">${Number(totalIngresos).toLocaleString('es-AR')}</p>
        </div>
        <div className="p-4 border rounded-lg bg-red-50">
          <p className="text-xs text-muted-foreground">Total egresos</p>
          <p className="text-xl font-bold text-red-700">${Number(totalEgresos).toLocaleString('es-AR')}</p>
        </div>
        <div className={`p-4 border rounded-lg ${saldo >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`text-xl font-bold ${saldo >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            ${Number(saldo).toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Formulario */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{editId ? 'Editar movimiento' : 'Nuevo movimiento'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
              <div className="flex gap-2">
                {['ingreso', 'egreso'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border transition
                      ${form.tipo === t ? 'bg-primary text-white border-primary' : 'border-slate-200 hover:bg-slate-50'}`}>
                    {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Concepto</Label>
              <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                placeholder="Descripción del movimiento..." className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Monto ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  placeholder="0.00" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Fecha</Label>
                <Input type="date" value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="text-sm" />
              </div>
            </div>
            {err && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded p-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {err}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="flex-1">
                {editId ? 'Actualizar' : 'Registrar'}
              </Button>
              {editId && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Filtros y exportar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Desde</Label>
                <Input type="date" value={filtros.desde}
                  onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))}
                  className="text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Hasta</Label>
                <Input type="date" value={filtros.hasta}
                  onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))}
                  className="text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
              <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border rounded-md px-3 py-1.5 text-sm">
                <option value="">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </select>
            </div>
            <Button onClick={handleDownload} disabled={downloading} variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />
              {downloading ? 'Generando PDF...' : 'Descargar estado de cuenta'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de movimientos */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
          ) : movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos registrados</p>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="bg-slate-100 text-xs">
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Concepto</th>
                    <th className="text-center px-3 py-2">Tipo</th>
                    <th className="text-right px-3 py-2">Monto</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map(m => (
                    <tr key={m._id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.fecha).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-3 py-2">{m.concepto}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${m.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-medium
                        ${m.tipo === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                        ${Number(m.monto).toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleEdit(m)}
                            className="text-muted-foreground hover:text-blue-600">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => { if (confirm('¿Eliminar este movimiento?')) deleteMut.mutate(m._id); }}
                            className="text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── TAB CONFIGURACIÓN ─────────────────────────────────────────────────────────
function TabConfiguracion() {
  const qc = useQueryClient();
  const [año, setAño] = useState(new Date().getFullYear());
  const [config, setConfig] = useState({ montoCuotaMensual: '', montoCuotaAnual: '', montoDerechoJaula: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef(null);

  const { data: sociedad, refetch: refetchSociedad } = useQuery({
    queryKey: ['sociedadGestion'],
    queryFn: getSociedadGestion
  });

  const { data: configData } = useQuery({
    queryKey: ['configCuota', año],
    queryFn: () => getConfigCuota(año)
  });

  useEffect(() => {
    if (!configData) return;
    setConfig({
      montoCuotaMensual: configData.montoCuotaMensual || '',
      montoCuotaAnual:   configData.montoCuotaAnual   || '',
      montoDerechoJaula: configData.montoDerechoJaula || ''
    });
  }, [configData]);

  const upsertMut = useMutation({
    mutationFn: (data) => upsertConfigCuota({ ...data, año }),
    onSuccess: () => { setMsg('Configuración guardada'); qc.invalidateQueries(['configCuota']); },
    onError: e => setMsg('Error: ' + (e.response?.data?.error || 'No se pudo guardar'))
  });

  const logoMut = useMutation({
    mutationFn: uploadLogo,
    onSuccess: () => { setMsg('Logo actualizado'); setLogoFile(null); setLogoPreview(null); refetchSociedad(); },
    onError: () => setMsg('Error al subir el logo')
  });

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Logo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Logo de la sociedad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            {(logoPreview || sociedad?.logo) && (
              <img
                src={logoPreview || `/logos/${sociedad.logo}`}
                alt="Logo"
                className="h-20 w-20 object-contain border rounded"
              />
            )}
            <div className="space-y-2">
              <input ref={fileInputRef} type="file" accept="image/*"
                onChange={handleLogoChange} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" />
                {sociedad?.logo ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG o SVG. Máx 2MB.</p>
            </div>
          </div>
          {logoFile && (
            <Button onClick={() => logoMut.mutate(logoFile)} disabled={logoMut.isPending} className="gap-2">
              <Upload className="h-4 w-4" />
              {logoMut.isPending ? 'Subiendo...' : 'Confirmar subida'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Cuotas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Tarifas de cuotas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground w-16">Año</Label>
            <Input type="number" value={año} onChange={e => setAño(Number(e.target.value))}
              className="w-28 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Cuota mensual ($)</Label>
              <Input type="number" min="0" step="0.01" value={config.montoCuotaMensual}
                onChange={e => setConfig(c => ({ ...c, montoCuotaMensual: e.target.value }))}
                placeholder="0.00" className="text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Cuota anual ($)</Label>
              <Input type="number" min="0" step="0.01" value={config.montoCuotaAnual}
                onChange={e => setConfig(c => ({ ...c, montoCuotaAnual: e.target.value }))}
                placeholder="0.00" className="text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Derecho de jaula ($)</Label>
              <Input type="number" min="0" step="0.01" value={config.montoDerechoJaula}
                onChange={e => setConfig(c => ({ ...c, montoDerechoJaula: e.target.value }))}
                placeholder="0.00" className="text-sm" />
            </div>
          </div>

          {msg && (
            <div className={`flex items-center gap-2 text-xs rounded p-2
              ${msg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-green-50 border border-green-200 text-green-700'}`}>
              {msg.startsWith('Error') ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              {msg}
            </div>
          )}

          <Button onClick={() => { setMsg(''); upsertMut.mutate(config); }}
            disabled={upsertMut.isPending}>
            Guardar tarifas
          </Button>
        </CardContent>
      </Card>

      {/* Datos de la sociedad */}
      {sociedad && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Datos de la sociedad</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['Nombre', sociedad.nombre],
                ['Código', sociedad.codigo],
                ['Provincia', sociedad.provincia],
                ['Dirección', sociedad.direccion],
                ['Teléfono', sociedad.telefono],
                ['Mail', sociedad.mail],
                ['Federación', sociedad.federacion],
              ].map(([l, v]) => v ? (
                <div key={l}>
                  <dt className="text-xs text-muted-foreground">{l}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ) : null)}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'pagos',    label: 'Pagos de cuotas',  icon: DollarSign },
  { id: 'estado',   label: 'Estado de cuenta', icon: FileText },
  { id: 'movim',    label: 'Ingresos / Egresos',icon: TrendingUp },
  { id: 'config',   label: 'Configuración',    icon: Settings },
];

export default function GestionAdminPage() {
  const [tab, setTab] = useState('pagos');
  const { data: config } = useQuery({
    queryKey: ['configCuota', new Date().getFullYear()],
    queryFn: () => getConfigCuota(new Date().getFullYear())
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gestión financiera</h1>
        <p className="text-muted-foreground text-sm">Cuotas, pagos y movimientos de la sociedad</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition
                ${tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-slate-700'}`}>
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'pagos'  && <TabPagos config={config} />}
      {tab === 'estado' && <TabEstadoSocio />}
      {tab === 'movim'  && <TabMovimientos />}
      {tab === 'config' && <TabConfiguracion />}
    </div>
  );
}
