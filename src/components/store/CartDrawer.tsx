import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Trash2, Plus, Minus, Tag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckoutDrawer } from './CheckoutDrawer';
import { useApplicablePromotions, calculatePromotionDiscount } from '@/hooks/usePromotions';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';

export function CartDrawer() {
  const { items, removeItem, updateQuantity, totalItems, totalCents } = useCart();
  const [open, setOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { toast } = useToast();
  
  // Fetch products to get current stock info
  const { data: products } = useProducts();
  
  const { data: promotion } = useApplicablePromotions(totalItems);
  const { discountCents, finalCents, description } = calculatePromotionDiscount(
    promotion,
    totalCents,
    totalItems
  );

  // Get stock for a variant
  const getVariantStock = (variantId: string): number => {
    if (!products) return 999; // fallback high number if products not loaded
    for (const product of products) {
      const variant = product.product_variants?.find(v => v.id === variantId);
      if (variant) return variant.stock_qty;
    }
    return 999;
  };

  const handleIncrement = (itemId: string, variantId: string, currentQty: number) => {
    const stockQty = getVariantStock(variantId);
    const result = updateQuantity(itemId, currentQty + 1, stockQty);
    if (!result.success) {
      toast({
        title: 'Limite atingido',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  const handleDecrement = (itemId: string, currentQty: number) => {
    updateQuantity(itemId, currentQty - 1);
  };

  const handleCheckout = () => {
    setOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingCart className={totalItems > 0 ? "h-5 w-5 text-green-600" : "h-5 w-5"} />
            {totalItems > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-green-600 hover:bg-green-600">
                {totalItems}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Carrinho ({totalItems})</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mb-4" />
                <p>Seu carrinho está vazio</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 bg-secondary/50 rounded-lg">
                    {item.imageUrl && (
                      <img 
                        src={item.imageUrl} 
                        alt={item.productName}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">{item.productName}</h4>
                      <p className="text-xs text-muted-foreground">
                        Tam: {item.size} {item.color && `• ${item.color}`}
                      </p>
                      <p className="text-sm font-semibold mt-1">
                        {formatPrice(item.unitPriceCents * item.quantity)}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDecrement(item.id, item.quantity)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleIncrement(item.id, item.variantId, item.quantity)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {items.length > 0 && (
            <SheetFooter className="border-t pt-4">
              <div className="w-full space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatPrice(totalCents)}</span>
                </div>
                
                {discountCents > 0 && (
                  <div className="flex items-center justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {description}
                    </span>
                    <span>-{formatPrice(discountCents)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>{formatPrice(finalCents)}</span>
                </div>
                
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={handleCheckout}
                >
                  Finalizar Compra
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutDrawer open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  );
}