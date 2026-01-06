import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { usePromotions, useCreatePromotion, useUpdatePromotion, useDeletePromotion, Promotion } from '@/hooks/usePromotions';
import { useCategories, useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CurrencyInput } from '@/components/admin/CurrencyInput';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Percent, Tag, Package, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type DiscountType = 'percentage' | 'fixed_price' | 'fixed_discount';
type AppliesTo = 'all' | 'category' | 'product';

interface PromotionFormData {
  name: string;
  description: string;
  min_quantity: number;
  discount_type: DiscountType;
  discount_value: number;
  active: boolean;
  starts_at: string;
  ends_at: string;
  applies_to: AppliesTo;
  category_id: string | null;
  product_id: string | null;
}

const defaultFormData: PromotionFormData = {
  name: '',
  description: '',
  min_quantity: 2,
  discount_type: 'percentage',
  discount_value: 0,
  active: true,
  starts_at: '',
  ends_at: '',
  applies_to: 'all',
  category_id: null,
  product_id: null,
};

export default function AdminPromotions() {
  const { data: promotions, isLoading } = usePromotions();
  const { data: categories } = useCategories();
  const { data: products } = useProducts();
  const createPromotion = useCreatePromotion();
  const updatePromotion = useUpdatePromotion();
  const deletePromotion = useDeletePromotion();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>(defaultFormData);

  const handleOpenDialog = (promotion?: Promotion) => {
    if (promotion) {
      setEditingId(promotion.id);
      setFormData({
        name: promotion.name,
        description: promotion.description || '',
        min_quantity: promotion.min_quantity,
        discount_type: promotion.discount_type,
        discount_value: promotion.discount_value,
        active: promotion.active,
        starts_at: promotion.starts_at ? promotion.starts_at.slice(0, 16) : '',
        ends_at: promotion.ends_at ? promotion.ends_at.slice(0, 16) : '',
        applies_to: promotion.applies_to,
        category_id: promotion.category_id,
        product_id: promotion.product_id,
      });
    } else {
      setEditingId(null);
      setFormData(defaultFormData);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.min_quantity < 1 || formData.discount_value <= 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description || null,
      min_quantity: formData.min_quantity,
      discount_type: formData.discount_type,
      discount_value: formData.discount_value,
      active: formData.active,
      starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
      ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
      applies_to: formData.applies_to,
      category_id: formData.applies_to === 'category' ? formData.category_id : null,
      product_id: formData.applies_to === 'product' ? formData.product_id : null,
    };

    try {
      if (editingId) {
        await updatePromotion.mutateAsync({ id: editingId, ...payload });
        toast.success('Promoção atualizada!');
      } else {
        await createPromotion.mutateAsync(payload);
        toast.success('Promoção criada!');
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar promoção');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta promoção?')) return;
    try {
      await deletePromotion.mutateAsync(id);
      toast.success('Promoção excluída!');
    } catch (error) {
      toast.error('Erro ao excluir promoção');
    }
  };

  const formatDiscountValue = (promo: Promotion) => {
    switch (promo.discount_type) {
      case 'percentage':
        return `${promo.discount_value}%`;
      case 'fixed_price':
        return `R$ ${(promo.discount_value / 100).toFixed(2)} por peça`;
      case 'fixed_discount':
        return `- R$ ${(promo.discount_value / 100).toFixed(2)} por peça`;
    }
  };

  const getDiscountTypeLabel = (type: DiscountType) => {
    switch (type) {
      case 'percentage': return 'Desconto %';
      case 'fixed_price': return 'Preço fixo';
      case 'fixed_discount': return 'Desconto fixo';
    }
  };

  const getAppliesToLabel = (promo: Promotion) => {
    switch (promo.applies_to) {
      case 'all': return 'Todos os produtos';
      case 'category': return promo.category?.name || 'Categoria';
      case 'product': return promo.product?.name || 'Produto';
    }
  };

  const activePromotions = promotions?.filter(p => p.active) || [];
  const inactivePromotions = promotions?.filter(p => !p.active) || [];

  return (
    <AdminGuard>
      <AdminLayout title="Promoções">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Regras</CardDescription>
              <CardTitle className="text-2xl">{promotions?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ativas</CardDescription>
              <CardTitle className="text-2xl text-green-600">{activePromotions.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inativas</CardDescription>
              <CardTitle className="text-2xl text-muted-foreground">{inactivePromotions.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Por Quantidade</CardDescription>
              <CardTitle className="text-2xl">{promotions?.filter(p => p.min_quantity > 1).length || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Regras de Promoção</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Promoção' : 'Nova Promoção'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nome da Regra *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Compre 3 e ganhe 10%"
                    required
                  />
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional da promoção"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantidade Mínima *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.min_quantity}
                      onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 1 })}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">Peças no carrinho</p>
                  </div>
                  <div>
                    <Label>Tipo de Desconto *</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(v: DiscountType) => setFormData({ ...formData, discount_type: v, discount_value: 0 })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Desconto %</SelectItem>
                        <SelectItem value="fixed_price">Preço fixo por peça</SelectItem>
                        <SelectItem value="fixed_discount">Desconto fixo por peça</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>
                    {formData.discount_type === 'percentage' ? 'Porcentagem de Desconto *' : 'Valor (R$) *'}
                  </Label>
                  {formData.discount_type === 'percentage' ? (
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={formData.discount_value || ''}
                        onChange={(e) => setFormData({ ...formData, discount_value: parseInt(e.target.value) || 0 })}
                        placeholder="10"
                        className="pr-8"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  ) : (
                    <CurrencyInput
                      value={formData.discount_value}
                      onChange={(cents) => setFormData({ ...formData, discount_value: cents })}
                      required
                    />
                  )}
                </div>

                <div>
                  <Label>Aplica-se a</Label>
                  <Select
                    value={formData.applies_to}
                    onValueChange={(v: AppliesTo) => setFormData({ ...formData, applies_to: v, category_id: null, product_id: null })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      <SelectItem value="category">Categoria específica</SelectItem>
                      <SelectItem value="product">Produto específico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.applies_to === 'category' && (
                  <div>
                    <Label>Categoria</Label>
                    <Select
                      value={formData.category_id || ''}
                      onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.applies_to === 'product' && (
                  <div>
                    <Label>Produto</Label>
                    <Select
                      value={formData.product_id || ''}
                      onValueChange={(v) => setFormData({ ...formData, product_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((prod) => (
                          <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Início (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={formData.starts_at}
                      onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fim (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={formData.ends_at}
                      onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label>Promoção ativa</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={createPromotion.isPending || updatePromotion.isPending}>
                    {editingId ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : !promotions?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Nenhuma promoção cadastrada</h3>
              <p className="text-muted-foreground mb-4">Crie regras de desconto por quantidade para seus clientes</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Regra
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regra</TableHead>
                  <TableHead>Qtd Mínima</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Aplica-se</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{promo.name}</div>
                        {promo.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">{promo.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {promo.min_quantity}+ peças
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        {formatDiscountValue(promo)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {promo.applies_to === 'all' && <Layers className="h-4 w-4 text-muted-foreground" />}
                        {promo.applies_to === 'category' && <Tag className="h-4 w-4 text-muted-foreground" />}
                        {promo.applies_to === 'product' && <Package className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm">{getAppliesToLabel(promo)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={promo.active ? 'default' : 'secondary'}>
                        {promo.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(promo)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
