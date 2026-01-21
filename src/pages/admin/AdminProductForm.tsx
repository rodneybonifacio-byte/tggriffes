import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { VariantEditor, VariantData } from '@/components/admin/VariantEditor';
import { CurrencyInput } from '@/components/admin/CurrencyInput';
import { useProduct, useCategories, useCreateProduct, useUpdateProduct, useCreateCategory, useCreateVariant, useDeleteVariant } from '@/hooks/useProducts';
import { useSyncSingleProduct } from '@/hooks/useShopifySync';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateSlug } from '@/lib/utils';

const AdminProductForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = id && id !== 'novo';
  const { toast } = useToast();

  const { data: product, isLoading: isLoadingProduct } = useProduct(isEditing ? id : undefined);
  const { data: categories = [] } = useCategories();
  const { mutateAsync: createProduct, isPending: isCreating } = useCreateProduct();
  const { mutateAsync: updateProduct, isPending: isUpdating } = useUpdateProduct();
  const { mutateAsync: createCategory } = useCreateCategory();
  const { mutateAsync: createVariant } = useCreateVariant();
  const { mutateAsync: deleteVariant } = useDeleteVariant();
  const syncToShopify = useSyncSingleProduct();
  const { canViewPrices } = usePermissions();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [priceCents, setPriceCents] = useState(0);
  const [categoryId, setCategoryId] = useState<string>('');
  const [active, setActive] = useState(true);
  const [weightGrams, setWeightGrams] = useState<number | undefined>();
  const [lengthCm, setLengthCm] = useState<number | undefined>();
  const [widthCm, setWidthCm] = useState<number | undefined>();
  const [heightCm, setHeightCm] = useState<number | undefined>();
  const [images, setImages] = useState<string[]>([]);
  const [mainImage, setMainImage] = useState<string>('');
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSlug(product.slug);
      setDescription(product.description || '');
      setPriceCents(product.price_cents);
      setCategoryId(product.category_id || '');
      setActive(product.active);
      setWeightGrams(product.weight_grams || undefined);
      setLengthCm(product.length_cm ? Number(product.length_cm) : undefined);
      setWidthCm(product.width_cm ? Number(product.width_cm) : undefined);
      setHeightCm(product.height_cm ? Number(product.height_cm) : undefined);
      setMainImage(product.main_image_url || '');
      
      // Load images - from product_images table OR fallback to main_image_url
      const productImages = product.product_images?.map(i => i.image_url) || [];
      if (productImages.length > 0) {
        setImages(productImages);
      } else if (product.main_image_url) {
        setImages([product.main_image_url]);
      } else {
        setImages([]);
      }
      
      setVariants(product.product_variants?.map(v => ({
        size: v.size, stock_qty: v.stock_qty, sku: v.sku || undefined, color: v.color || undefined, id: v.id
      })) || []);
    }
  }, [product]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEditing) setSlug(generateSlug(value));
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newCategory = await createCategory({
        name: newCategoryName.trim(),
        slug: generateSlug(newCategoryName),
      });
      setCategoryId(newCategory.id);
      setNewCategoryName('');
      setIsCategoryDialogOpen(false);
      toast({ title: 'Categoria criada!' });
    } catch (error) {
      toast({ title: 'Erro ao criar categoria', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Colaboradores podem salvar sem preço (mantém o preço existente)
    const priceValid = canViewPrices ? priceCents > 0 : true;
    if (!name.trim() || !priceValid || images.length === 0 || variants.length === 0) {
      toast({ title: 'Preencha todos os campos obrigatórios', description: 'Nome, pelo menos 1 foto e 1 tamanho são necessários.', variant: 'destructive' });
      return;
    }

    try {
      const productData: Record<string, any> = {
        name, slug, description,
        category_id: categoryId || null, active,
        weight_grams: weightGrams || null,
        length_cm: lengthCm || null, width_cm: widthCm || null, height_cm: heightCm || null,
        main_image_url: mainImage || images[0] || null,
      };
      
      // Apenas admin pode alterar preço
      if (canViewPrices) {
        productData.price_cents = priceCents;
      }

      let productId = id;
      if (isEditing && id) {
        await updateProduct({ id, ...productData } as any);
      } else {
        // Colaborador precisa definir preço ao criar novo produto
        if (!canViewPrices) {
          productData.price_cents = 0; // Preço padrão, admin pode ajustar depois
        }
        const newProduct = await createProduct(productData as any);
        productId = newProduct.id;
      }

      // Save images
      if (productId) {
        // Delete existing images that are no longer in the list
        if (isEditing && product?.product_images) {
          for (const existingImage of product.product_images) {
            const stillExists = images.includes(existingImage.image_url);
            if (!stillExists) {
              await supabase.from('product_images').delete().eq('id', existingImage.id);
            }
          }
        }
        
        // Add new images
        const existingUrls = product?.product_images?.map(i => i.image_url) || [];
        for (let i = 0; i < images.length; i++) {
          const imageUrl = images[i];
          if (!existingUrls.includes(imageUrl)) {
            await supabase.from('product_images').insert({
              product_id: productId,
              image_url: imageUrl,
              sort_order: i,
            });
          } else {
            // Update sort order for existing images
            await supabase.from('product_images')
              .update({ sort_order: i })
              .eq('product_id', productId)
              .eq('image_url', imageUrl);
          }
        }
      }

      // Save variants
      if (productId) {
        // Delete existing variants that are no longer in the list
        if (isEditing && product?.product_variants) {
          for (const existingVariant of product.product_variants) {
            const stillExists = variants.some(v => v.id === existingVariant.id);
            if (!stillExists) {
              await deleteVariant(existingVariant.id);
            }
          }
        }
        
        for (const variant of variants) {
          if (variant.id) {
            await supabase.from('product_variants').update({ 
              stock_qty: variant.stock_qty, 
              sku: variant.sku || null,
              color: variant.color || null 
            }).eq('id', variant.id);
          } else {
            await createVariant({ 
              product_id: productId, 
              size: variant.size, 
              stock_qty: variant.stock_qty, 
              sku: variant.sku || null,
              color: variant.color || null
            });
          }
        }

        // Auto-sync to Shopify after saving product with variants
        if (productId && active) {
          // Small delay to ensure variants are saved before syncing
          setTimeout(() => {
            syncToShopify.mutate(productId);
          }, 1000);
        }
      }

      toast({ title: isEditing ? 'Produto atualizado!' : 'Produto criado!' });
      navigate('/admin/produtos');
    } catch (error) {
      toast({ title: 'Erro ao salvar produto', variant: 'destructive' });
    }
  };

  if (isEditing && isLoadingProduct) {
    return <AdminGuard><AdminLayout title="Carregando..."><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout></AdminGuard>;
  }

  return (
    <AdminGuard>
      <AdminLayout title={isEditing ? 'Editar Produto' : 'Novo Produto'} backHref="/admin/produtos">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          <Card>
            <CardHeader><CardTitle>Dados do Produto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Nome *</Label><Input value={name} onChange={(e) => handleNameChange(e.target.value)} required /></div>
                <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <div className="flex gap-2">
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                      <DialogTrigger asChild><Button type="button" variant="outline" size="icon"><Plus className="h-4 w-4" /></Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
                        <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nome da categoria" />
                        <Button onClick={handleAddCategory}>Criar</Button>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                {canViewPrices && (
                  <div><Label>Preço *</Label><CurrencyInput value={priceCents} onChange={setPriceCents} required /></div>
                )}
              </div>
              <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
              <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Produto ativo</Label></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fotos *</CardTitle></CardHeader>
            <CardContent><ImageUpload images={images} mainImage={mainImage} onImagesChange={setImages} onMainImageChange={setMainImage} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medidas para Frete</CardTitle>
              <p className="text-sm text-muted-foreground">Se não preenchido, usa valores padrão: 300g, 30x30x2cm</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Peso (g)</Label>
                <Input type="number" min={1} placeholder="300" value={weightGrams || ''} onChange={(e) => setWeightGrams(parseInt(e.target.value) || undefined)} />
              </div>
              <div>
                <Label>Comprimento (cm)</Label>
                <Input type="number" min={1} placeholder="30" value={lengthCm || ''} onChange={(e) => setLengthCm(parseFloat(e.target.value) || undefined)} />
              </div>
              <div>
                <Label>Largura (cm)</Label>
                <Input type="number" min={1} placeholder="30" value={widthCm || ''} onChange={(e) => setWidthCm(parseFloat(e.target.value) || undefined)} />
              </div>
              <div>
                <Label>Altura (cm)</Label>
                <Input type="number" min={1} placeholder="2" value={heightCm || ''} onChange={(e) => setHeightCm(parseFloat(e.target.value) || undefined)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Variações e Estoque *</CardTitle></CardHeader>
            <CardContent><VariantEditor variants={variants} onChange={setVariants} /></CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isCreating || isUpdating}>{(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEditing ? 'Salvar' : 'Criar Produto'}</Button>
            <Button type="button" variant="outline" onClick={() => navigate('/admin/produtos')}>Cancelar</Button>
          </div>
        </form>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminProductForm;
