import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, Lock, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { useBillingInvoices, useBillingSettings, useGenerateCharge, useCheckPayment } from '@/hooks/useBilling';
import { toast } from 'sonner';

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function BillingPaymentModal() {
  const { data: settings } = useBillingSettings();
  const { data: invoices = [] } = useBillingInvoices();
  const generate = useGenerateCharge();
  const check = useCheckPayment();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Fatura mais antiga em aberto (pendente, atrasada ou bloqueada)
  const open = invoices
    .filter(i => ['PENDENTE', 'ATRASADO', 'BLOQUEADO'].includes(i.status) && !i.paid_at)
    .sort((a, b) => a.reference_month.localeCompare(b.reference_month))[0];

  // Gera QR localmente a partir do "copia e cola" caso o provedor não tenha retornado imagem
  useEffect(() => {
    if (!open) { setQrDataUrl(''); return; }
    if (open.pix_qrcode) {
      setQrDataUrl(open.pix_qrcode.startsWith('data:')
        ? open.pix_qrcode
        : `data:image/png;base64,${open.pix_qrcode}`);
      return;
    }
    if (open.pix_copia_cola) {
      QRCode.toDataURL(open.pix_copia_cola, { width: 320, margin: 1 })
        .then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }
  }, [open?.id, open?.pix_qrcode, open?.pix_copia_cola]);

  // Polling automático: verifica pagamento a cada 20s enquanto há fatura aberta
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => check.mutate(open.id), 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.id]);

  if (!open) return null;

  const blocked = settings?.is_blocked || open.status === 'BLOQUEADO';
  const overdue = open.status === 'ATRASADO';

  const headerTone = blocked ? 'text-red-700' : overdue ? 'text-orange-700' : 'text-amber-700';
  const Icon = blocked ? Lock : overdue ? AlertTriangle : Clock;
  const title = blocked ? 'Site bloqueado — pague para reativar'
    : overdue ? 'Mensalidade em atraso'
    : 'Mensalidade em aberto';

  const hasPix = !!open.pix_copia_cola;

  return (
    <Dialog open modal>
      {/* Sem onOpenChange: o modal só fecha quando a fatura for marcada como PAGA */}
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className={`flex items-center gap-2 ${headerTone}`}>
            <Icon className="h-5 w-5" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>
            Esta janela só será fechada após a confirmação automática do pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground capitalize">
              {open.custom_label
                ? open.custom_label
                : new Date(open.reference_month + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
            <Badge variant="outline" className={
              blocked ? 'border-red-300 bg-red-50 text-red-700'
                : overdue ? 'border-orange-300 bg-orange-50 text-orange-700'
                : 'border-amber-300 bg-amber-50 text-amber-700'
            }>{open.status}</Badge>
          </div>

          <div className="text-center text-3xl font-bold">{formatBRL(open.amount_cents)}</div>

          {!hasPix ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Ainda não há um PIX gerado para esta fatura.
              </p>
              <Button className="w-full" onClick={() => generate.mutate({ invoiceId: open.id }, {
                onSuccess: () => toast.success('PIX gerado'),
                onError: (e: any) => toast.error(e.message ?? 'Falha ao gerar PIX'),
              })} disabled={generate.isPending}>
                {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Gerar PIX agora
              </Button>
            </div>
          ) : (
            <>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR Code PIX" className="mx-auto w-56 h-56 border rounded-lg bg-white" />
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">PIX copia e cola:</p>
                <div className="bg-muted p-3 rounded text-xs break-all font-mono max-h-24 overflow-y-auto">
                  {open.pix_copia_cola}
                </div>
                <Button variant="outline" className="w-full" onClick={() => {
                  navigator.clipboard.writeText(open.pix_copia_cola);
                  toast.success('Código PIX copiado');
                }}>
                  <Copy className="h-4 w-4" /> Copiar código PIX
                </Button>
              </div>

              <Button className="w-full" onClick={() => check.mutate(open.id, {
                onSuccess: (r: any) => {
                  if (r?.paid) toast.success('Pagamento confirmado!');
                  else toast.info('Ainda não identificamos o pagamento. Tentaremos novamente em instantes.');
                },
              })} disabled={check.isPending}>
                {check.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Já paguei — verificar agora
              </Button>

              <p className="text-[11px] text-center text-muted-foreground">
                Verificação automática a cada 20 segundos.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}