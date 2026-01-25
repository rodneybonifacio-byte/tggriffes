import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Search, X, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

export interface HistoryFilters {
  search: string;
  movementType: string;
  origin: string;
  dateRange: DateRange | undefined;
}

interface StockHistoryFiltersProps {
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
  onClear: () => void;
}

export function StockHistoryFilters({ filters, onFiltersChange, onClear }: StockHistoryFiltersProps) {
  const hasActiveFilters = 
    filters.search || 
    filters.movementType !== 'all' || 
    filters.origin !== 'all' ||
    filters.dateRange?.from;

  return (
    <div className="bg-card rounded-lg border p-4 mb-4">
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        {/* Movement Type */}
        <Select 
          value={filters.movementType} 
          onValueChange={(v) => onFiltersChange({ ...filters, movementType: v })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="entrada">Entrada</SelectItem>
            <SelectItem value="saida">Saída</SelectItem>
            <SelectItem value="venda">Venda</SelectItem>
            <SelectItem value="cancelamento">Cancelamento</SelectItem>
            <SelectItem value="ajuste">Ajuste</SelectItem>
            <SelectItem value="shopify_sale">Shopify</SelectItem>
          </SelectContent>
        </Select>

        {/* Origin */}
        <Select 
          value={filters.origin} 
          onValueChange={(v) => onFiltersChange({ ...filters, origin: v })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Origens</SelectItem>
            <SelectItem value="shopify">Shopify</SelectItem>
            <SelectItem value="local">Local</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
              <Calendar className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                    {format(filters.dateRange.to, "dd/MM", { locale: ptBR })}
                  </>
                ) : (
                  format(filters.dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                <span>Período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={filters.dateRange?.from}
              selected={filters.dateRange}
              onSelect={(range) => onFiltersChange({ ...filters, dateRange: range })}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
