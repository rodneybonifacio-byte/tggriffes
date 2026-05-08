import { Wrench, MessageCircle, Sparkles, Clock, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStoreSettings } from '@/hooks/useStoreSettings';

export default function SiteUnavailable() {
  const { data: settings } = useStoreSettings();
  const phone = settings?.seller_whatsapp?.replace(/\D/g, '');
  const waLink = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent('Olá! Vi que a loja está em manutenção. Posso fazer um pedido por aqui?')}`
    : null;
  const storeName = settings?.store_name || 'TG Griffes';

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#09090b] flex items-center justify-center p-6">
      {/* Animated gradient blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-500/20 blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-orange-600/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative max-w-lg w-full">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl p-8 md:p-12 text-center space-y-7">
          {/* Logo or store name */}
          {settings?.store_logo_url ? (
            <img src={settings.store_logo_url} alt={storeName} className="h-10 mx-auto opacity-90" />
          ) : (
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 font-medium">{storeName}</p>
          )}

          {/* Icon */}
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 blur-2xl opacity-50 animate-pulse" />
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl shadow-orange-500/40 rotate-3">
              <Wrench className="h-11 w-11 text-white -rotate-3" strokeWidth={2.5} />
            </div>
            <Sparkles className="absolute -top-2 -right-3 h-5 w-5 text-amber-300 animate-pulse" />
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Estamos em manutenção
            </h1>
            <p className="text-zinc-400 leading-relaxed">
              Nossa loja online está passando por uma atualização rápida.<br className="hidden sm:block" />
              Voltamos em instantes — obrigado pela paciência!
            </p>
          </div>

          {/* Status pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-medium text-emerald-300">Atendimento ativo no WhatsApp</span>
          </div>

          {/* WhatsApp CTA */}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all hover:scale-[1.02]"
            >
              <MessageCircle className="h-5 w-5" />
              Falar com a loja no WhatsApp
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </a>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Última atualização: agora há pouco
          </span>
          <span className="text-zinc-700">•</span>
          <Link
            to="/admin/login"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Lock className="h-3 w-3" />
            Acesso administrativo
          </Link>
        </div>
      </div>
    </div>
  );
}