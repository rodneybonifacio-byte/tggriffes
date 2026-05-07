import { Wrench, Clock } from 'lucide-react';

export default function SiteUnavailable() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-20"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, hsl(var(--primary)/0.4), transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--primary)/0.3), transparent 60%)' }} />
      <div className="relative max-w-xl w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl shadow-orange-500/30">
          <Wrench className="h-12 w-12 text-white" strokeWidth={2.5} />
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
            Loja temporariamente indisponível
          </h1>
          <p className="text-lg text-zinc-400 max-w-md mx-auto">
            Estamos realizando uma manutenção programada. Voltamos em breve!
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 backdrop-blur">
          <Clock className="h-4 w-4 text-amber-400" />
          <span className="text-sm text-zinc-300">Atendimento via WhatsApp permanece ativo</span>
        </div>
        <p className="text-xs text-zinc-600 pt-8">
          Para mais informações, entre em contato com nossa equipe.
        </p>
      </div>
    </div>
  );
}