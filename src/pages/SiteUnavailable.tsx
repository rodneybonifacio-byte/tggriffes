import { MessageCircle, Clock, Lock, Instagram } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import logoImage from '@/assets/logo.png';

export default function SiteUnavailable() {
  const { data: settings } = useStoreSettings();
  const phone = settings?.seller_whatsapp?.replace(/\D/g, '');
  const waLink = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent('Olá! Vi que a loja está em manutenção. Posso fazer um pedido por aqui?')}`
    : null;
  const storeName = settings?.store_name || 'TG Griffes';

  return (
    <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center p-6">
      {/* subtle texture */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      <div className="absolute top-0 inset-x-0 h-1 bg-black" />

      <div className="relative max-w-lg w-full">
        <div className="bg-white border border-black/10 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)] p-10 md:p-14 text-center space-y-8">
          {/* Logo */}
          <img src={logoImage} alt={storeName} className="h-16 md:h-20 mx-auto" />

          <div className="h-px w-16 mx-auto bg-black/20" />

          {/* Title */}
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.4em] text-black/50 font-medium">
              Aviso
            </p>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight text-black leading-tight">
              Loja temporariamente<br />
              <span className="font-semibold">indisponível</span>
            </h1>
            <p className="text-sm text-black/60 leading-relaxed max-w-sm mx-auto">
              Estamos finalizando ajustes para melhor atendê-lo.
              Nosso atendimento via WhatsApp continua ativo para receber seu pedido.
            </p>
          </div>

          {/* Status pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.03] border border-black/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-black/70 uppercase tracking-wider">Atendimento ativo</span>
          </div>

          {/* WhatsApp CTA */}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-black hover:bg-black/90 text-white font-medium tracking-wide uppercase text-sm transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com um vendedor
            </a>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-black/40 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Voltamos em breve
          </span>
          <span className="text-black/20">•</span>
          <Link
            to="/admin/login"
            className="flex items-center gap-1.5 hover:text-black transition-colors"
          >
            <Lock className="h-3 w-3" />
            Admin
          </Link>
        </div>

        <p className="mt-10 text-center text-[10px] uppercase tracking-[0.3em] text-black/30">
          {storeName} · Atacado
        </p>
      </div>
    </div>
  );
}