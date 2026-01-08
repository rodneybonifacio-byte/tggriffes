import { useMemo } from 'react';
import { CartItem } from '@/hooks/useCart';
import { getColorDisplayName } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Layers, Palette, Ruler } from 'lucide-react';

interface VariationsSummaryProps {
  items: CartItem[];
}

interface SizeSummary {
  size: string;
  count: number;
}

interface ColorSummary {
  color: string;
  displayName: string;
  count: number;
}

export function VariationsSummary({ items }: VariationsSummaryProps) {
  const { sizesSummary, colorsSummary, totalPieces } = useMemo(() => {
    const sizesMap = new Map<string, number>();
    const colorsMap = new Map<string, { displayName: string; count: number }>();
    let total = 0;

    for (const item of items) {
      total += item.quantity;
      
      // Count sizes
      const currentSize = sizesMap.get(item.size) || 0;
      sizesMap.set(item.size, currentSize + item.quantity);
      
      // Count colors
      if (item.color) {
        const existing = colorsMap.get(item.color);
        if (existing) {
          existing.count += item.quantity;
        } else {
          colorsMap.set(item.color, {
            displayName: getColorDisplayName(item.color),
            count: item.quantity,
          });
        }
      }
    }

    // Sort sizes by common order
    const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'XXGG', 'EG', 'EGG'];
    const sizesSummary: SizeSummary[] = Array.from(sizesMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => {
        const aIndex = sizeOrder.indexOf(a.size.toUpperCase());
        const bIndex = sizeOrder.indexOf(b.size.toUpperCase());
        if (aIndex === -1 && bIndex === -1) return a.size.localeCompare(b.size);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

    // Sort colors alphabetically
    const colorsSummary: ColorSummary[] = Array.from(colorsMap.entries())
      .map(([color, data]) => ({ color, ...data }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));

    return { sizesSummary, colorsSummary, totalPieces: total };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-[1px]"
    >
      {/* Gradient border effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-violet-500/20 rounded-2xl" />
      
      <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800/95 to-zinc-900 rounded-2xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
              <Layers className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Resumo das Variações</h3>
              <p className="text-[11px] text-zinc-400">Conferência rápida do pedido</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Total</span>
            <span className="text-lg font-black text-white tabular-nums">{totalPieces}</span>
            <span className="text-[10px] text-zinc-500">pcs</span>
          </div>
        </div>

        {/* Two columns grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Sizes Column */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="space-y-2.5"
          >
            <div className="flex items-center gap-2 px-1">
              <Ruler className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-sky-400">Tamanhos</span>
            </div>
            <div className="space-y-1.5">
              {sizesSummary.map((item, index) => (
                <motion.div
                  key={item.size}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.05, duration: 0.25 }}
                  className="group relative flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500/10 to-transparent border border-sky-500/20 hover:border-sky-500/40 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 group-hover:scale-125 transition-transform" />
                    <span className="text-sm font-bold text-white">{item.size}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-black text-sky-400 tabular-nums">{item.count}</span>
                    <span className="text-[10px] text-zinc-500">un</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Colors Column */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="space-y-2.5"
          >
            <div className="flex items-center gap-2 px-1">
              <Palette className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-violet-400">Cores</span>
            </div>
            <div className="space-y-1.5">
              {colorsSummary.length > 0 ? (
                colorsSummary.map((item, index) => (
                  <motion.div
                    key={item.color}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.05, duration: 0.25 }}
                    className="group relative flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500/10 to-transparent border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 group-hover:scale-125 transition-transform" />
                      <span className="text-sm font-medium text-white truncate max-w-[80px]">{item.displayName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-black text-violet-400 tabular-nums">{item.count}</span>
                      <span className="text-[10px] text-zinc-500">un</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                  <span className="text-xs text-zinc-500 italic">Sem cores</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Glowing orbs for visual effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>
    </motion.div>
  );
}
