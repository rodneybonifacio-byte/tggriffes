import { useEffect } from "react";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

let initialized = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

function isPreviewOrIframe(): boolean {
  try {
    const inIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isPreviewHost =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.app"); // also covers id-preview--*.lovable.app
    // Only the production custom domain / non-lovable host should register the SW.
    return inIframe || isPreviewHost;
  } catch {
    return true;
  }
}

async function unregisterExistingSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch (e) {
    console.warn("Falha ao limpar service worker antigo:", e);
  }
}

export function initPWA() {
  if (initialized) return;
  initialized = true;

  // Em preview/iframe (editor Lovable), NUNCA registrar SW — ele serve bundle antigo
  // e quebra rotas/menus novos. Limpa qualquer SW pré-existente.
  if (isPreviewOrIframe()) {
    unregisterExistingSW();
    return;
  }

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

