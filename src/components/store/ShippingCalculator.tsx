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
  originCep?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  disabled?: boolean;
  onSelectOption?: (option: ShippingOption) => void;
  selectedOption?: ShippingOption | null;
  onCepChange?: (cep: string) => void;
}

export function ShippingCalculator({ 
  weightGrams, 
  valorCents,
  originCep,
  lengthCm,
  widthCm,
  heightCm,
  disabled,
  onSelectOption, 
  selectedOption,
  onCepChange 
}: ShippingCalculatorProps) {
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const calculateDisabled = Boolean(disabled) || isLoading;

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
      const cleanOriginCep = (originCep || '01001000').replace(/\D/g, '');
      const peso = Math.max(1, weightGrams || 300);
      const comprimento = Math.max(1, Math.round(lengthCm || 30));
      const largura = Math.max(1, Math.round(widthCm || 30));
      const altura = Math.max(1, Math.round(heightCm || 2));
      const valorDeclarado = valorCents != null ? Math.max(0, valorCents) / 100 : 50;

      const { data, error: fnError } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          cepOrigem: cleanOriginCep,
          cepDestino: cleanCep,
          peso,
          comprimento,
          largura,
          altura,
          valorDeclarado,
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
        <Label className="font-medium">Calcular Frete Correio</Label>
      </div>
      
      <div className="flex gap-2">
        <Input
          placeholder="Informe o seu CEP"
          value={cep}
          onChange={(e) => handleCepChange(e.target.value)}
          maxLength={9}
          className="flex-1"
        />
        <Button onClick={handleCalculate} disabled={calculateDisabled}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
        </Button>
      </div>

      {disabled && !isLoading && (
        <p className="text-xs text-muted-foreground">
          Carregando medidas do pacote…
        </p>
      )}
      
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
                {option.deadline > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {option.deadline === 1 ? '1 dia útil' : `${option.deadline} dias úteis`}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Prazo a combinar</p>
                )}
              </div>
              <span className="font-semibold">
                {option.price > 0 ? formatPrice(option.price) : 'A combinar'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
