import { Sparkles, Package, Flame } from 'lucide-react';

export function PromoBanner() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 py-3 px-4 md:py-4 md:px-6">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-yellow-300 rounded-full blur-2xl animate-pulse delay-300" />
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
      
      {/* Sparkle decorations */}
      <Sparkles className="absolute top-2 left-4 h-4 w-4 text-yellow-300 opacity-60 animate-pulse" />
      <Sparkles className="absolute bottom-2 right-8 h-3 w-3 text-white opacity-50 animate-pulse delay-500" />
      <Sparkles className="absolute top-3 right-1/3 h-3 w-3 text-yellow-200 opacity-40 animate-pulse delay-700" />
      
      <div className="relative flex items-center justify-center gap-2 md:gap-4 flex-wrap">
        {/* Icon */}
        <div className="hidden sm:flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white/20 backdrop-blur-sm rounded-full shrink-0">
          <Package className="h-5 w-5 md:h-6 md:w-6 text-white" />
        </div>
        
        {/* Text content */}
        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-yellow-300 animate-pulse" />
            <span className="text-white font-black text-base md:text-xl tracking-tight whitespace-nowrap">
              ATACADO
            </span>
            <Flame className="h-5 w-5 text-yellow-300 animate-pulse" />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2">
            <span className="text-yellow-200 font-bold text-sm md:text-lg tracking-wide">
              Acima de 35 peças
            </span>
            <span className="text-white/80 text-xs md:text-sm font-medium">
              em tamanhos variados
            </span>
          </div>
        </div>
        
        {/* Price highlight */}
        <div className="flex items-center gap-1 bg-white text-rose-600 font-black px-4 py-1.5 md:px-6 md:py-2 rounded-full shadow-lg shrink-0">
          <span className="text-lg md:text-2xl">R$ 38</span>
          <span className="text-xs md:text-sm font-bold opacity-80">/peça</span>
        </div>
      </div>
    </div>
  );
}
