import { Link } from 'react-router-dom';
import { AlertTriangle, Lock } from 'lucide-react';
import { useBillingSettings, useBillingInvoices } from '@/hooks/useBilling';

export function BillingBanner() {
  const { data: settings } = useBillingSettings();
  const { data: invoices = [] } = useBillingInvoices();

  const open = invoices.find(i => ['PENDENTE', 'ATRASADO', 'BLOQUEADO'].includes(i.status));
  if (!open) return null;

  const blocked = settings?.is_blocked || open.status === 'BLOQUEADO';
  const overdue = open.status === 'ATRASADO';

  const tone = blocked
    ? 'from-red-600 to-red-700 text-white'
    : overdue
      ? 'from-orange-500 to-amber-500 text-white'
      : 'from-amber-100 to-yellow-100 text-amber-900';

  const Icon = blocked ? Lock : AlertTriangle;
  const title = blocked
    ? 'Site bloqueado por inadimplência'
    : overdue ? 'Mensalidade em atraso' : 'Mensalidade em aberto';
  const desc = blocked
    ? 'Sua loja pública está fora do ar. Quite a fatura para reativar imediatamente.'
    : overdue ? 'Pague agora para evitar bloqueio do site.'
    : `Vence em ${new Date(open.due_date + 'T12:00:00Z').toLocaleDateString('pt-BR')}.`;

  return (
    <Link to="/admin/cobranca"
      className={`block bg-gradient-to-r ${tone} px-4 py-3 shadow-md hover:opacity-95 transition`}>
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <Icon className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs opacity-90 truncate">{desc}</p>
        </div>
        <span className="text-xs font-medium underline shrink-0">Pagar PIX →</span>
      </div>
    </Link>
  );
}