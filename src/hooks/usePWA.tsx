import { useEffect } from "react";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

let initialized = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function initPWA() {
  if (initialized) return;
  initialized = true;

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Atualiza automaticamente para evitar ficar preso em versão antiga
      toast("Atualizando para a nova versão...", { duration: 2500 });
      updateSW?.(true);
    },
    onOfflineReady() {
      toast.success("App pronto para uso offline!");
    },
    onRegisteredSW(swUrl, registration) {
      console.log("SW registrado:", swUrl);

      // Verifica atualizações periodicamente
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("Erro ao registrar SW:", error);
      toast.error("Não foi possível ativar o modo PWA neste navegador.");
    },
  });
}

export function usePWA() {
  useEffect(() => {
    initPWA();
  }, []);

  return { updateSW };
}

