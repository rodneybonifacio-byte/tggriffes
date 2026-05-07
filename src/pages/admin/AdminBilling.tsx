import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBillingInvoices, useBillingSettings, useGenerateCharge, useCheckPayment } from '@/hooks/useBilling';
import { Copy, RefreshCw, Zap, AlertTriangle, CheckCircle2, Clock, Lock, Headphones, Wrench, Server, Sparkles, Crown, BadgePercent } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, string> = {
  PAGO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PENDENTE: 'bg-amber-100 text-amber-800 border-amber-300',
  ATRASADO: 'bg-orange-100 text-orange-800 border-orange-300',
  BLOQUEADO: 'bg-red-100 text-red-800 border-red-300',
  CANCELADO: 'bg-zinc-100 text-zinc-700 border-zinc-300',
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatMonth(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function AdminBilling() {
  const { data: settings } = useBillingSettings();
  const { data: invoices = [], isLoading } = useBillingInvoices();
  const generate = useGenerateCharge();
  const check = useCheckPayment();
  const [open, setOpen] = useState<string | null>(null);
  const current = invoices.find(i => i.id === open);

  const monthlyCents = settings?.monthly_amount_cents ?? 0;
  const annualFullCents = monthlyCents * 12;
  const annualDiscountedCents = Math.round(annualFullCents * 0.8);
  const annualSavingsCents = annualFullCents - annualDiscountedCents;

  const handleAnnual = () => {
    generate.mutate({ plan: 'annual' }, {
      onSuccess: (res: any) => {
        if (res?.invoice?.id) {
          setOpen(res.invoice.id);
          toast.success('PIX anual gerado!');
        }
      },
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <AdminLayout title="Mensalidade">
      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle className="text-lg">O que está incluso na sua mensalidade</CardTitle>
          <CardDescription>
            Sua mensalidade garante que a loja continue operando com performance, segurança e evolução contínua.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex gap-3">
            <div className="rounded-lg bg-primary/10 p-2 h-fit"><Headphones className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="font-semibold text-sm">Suporte dedicado</p>
              <p className="text-xs text-muted-foreground">Atendimento prioritário para dúvidas e incidentes.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-lg bg-primary/10 p-2 h-fit"><Wrench className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="font-semibold text-sm">Manutenção contínua</p>
              <p className="text-xs text-muted-foreground">Correções, atualizações de segurança e monitoramento.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-lg bg-primary/10 p-2 h-fit"><Server className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="font-semibold text-sm">Hospedagem</p>
              <p className="text-xs text-muted-foreground">Infraestrutura, banco de dados, CDN e backups.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-lg bg-primary/10 p-2 h-fit"><Sparkles className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="font-semibold text-sm">Ajustes e melhorias</p>
              <p className="text-xs text-muted-foreground">Pequenos ajustes de layout, textos e novas funcionalidades.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {settings?.is_blocked && (
        <Card className="mb-6 border-red-300 bg-red-50">
          <CardHeader className="flex-row items-center gap-3">
            <Lock className="h-6 w-6 text-red-700" />
            <div>
              <CardTitle className="text-red-900">Site bloqueado por inadimplência</CardTitle>
              <CardDescription className="text-red-700">
                A loja pública está exibindo página de indisponibilidade. Pague a fatura em aberto para reativar.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Chamariz: Plano Anual com 20% OFF */}
      {settings && (
        <Card className="mb-6 overflow-hidden border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-amber-500 p-1.5">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                  <Badge className="bg-rose-600 hover:bg-rose-600 text-white border-0">
                    <BadgePercent className="h-3 w-3 mr-1" /> 20% OFF
                  </Badge>
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Oferta exclusiva
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-zinc-900">
                  Pague 1 ano e economize {formatBRL(annualSavingsCents)}
                </h3>
                <p className="text-sm text-zinc-700">
                  Garanta 12 meses de mensalidade com <strong>20% de desconto</strong>.
                  Sem reajuste, sem preocupação, sem cobrança mensal.
                </p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-sm text-zinc-500 line-through">
                    {formatBRL(annualFullCents)}
                  </span>
                  <span className="text-3xl font-extrabold text-rose-700">
                    {formatBRL(annualDiscountedCents)}
                  </span>
                  <span className="text-xs text-zinc-600">
                    equivale a {formatBRL(Math.round(annualDiscountedCents / 12))}/mês
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <Button
                  size="lg"
                  onClick={handleAnnual}
                  disabled={generate.isPending}
                  className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white shadow-md text-base h-12 px-8"
                >
                  <Zap className="h-5 w-5" />
                  {generate.isPending ? 'Gerando PIX...' : 'Quero pagar 1 ano'}
                </Button>
                <p className="text-[11px] text-zinc-600 text-center md:text-right">
                  PIX gerado na hora • válido por 7 dias
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Mensalidade</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">
            {settings ? formatBRL(settings.monthly_amount_cents) : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Vencimento</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">Dia {settings?.charge_day ?? 6}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Tolerância</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">{settings?.grace_days ?? 3} dias</CardContent>
        </Card>
      </div>

      <div className="flex gap-2 mb-4">
        <Button onClick={() => generate.mutate(undefined, {
          onSuccess: () => toast.success('Fatura gerada/atualizada'),
          onError: (e: any) => toast.error(e.message),
        })} disabled={generate.isPending}>
          <Zap className="h-4 w-4" /> Gerar PIX do mês
        </Button>
        <Button variant="outline" onClick={() => check.mutate(undefined, {
          onSuccess: () => toast.success('Status atualizado'),
        })} disabled={check.isPending}>
          <RefreshCw className={`h-4 w-4 ${check.isPending ? 'animate-spin' : ''}`} /> Verificar pagamentos
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico de faturas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Carregando…</p> :
            invoices.length === 0 ? <p className="text-muted-foreground">Nenhuma fatura ainda. Clique em "Gerar PIX do mês".</p> :
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="capitalize">{inv.custom_label ?? formatMonth(inv.reference_month)}</TableCell>
                    <TableCell>{formatBRL(inv.amount_cents)}</TableCell>
                    <TableCell>{new Date(inv.due_date + 'T12:00:00Z').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[inv.status] ?? ''}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell>{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell className="text-right">
                      {inv.pix_copia_cola && inv.status !== 'PAGO' && (
                        <Button size="sm" variant="outline" onClick={() => setOpen(inv.id)}>Ver PIX</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PIX — {current && (current.custom_label ?? formatMonth(current.reference_month))}</DialogTitle>
          </DialogHeader>
          {current && (
            <div className="space-y-4">
              <div className="text-center text-sm text-muted-foreground capitalize">
                {current.custom_label ?? formatMonth(current.reference_month)}
              </div>
              {current.pix_qrcode && (
                <img src={current.pix_qrcode.startsWith('data:') ? current.pix_qrcode : `data:image/png;base64,${current.pix_qrcode}`}
                  alt="QR Code PIX" className="mx-auto w-56 h-56 border rounded-lg" />
              )}
              <div className="text-center text-2xl font-bold">{formatBRL(current.amount_cents)}</div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">PIX copia e cola:</p>
                <div className="bg-muted p-3 rounded text-xs break-all font-mono">{current.pix_copia_cola}</div>
                <Button variant="outline" className="w-full" onClick={() => {
                  navigator.clipboard.writeText(current.pix_copia_cola);
                  toast.success('Copiado!');
                }}>
                  <Copy className="h-4 w-4" /> Copiar código PIX
                </Button>
              </div>
              <Button className="w-full" onClick={() => check.mutate(current.id)} disabled={check.isPending}>
                <RefreshCw className={`h-4 w-4 ${check.isPending ? 'animate-spin' : ''}`} /> Já paguei — verificar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}