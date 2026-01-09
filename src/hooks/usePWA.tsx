import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function initPWA() {
  updateSW = registerSW({
    onNeedRefresh() {
      toast('Nova versão disponível!', {
        description: 'Clique para atualizar o aplicativo.',
        action: {
          label: 'Atualizar',
          onClick: () => {
            updateSW?.(true);
          },
        },
        duration: Infinity,
      });
    },
    onOfflineReady() {
      toast.success('App pronto para uso offline!');
    },
    onRegisteredSW(swUrl, registration) {
      console.log('SW registrado:', swUrl);
      
      // Verifica atualizações a cada 60 segundos
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('Erro ao registrar SW:', error);
    },
  });
}

export function usePWA() {
  useEffect(() => {
    initPWA();
  }, []);

  return { updateSW };
}
