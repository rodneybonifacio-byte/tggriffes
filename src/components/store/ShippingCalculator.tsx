import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, Loader2 } from 'lucide-react';
import { formatCEP, validateCEP, formatPrice } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface ShippingOption {
  service: string;
  price: number;
  deadline: number;
}

interface ShippingCalculatorProps {
  weightGrams?: number | null;
  valorCents?: number | null;
  onSelectOption?: (option: ShippingOption) => void;
  selectedOption?: ShippingOption | null;
  onCepChange?: (cep: string) => void;
}

export function ShippingCalculator({ 
  weightGrams, 
  valorCents,
  onSelectOption, 
  selectedOption,
  onCepChange 
}: ShippingCalculatorProps) {
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

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
    setWarning('');
    setIsLoading(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          cepOrigem: '01001000', // CEP padrão, será substituído pelo da loja
          cepDestino: cleanCep,
          peso: weightGrams || 300, // 300g padrão
          comprimento: 30, // 30cm padrão
          largura: 30, // 30cm padrão
          altura: 2, // 2cm padrão
          valorDeclarado: valorCents ? valorCents / 100 : 50,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.options) {
        setOptions(data.options);
        if (data.warning) {
          setWarning(data.warning);
        }
      } else {
        throw new Error('Resposta inválida');
      }
    } catch (err) {
      console.error('Shipping calculation error:', err);
      setError('Erro ao calcular frete. Tente novamente.');
      // Fallback para opções padrão
      setOptions([
        { service: 'PAC', price: 1990, deadline: 8 },
        { service: 'SEDEX', price: 2990, deadline: 3 },
      ]);
      setWarning('Usando valores estimados');
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

      {warning && (
        <p className="text-sm text-yellow-600">{warning}</p>
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
