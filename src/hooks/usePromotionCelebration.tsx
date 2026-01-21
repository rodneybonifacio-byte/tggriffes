import { useState, useEffect, useRef, useCallback } from 'react';
import { useApplicablePromotions, calculatePromotionDiscount, Promotion } from './usePromotions';
import { formatPrice } from '@/lib/utils';

const CELEBRATION_STORAGE_KEY = 'tg-promotion-celebrated';

interface PromotionCelebrationState {
  shouldCelebrate: boolean;
  promotionDescription: string;
  discountAmount: string;
  markCelebrated: () => void;
  resetCelebration: () => void;
}

export function usePromotionCelebration(
  totalItems: number,
  subtotalCents: number
): PromotionCelebrationState {
  const [shouldCelebrate, setShouldCelebrate] = useState(false);
  const [celebrationData, setCelebrationData] = useState({
    promotionDescription: '',
    discountAmount: '',
  });
  
  const previousTotalRef = useRef<number>(0);
  const { data: promotion } = useApplicablePromotions(totalItems);

  // Get the last celebrated threshold from storage
  const getCelebratedThreshold = (): number => {
    try {
      return parseInt(localStorage.getItem(CELEBRATION_STORAGE_KEY) || '0', 10);
    } catch {
      return 0;
    }
  };

  // Check if we should celebrate
  useEffect(() => {
    if (!promotion) return;

    const previousTotal = previousTotalRef.current;
    const threshold = promotion.min_quantity;
    const celebratedThreshold = getCelebratedThreshold();

    // Celebrate if:
    // 1. We just crossed the threshold (from below to at/above)
    // 2. We haven't celebrated this threshold yet
    const justCrossedThreshold = previousTotal < threshold && totalItems >= threshold;
    const haventCelebrated = celebratedThreshold < threshold;

    if (justCrossedThreshold && haventCelebrated && totalItems >= threshold) {
      const { discountCents, description } = calculatePromotionDiscount(
        promotion,
        subtotalCents,
        totalItems
      );

      setCelebrationData({
        promotionDescription: description || promotion.name,
        discountAmount: formatPrice(discountCents),
      });
      setShouldCelebrate(true);
    }

    previousTotalRef.current = totalItems;
  }, [totalItems, promotion, subtotalCents]);

  const markCelebrated = useCallback(() => {
    if (promotion) {
      localStorage.setItem(CELEBRATION_STORAGE_KEY, String(promotion.min_quantity));
    }
    setShouldCelebrate(false);
  }, [promotion]);

  const resetCelebration = useCallback(() => {
    localStorage.removeItem(CELEBRATION_STORAGE_KEY);
    previousTotalRef.current = 0;
  }, []);

  return {
    shouldCelebrate,
    promotionDescription: celebrationData.promotionDescription,
    discountAmount: celebrationData.discountAmount,
    markCelebrated,
    resetCelebration,
  };
}
