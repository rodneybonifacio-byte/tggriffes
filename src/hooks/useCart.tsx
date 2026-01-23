import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  useMyCartReservations, 
  useCreateReservation, 
  useUpdateReservation, 
  useDeleteReservation,
  useClearSessionReservations,
  CartReservation
} from './useCartReservations';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string | null;
  quantity: number;
  unitPriceCents: number;
  imageUrl: string | null;
  category: string | null;
}

export interface AddItemResult {
  success: boolean;
  message?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => Promise<AddItemResult>;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number, stockQty?: number) => Promise<AddItemResult>;
  clearCart: () => void;
  getQuantityForVariant: (variantId: string) => number;
  totalItems: number;
  totalCents: number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

async function findVariantIdByAttributes(params: {
  productId: string;
  size: string;
  color: string | null;
}): Promise<string | null> {
  let query = supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', params.productId)
    .eq('size', params.size)
    .limit(1);

  query = params.color === null ? query.is('color', null) : query.eq('color', params.color);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// Convert reservation to CartItem format
function reservationToCartItem(reservation: CartReservation): CartItem {
  return {
    id: reservation.id,
    productId: reservation.product_id,
    productName: reservation.product_name,
    variantId: reservation.variant_id,
    size: reservation.size,
    color: reservation.color,
    quantity: reservation.quantity,
    unitPriceCents: reservation.unit_price_cents,
    imageUrl: reservation.image_url,
    category: null, // Category not stored in reservations
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { data: reservations, isLoading } = useMyCartReservations();
  const createReservation = useCreateReservation();
  const updateReservation = useUpdateReservation();
  const deleteReservation = useDeleteReservation();
  const clearReservations = useClearSessionReservations();

  // Convert reservations to cart items
  const items: CartItem[] = useMemo(() => {
    return (reservations || []).map(reservationToCartItem);
  }, [reservations]);

  const addItem = useCallback(async (item: Omit<CartItem, 'id'>): Promise<AddItemResult> => {
    try {
      // Validação de estoque é feita atomicamente na RPC add_cart_reservation
      // com lock de linha para evitar race conditions
      await createReservation.mutateAsync({
        variantId: item.variantId,
        productId: item.productId,
        productName: item.productName,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        imageUrl: item.imageUrl,
      });
      return { success: true };
    } catch (error: unknown) {
      // Causa raiz observada: usuário com catálogo desatualizado (ou variante removida)
      // tenta reservar com um variantId que já não existe. Nesse caso, tentamos
      // resolver o variantId atual por (productId + size + color) e refazer 1 vez.
      const message = getErrorMessage(error, 'Erro ao adicionar ao carrinho');
      const isVariantNotFound = message.toLowerCase().includes('variante não encontrada');

      if (isVariantNotFound) {
        try {
          const repairedVariantId = await findVariantIdByAttributes({
            productId: item.productId,
            size: item.size,
            color: item.color,
          });

          if (repairedVariantId && repairedVariantId !== item.variantId) {
            await createReservation.mutateAsync({
              variantId: repairedVariantId,
              productId: item.productId,
              productName: item.productName,
              size: item.size,
              color: item.color,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              imageUrl: item.imageUrl,
            });
            return { success: true };
          }

          return {
            success: false,
            message: 'Esta variante não está mais disponível. Atualize a página e tente novamente.',
          };
        } catch (repairError) {
          return {
            success: false,
            message: getErrorMessage(repairError, message),
          };
        }
      }

      return { success: false, message };
    }
  }, [createReservation]);

  const removeItem = useCallback((id: string) => {
    deleteReservation.mutate(id);
  }, [deleteReservation]);

  const updateQuantity = useCallback(async (id: string, quantity: number, stockQty?: number): Promise<AddItemResult> => {
    try {
      // Find the current item to check stock
      const currentItem = items.find(i => i.id === id);
      if (!currentItem) {
        return { success: false, message: 'Item não encontrado' };
      }

      // Check stock limit if provided
      if (stockQty !== undefined && quantity > stockQty + currentItem.quantity) {
        return {
          success: false,
          message: `Estoque insuficiente. Disponível: ${stockQty + currentItem.quantity} unidade${stockQty + currentItem.quantity !== 1 ? 's' : ''}`,
        };
      }

      await updateReservation.mutateAsync({ id, quantity });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar quantidade';
      return { success: false, message };
    }
  }, [updateReservation, items]);

  const clearCart = useCallback(() => {
    clearReservations.mutate();
  }, [clearReservations]);

  const getQuantityForVariant = useCallback((variantId: string) => {
    const item = items.find(i => i.variantId === variantId);
    return item?.quantity || 0;
  }, [items]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  return (
    <CartContext.Provider 
      value={{ 
        items, 
        addItem, 
        removeItem, 
        updateQuantity, 
        clearCart, 
        getQuantityForVariant,
        totalItems, 
        totalCents,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
