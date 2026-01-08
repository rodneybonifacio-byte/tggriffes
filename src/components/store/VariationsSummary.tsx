import { useMemo } from 'react';
import { CartItem } from '@/hooks/useCart';
import { getColorDisplayName } from '@/lib/utils';
import { motion } from 'framer-motion';

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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden"
    >
      {/* Main container with animated gradient border */}
      <div className="relative rounded-3xl p-[2px] bg-gradient-to-br from-amber-400 via-orange-500 to-red-500">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 blur-xl opacity-40 animate-pulse" />
        
        <div className="relative rounded-3xl bg-black p-6 overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.4),transparent_40%)]" />
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(239,68,68,0.4),transparent_40%)]" />
          </div>

          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl blur-md opacity-60" />
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight uppercase">Conferência</h3>
                <p className="text-xs text-amber-400/80 font-medium">Resumo do pedido</p>
              </div>
            </div>
            
            {/* Total badge */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl blur-lg opacity-50" />
              <div className="relative px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500">
                <div className="text-center">
                  <span className="block text-3xl font-black text-black tabular-nums leading-none">{totalPieces}</span>
                  <span className="text-[10px] font-bold text-black/70 uppercase tracking-widest">peças</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Two columns */}
          <div className="relative grid grid-cols-2 gap-4">
            {/* Sizes Column */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📏</span>
                <span className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">Tamanhos</span>
              </div>
              
              <div className="space-y-2">
                {sizesSummary.map((item, index) => (
                  <motion.div
                    key={item.size}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.05 }}
                    className="group relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-all">
                      <span className="text-base font-bold text-white">{item.size}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-cyan-400 tabular-nums">{item.count}</span>
                        <span className="text-[10px] text-white/40 font-medium">un</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Colors Column */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🎨</span>
                <span className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">Cores</span>
              </div>
              
              <div className="space-y-2">
                {colorsSummary.length > 0 ? (
                  colorsSummary.map((item, index) => (
                    <motion.div
                      key={item.color}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + index * 0.05 }}
                      className="group relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-fuchsia-500/50 transition-all">
                        <span className="text-sm font-medium text-white truncate max-w-[70px]">{item.displayName}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-fuchsia-400 tabular-nums">{item.count}</span>
                          <span className="text-[10px] text-white/40 font-medium">un</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-sm text-white/40 italic">Cor única</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Bottom sparkle effect */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
        </div>
      </div>
    </motion.div>
  );
}
