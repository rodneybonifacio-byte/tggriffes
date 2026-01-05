import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

const settingsSchema = z.object({
  store_name: z.string().trim().min(1, 'Nome da loja é obrigatório').max(100, 'Máximo 100 caracteres'),
  seller_whatsapp: z.string().regex(/^\d{10,13}$/, 'WhatsApp deve ter entre 10 e 13 dígitos'),
  origin_cep: z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos'),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser em formato hexadecimal (#000000)'),
});

const AdminSettings = () => {
  const { data: settings, isLoading } = useStoreSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [storeName, setStoreName] = useState('');
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [originCep, setOriginCep] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [storeLogoUrl, setStoreLogoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name || '');
      setSellerWhatsapp(settings.seller_whatsapp || '');
      setOriginCep(settings.origin_cep || '');
      setPrimaryColor(settings.primary_color || '#000000');
      setStoreLogoUrl(settings.store_logo_url || '');
    }
  }, [settings]);

  const formatWhatsApp = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 13);
  };

  const formatCep = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 8);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const data = {
      store_name: storeName,
      seller_whatsapp: sellerWhatsapp,
      origin_cep: originCep,
      primary_color: primaryColor,
    };

    const result = settingsSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('store_settings')
        .update({
          store_name: storeName.trim(),
          seller_whatsapp: sellerWhatsapp,
          origin_cep: originCep,
          primary_color: primaryColor,
          store_logo_url: storeLogoUrl || null,
        })
        .eq('id', settings?.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast({ title: 'Configurações salvas!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminGuard>
        <AdminLayout title="Configurações">
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout title="Configurações">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          {/* Store Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Loja</CardTitle>
              <CardDescription>Configure o nome e identidade visual da sua loja</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="store_name">Nome da Loja *</Label>
                <Input
                  id="store_name"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="TGGRIFFES"
                  maxLength={100}
                />
                {errors.store_name && (
                  <p className="text-sm text-destructive">{errors.store_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="store_logo">URL do Logo (opcional)</Label>
                <Input
                  id="store_logo"
                  value={storeLogoUrl}
                  onChange={(e) => setStoreLogoUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary_color">Cor Principal</Label>
                <div className="flex gap-3">
                  <Input
                    id="primary_color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#000000"
                    maxLength={7}
                    className="flex-1"
                  />
                </div>
                {errors.primary_color && (
                  <p className="text-sm text-destructive">{errors.primary_color}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact & Shipping */}
          <Card>
            <CardHeader>
              <CardTitle>Contato e Frete</CardTitle>
              <CardDescription>Configure o WhatsApp e CEP de origem para cálculo de frete</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seller_whatsapp">WhatsApp do Vendedor *</Label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 bg-secondary rounded-md text-sm text-muted-foreground">
                    +
                  </span>
                  <Input
                    id="seller_whatsapp"
                    value={sellerWhatsapp}
                    onChange={(e) => setSellerWhatsapp(formatWhatsApp(e.target.value))}
                    placeholder="5511999999999"
                    maxLength={13}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite o número completo com código do país (ex: 5511999999999)
                </p>
                {errors.seller_whatsapp && (
                  <p className="text-sm text-destructive">{errors.seller_whatsapp}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="origin_cep">CEP de Origem *</Label>
                <Input
                  id="origin_cep"
                  value={originCep}
                  onChange={(e) => setOriginCep(formatCep(e.target.value))}
                  placeholder="01001000"
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  CEP de onde os produtos serão enviados (para cálculo de frete)
                </p>
                {errors.origin_cep && (
                  <p className="text-sm text-destructive">{errors.origin_cep}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </form>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminSettings;
