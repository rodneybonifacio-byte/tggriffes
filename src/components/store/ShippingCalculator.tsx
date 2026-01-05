import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, Loader2 } from 'lucide-react';
import { formatCEP, validateCEP, formatPrice } from '@/lib/utils';

export interface ShippingOption {
  service: string;
  price: number;
  deadline: number;
}

interface ShippingCalculatorProps {
  weightGrams?: number | null;
  onSelectOption?: (option: ShippingOption) => void;
  selectedOption?: ShippingOption | null;
  onCepChange?: (cep: string) => void;
}

// Mock shipping calculation (replace with BRHUB API integration)
function mockCalculateShipping(cep: string): Promise<ShippingOption[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { service: 'PAC', price: 1990, deadline: 8 },
        { service: 'SEDEX', price: 2990, deadline: 3 },
        { service: 'SEDEX 10', price: 4990, deadline: 1 },
      ]);
    }, 1000);
  });
}

export function ShippingCalculator({ 
  weightGrams, 
  onSelectOption, 
  selectedOption,
  onCepChange 
}: ShippingCalculatorProps) {
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [error, setError] = useState('');

  const handleCepChange = (value: string) => {
    const formatted = formatCEP(value);
    setCep(formatted);
    onCepChange?.(value.replace(/\D/g, ''));
  };

  const handleCalculate = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    
    if (!validateCEP(cleanCep)) {
      setError('CEP inválido. Digite 8 números.');
      return;
    }

    setError('');
    setIsLoading(true);
    
    try {
      const results = await mockCalculateShipping(cleanCep);
      setOptions(results);
    } catch (err) {
      setError('Erro ao calcular frete. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-muted-foreground" />
        <Label className="font-medium">Calcular Frete</Label>
      </div>
      
      <div className="flex gap-2">
        <Input
          placeholder="00000-000"
          value={cep}
          onChange={(e) => handleCepChange(e.target.value)}
          maxLength={9}
          className="flex-1"
        />
        <Button onClick={handleCalculate} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
        </Button>
      </div>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {options.length > 0 && (
        <div className="space-y-2 pt-2">
          {options.map((option) => (
            <button
              key={option.service}
              onClick={() => onSelectOption?.(option)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                selectedOption?.service === option.service
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="text-left">
                <p className="font-medium">{option.service}</p>
                <p className="text-sm text-muted-foreground">
                  {option.deadline === 1 ? '1 dia útil' : `${option.deadline} dias úteis`}
                </p>
              </div>
              <span className="font-semibold">{formatPrice(option.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
