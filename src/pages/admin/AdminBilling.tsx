import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBillingInvoices, useBillingSettings, useGenerateCharge, useCheckPayment } from '@/hooks/useBilling';
import { Copy, RefreshCw, Zap, AlertTriangle, CheckCircle2, Clock, Lock } from 'lucide-react';
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

  return (
    <AdminLayout title="Cobrança BRHUB">
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
                    <TableCell className="capitalize">{formatMonth(inv.reference_month)}</TableCell>
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
            <DialogTitle>PIX — {current && formatMonth(current.reference_month)}</DialogTitle>
          </DialogHeader>
          {current && (
            <div className="space-y-4">
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