import { MessageCircle, Sparkles, Package } from 'lucide-react';
import { useStoreSettings } from '@/hooks/useStoreSettings';

export function PromoBanner() {
  const { data: settings } = useStoreSettings();
  
  const whatsappNumber = settings?.seller_whatsapp?.replace(/\D/g, '');
  const message = encodeURIComponent('Olá! Tenho interesse em comprar acima de 50 peças e gostaria de saber sobre os preços especiais.');
  const whatsappLink = whatsappNumber 
    ? `https://wa.me/55${whatsappNumber}?text=${message}` 
    : null;

  if (!whatsappLink) return null;

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 py-3 px-4 md:py-4 md:px-6">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-yellow-300 rounded-full blur-2xl animate-pulse delay-300" />
        </div>
        
        {/* Sparkle decorations */}
        <Sparkles className="absolute top-2 left-4 h-4 w-4 text-yellow-300 opacity-60 animate-pulse" />
        <Sparkles className="absolute bottom-2 right-8 h-3 w-3 text-white opacity-50 animate-pulse delay-500" />
        <Sparkles className="absolute top-3 right-1/3 h-3 w-3 text-yellow-200 opacity-40 animate-pulse delay-700" />
        
        <div className="relative flex items-center justify-center gap-2 md:gap-4">
          {/* Icon */}
          <div className="hidden sm:flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white/20 backdrop-blur-sm rounded-full shrink-0 group-hover:scale-110 transition-transform">
            <Package className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          
          {/* Text content */}
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm md:text-lg whitespace-nowrap">
                🔥 ACIMA DE 50 PEÇAS
              </span>
              <span className="hidden md:inline text-white/80">•</span>
            </div>
            <span className="text-white/90 text-xs md:text-base font-medium">
              Preços especiais para atacado!
            </span>
          </div>
          
          {/* CTA Button */}
          <div className="flex items-center gap-2 bg-white text-emerald-700 font-bold px-3 py-1.5 md:px-5 md:py-2 rounded-full shadow-lg group-hover:bg-yellow-300 group-hover:text-emerald-800 transition-all group-hover:scale-105 shrink-0">
            <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
            <span className="text-xs md:text-sm whitespace-nowrap">Fale com vendedor</span>
          </div>
        </div>
      </div>
    </a>
  );
}
