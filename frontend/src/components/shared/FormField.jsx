import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function FormField({ label, error, required, className, inputProps }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input {...inputProps} className={cn(error && 'border-red-500', inputProps?.className)} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
