import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPremios, updatePremio, inicializarPremios } from '@/api/premio.api';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';

function PremioRow({ premio, onSave, saving }) {
  const [form, setForm] = useState({
    puntosIndividual: String(premio.puntosIndividual ?? 0),
    puntosDuos:       String(premio.puntosDuos       ?? 0),
    puntosCuartetos:  String(premio.puntosCuartetos  ?? 0),
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    onSave(premio.tipo, {
      puntosIndividual: parseInt(form.puntosIndividual) || 0,
      puntosDuos:       parseInt(form.puntosDuos)       || 0,
      puntosCuartetos:  parseInt(form.puntosCuartetos)  || 0,
    }, () => { setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); });
  };

  return (
    <tr className="border-b last:border-0 hover:bg-slate-50">
      <td className="px-4 py-2 font-mono font-bold text-sm text-primary w-16">{premio.tipo}</td>
      <td className="px-4 py-2 text-sm text-slate-600">{premio.label}</td>
      <td className="px-4 py-2">
        <Input
          type="number" min="0" step="1"
          value={form.puntosIndividual}
          onChange={e => set('puntosIndividual', e.target.value)}
          className="h-7 w-16 text-center text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number" min="0" step="1"
          value={form.puntosDuos}
          onChange={e => set('puntosDuos', e.target.value)}
          className="h-7 w-16 text-center text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number" min="0" step="1"
          value={form.puntosCuartetos}
          onChange={e => set('puntosCuartetos', e.target.value)}
          className="h-7 w-16 text-center text-sm"
        />
      </td>
      <td className="px-4 py-2 text-right">
        {saved ? (
          <span className="flex items-center gap-1 justify-end text-green-600 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Guardado
          </span>
        ) : (
          <Button size="sm" variant={dirty ? 'default' : 'ghost'} className="h-7 px-2"
            onClick={handleSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
        )}
      </td>
    </tr>
  );
}

export default function PremiosPage() {
  const queryClient = useQueryClient();
  const [savingTipo, setSavingTipo] = useState(null);

  const { data: premios = [], isLoading } = useQuery({
    queryKey: ['premios'],
    queryFn: getPremios
  });

  const initMutation = useMutation({
    mutationFn: inicializarPremios,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['premios'] })
  });

  const updateMutation = useMutation({
    mutationFn: ({ tipo, data }) => updatePremio(tipo, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['premios'] })
  });

  const handleSave = (tipo, data, onDone) => {
    setSavingTipo(tipo);
    updateMutation.mutate({ tipo, data }, {
      onSettled: () => setSavingTipo(null),
      onSuccess: onDone
    });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader
        title="Premios y Puntuación"
        description="Configure los puntos asignados a cada premio por tipo de presentación"
        backTo="/admin/configuracion"
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Tabla de Puntos</CardTitle>
            <Button variant="outline" size="sm" onClick={() => initMutation.mutate()}
              disabled={initMutation.isPending}>
              {initMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Cargar valores por defecto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Tipo</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Premio</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Individual</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Dúos</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Cuartetos</th>
                    <th className="px-4 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {premios.map(p => (
                    <PremioRow
                      key={p.tipo}
                      premio={p}
                      onSave={handleSave}
                      saving={savingTipo === p.tipo}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Los puntos deben ser números enteros. Los valores se usan para calcular la tabla de posiciones en el catálogo PDF.
        CA = Campeón Argentino · RC = Reservado Campeón · 1°–10° = Menciones.
      </p>
    </div>
  );
}
