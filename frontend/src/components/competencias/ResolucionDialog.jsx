import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Opciones cuando quitar un ave deja un dúo/cuarteto incompleto
 * (respuesta 409 REQUIERE_RESOLUCION del backend).
 */
export default function ResolucionDialog({ conflicto, onElegir, onCancelar, loading }) {
  return (
    <Dialog open={!!conflicto} onOpenChange={(v) => !v && onCancelar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{conflicto?.tipo === 'duos' ? 'Dúo incompleto' : 'Cuarteto incompleto'}</DialogTitle>
          <DialogDescription>{conflicto?.error}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {conflicto?.opciones?.map((o, i) => (
            <Button
              key={o.valor}
              variant={o.valor === 'eliminar' ? 'destructive' : 'outline'}
              disabled={loading}
              onClick={() => onElegir(o.valor)}
            >
              {i + 1}. {o.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar} disabled={loading}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
