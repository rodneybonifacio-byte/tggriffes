import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { 
  useMyCartReservations, 
  useCreateReservation, 
  useUpdateReservation, 
  useDeleteReservation,
  useClearSessionReservations,
  CartReservation,
  AddedFromSource
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
  addedFrom: AddedFromSource | null;
}

export interface AddItemResult {
  success: boolean;
  message?: string;
}

// Parâmetros simplificados - não precisa mais de variantId!
export interface AddItemParams {
  productId: string;
  productName: string;
  size: string;
  color: string | null;
  quantity: number;
  unitPriceCents: number;
  imageUrl: string | null;
  category: string | null;
  addedFrom: AddedFromSource;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: AddItemParams) => Promise<AddItemResult>;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number, stockQty?: number) => Promise<AddItemResult>;
  clearCart: () => void;
  getQuantityForVariant: (variantId: string) => number;
  getQuantityForProductSize: (productId: string, size: string, color: string | null) => number;
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
    category: null,
    addedFrom: reservation.added_from as AddedFromSource | null,
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

  // Adiciona item ao carrinho por ATRIBUTOS (product_id + size + color)
  // A RPC no banco resolve a variante correta - elimina erros de cache desatualizado
  const addItem = useCallback(async (item: AddItemParams): Promise<AddItemResult> => {
    try {
      await createReservation.mutateAsync({
        productId: item.productId,
        productName: item.productName,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        imageUrl: item.imageUrl,
        addedFrom: item.addedFrom,
      });
      return { success: true };
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Erro ao adicionar ao carrinho');
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

  // Nova função: busca por produto/tamanho/cor (não depende de variantId)
  const getQuantityForProductSize = useCallback((productId: string, size: string, color: string | null) => {
    const item = items.find(i => 
      i.productId === productId && 
      i.size === size && 
      (i.color || '') === (color || '')
    );
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
        getQuantityForProductSize,
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
