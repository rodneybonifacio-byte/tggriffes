import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PartyPopper, Flame, Gift, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PromotionCelebrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionDescription: string;
  discountAmount: string;
}

export function PromotionCelebrationModal({
  open,
  onOpenChange,
  promotionDescription,
  discountAmount,
}: PromotionCelebrationModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 overflow-hidden">
        {/* Confetti animation */}
        <AnimatePresence>
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    y: -20,
                    x: Math.random() * 400 - 200,
                    opacity: 1,
                    rotate: 0,
                    scale: 0.5
                  }}
                  animate={{ 
                    y: 400,
                    rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
                    opacity: 0,
                    scale: 1
                  }}
                  transition={{ 
                    duration: 2 + Math.random(),
                    delay: Math.random() * 0.5,
                    ease: 'easeOut'
                  }}
                  className="absolute text-2xl"
                  style={{ left: `${Math.random() * 100}%` }}
                >
                  {['🎉', '✨', '🔥', '💰', '🎊', '⭐'][Math.floor(Math.random() * 6)]}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        <DialogHeader className="text-center space-y-4 pt-6">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 10 }}
            className="mx-auto"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                <PartyPopper className="h-10 w-10 text-white" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center"
              >
                <Flame className="h-4 w-4 text-white" />
              </motion.div>
            </div>
          </motion.div>

          <DialogTitle className="text-2xl font-bold text-green-700">
            🎉 Parabéns!
          </DialogTitle>
          
          <DialogDescription className="text-base text-green-600 space-y-2">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Você desbloqueou a promoção de atacado!
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/70 rounded-lg p-3 border border-green-200"
            >
              <div className="flex items-center justify-center gap-2 text-green-700 font-semibold">
                <Gift className="h-5 w-5" />
                <span>{promotionDescription}</span>
              </div>
            </motion.div>
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4 pt-4"
        >
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 text-center text-white shadow-lg">
            <p className="text-sm opacity-90">Você vai economizar</p>
            <p className="text-3xl font-bold">{discountAmount}</p>
          </div>

          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-100 rounded-lg p-3">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>O desconto será aplicado automaticamente no checkout</span>
          </div>

          <Button 
            onClick={() => onOpenChange(false)}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-6"
          >
            Continuar Comprando 🛒
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
