import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVisitsAnalytics } from '@/hooks/useVisitsAnalytics';
import {
  Eye, Users, UserPlus, Repeat, Loader2, MessageCircle, Globe,
  Instagram, Facebook, Search as SearchIcon, Link as LinkIcon, Package,
  Smartphone, Monitor, Tablet, Mail, DollarSign, Share2, ExternalLink, Megaphone
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { Link } from 'react-router-dom';

const SOURCE_META: Record<string, { label: string; icon: any; color: string }> = {
  whatsapp:  { label: 'WhatsApp',  icon: MessageCircle, color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  direct:    { label: 'Direto',    icon: Globe,         color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  google:    { label: 'Google',    icon: SearchIcon,    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  instagram: { label: 'Instagram', icon: Instagram,     color: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' },
  facebook:  { label: 'Facebook',  icon: Facebook,      color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  other:     { label: 'Outros',    icon: LinkIcon,      color: 'bg-muted text-muted-foreground' },
};

function sourceMeta(source: string) {
  const key = (source || '').toLowerCase();
  if (SOURCE_META[key]) return SOURCE_META[key];
  if (key.includes('tiktok')) return { label: 'TikTok', icon: Share2, color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300' };
  if (key.includes('youtube')) return { label: 'YouTube', icon: Share2, color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
  if (key.includes('telegram')) return { label: 'Telegram', icon: Share2, color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' };
  if (key.includes('linkedin')) return { label: 'LinkedIn', icon: Share2, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' };
  return { label: source, icon: LinkIcon, color: 'bg-muted text-muted-foreground' };
}

const MEDIUM_META: Record<string, { label: string; icon: any; color: string }> = {
  social:   { label: 'Redes sociais', icon: Share2,    color: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' },
  search:   { label: 'Busca',         icon: SearchIcon, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  paid:     { label: 'Anúncios',      icon: DollarSign, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  email:    { label: 'E-mail',        icon: Mail,      color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  referral: { label: 'Referência',    icon: ExternalLink, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' },
  direct:   { label: 'Direto',        icon: Globe,     color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};
function mediumMeta(m: string) {
  return MEDIUM_META[m] || { label: m, icon: LinkIcon, color: 'bg-muted text-muted-foreground' };
}

const DEVICE_META: Record<string, { label: string; icon: any }> = {
  mobile:  { label: 'Mobile',  icon: Smartphone },
  desktop: { label: 'Desktop', icon: Monitor },
  tablet:  { label: 'Tablet',  icon: Tablet },
};
function deviceMeta(d: string) {
  return DEVICE_META[d] || { label: d || 'Desconhecido', icon: Monitor };
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function VisitsAnalyticsCard() {
  const [days, setDays] = useState<7 | 30>(30);
  const { data, isLoading } = useVisitsAnalytics(days);

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5" /> Visitas do Site
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const chartData = data.dailyTrend.map(d => ({
    date: formatDateLabel(d.date),
    'Visitas': d.views,
    'Visitantes únicos': d.uniqueVisitors,
  }));

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Eye className="h-5 w-5" /> Visitas do Site
        </CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant={days === 7 ? 'default' : 'outline'} onClick={() => setDays(7)}>7 dias</Button>
          <Button size="sm" variant={days === 30 ? 'default' : 'outline'} onClick={() => setDays(30)}>30 dias</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <Eye className="h-4 w-4" />
              <span className="text-xs font-medium">Visitas Totais</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {data.totalViews.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">últimos {days} dias</div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Visitantes Únicos</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {data.uniqueVisitors.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">por dispositivo</div>
          </div>

          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-2">
              <UserPlus className="h-4 w-4" />
              <span className="text-xs font-medium">Novos</span>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {data.newVisitors.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">primeira visita</div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <Repeat className="h-4 w-4" />
              <span className="text-xs font-medium">Recorrentes</span>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {data.returningVisitors.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">que já voltaram</div>
          </div>
        </div>

        {/* Trend chart */}
        {chartData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-4">
              Tendência dos últimos {days} dias
            </h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Visitas" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Visitantes únicos" stroke="#9333ea" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Traffic sources */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Origem do tráfego (fonte)
            </h4>
            {data.trafficSources.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="space-y-2">
                {data.trafficSources.slice(0, 8).map(s => {
                  const meta = sourceMeta(s.source);
                  const Icon = meta.icon;
                  return (
                    <div key={s.source} className="flex items-center gap-3">
                      <div className={`flex items-center gap-2 px-2 py-1 rounded ${meta.color} min-w-[110px]`}>
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium truncate max-w-[120px]">{meta.label}</span>
                      </div>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${s.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums w-16 text-right">
                        {s.views} ({s.percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Medium breakdown */}
            <h4 className="text-sm font-medium text-muted-foreground mt-6 mb-3">
              Por canal
            </h4>
            {data.trafficMediums.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.trafficMediums.map(m => {
                  const meta = mediumMeta(m.medium);
                  const Icon = meta.icon;
                  return (
                    <div key={m.medium} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{meta.label}</span>
                      <span className="text-xs tabular-nums opacity-80">{m.views} · {m.percentage}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top referrer domains */}
            <h4 className="text-sm font-medium text-muted-foreground mt-6 mb-3">
              Sites que mais enviam visitas
            </h4>
            {data.topReferrerDomains.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum referenciador externo ainda</p>
            ) : (
              <div className="space-y-1">
                {data.topReferrerDomains.map(d => (
                  <div key={d.domain} className="flex items-center justify-between text-xs p-1.5 rounded bg-secondary/40">
                    <span className="font-mono truncate">{d.domain}</span>
                    <Badge variant="outline" className="ml-2">{d.views}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Campaigns */}
            {data.topCampaigns.length > 0 && (
              <>
                <h4 className="text-sm font-medium text-muted-foreground mt-6 mb-3 flex items-center gap-2">
                  <Megaphone className="h-4 w-4" /> Campanhas (UTM)
                </h4>
                <div className="space-y-1">
                  {data.topCampaigns.map(c => (
                    <div key={c.campaign} className="flex items-center justify-between text-xs p-1.5 rounded bg-secondary/40">
                      <span className="truncate">{c.campaign}</span>
                      <Badge variant="outline" className="ml-2">{c.views}</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Devices */}
            <h4 className="text-sm font-medium text-muted-foreground mt-6 mb-3">
              Dispositivos
            </h4>
            {data.deviceBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.deviceBreakdown.map(d => {
                  const meta = deviceMeta(d.device);
                  const Icon = meta.icon;
                  return (
                    <div key={d.device} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-secondary/60">
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{meta.label}</span>
                      <span className="text-xs tabular-nums opacity-70">{d.views} · {d.percentage}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top products */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Produtos mais visitados
            </h4>
            {data.topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem visitas em páginas de produto ainda</p>
            ) : (
              <div className="space-y-2">
                {data.topProducts.slice(0, 6).map((p, idx) => (
                  <Link
                    key={p.slug}
                    to={`/produto/${p.slug}`}
                    className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    {p.image ? (
                      <img src={p.image} alt={p.name} loading="lazy" className="h-9 w-9 rounded object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                    </div>
                    <Badge variant="secondary">{p.views} views</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}