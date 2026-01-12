import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ProductVariant } from './useProducts';

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
  addItem: (item: Omit<CartItem, 'id'>, stockQty: number) => AddItemResult;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number, stockQty?: number) => AddItemResult;
  clearCart: () => void;
  getQuantityForVariant: (variantId: string) => number;
  totalItems: number;
  totalCents: number;
}

const CART_STORAGE_KEY = 'tg-cart';

const getStoredCart = (): CartItem[] => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveCart = (items: CartItem[]) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => getStoredCart());

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, 'id'>, stockQty: number): AddItemResult => {
    // Get current quantity in cart for this variant
    const existingItem = items.find(i => i.variantId === item.variantId);
    const currentQty = existingItem?.quantity || 0;
    const newTotalQty = currentQty + item.quantity;

    // Check stock limit
    if (newTotalQty > stockQty) {
      return {
        success: false,
        message: `Estoque insuficiente. Disponível: ${stockQty} unidade${stockQty !== 1 ? 's' : ''}`,
      };
    }

    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.productId === item.productId && i.variantId === item.variantId
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
        };
        return updated;
      }

      return [...prev, { ...item, id: crypto.randomUUID() }];
    });

    return { success: true };
  }, [items]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number, stockQty?: number): AddItemResult => {
    if (quantity <= 0) {
      removeItem(id);
      return { success: true };
    }

    // Check stock limit if provided
    if (stockQty !== undefined && quantity > stockQty) {
      return {
        success: false,
        message: `Estoque insuficiente. Disponível: ${stockQty} unidade${stockQty !== 1 ? 's' : ''}`,
      };
    }

    setItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, quantity } : item
      )
    );

    return { success: true };
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

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
        totalCents 
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
