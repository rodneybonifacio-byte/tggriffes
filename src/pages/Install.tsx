import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, CheckCircle, Share, MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>App Instalado!</CardTitle>
            <CardDescription>
              O TG Griffes já está instalado no seu dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button className="w-full">Ir para a Loja</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Instalar TG Griffes</CardTitle>
          <CardDescription>
            Adicione nosso app à sua tela inicial para acesso rápido e experiência de compra otimizada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span>Acesso rápido direto da tela inicial</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span>Funciona offline após carregar</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span>Experiência em tela cheia</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span>Carregamento mais rápido</span>
            </div>
          </div>

          {/* Install Instructions */}
          {isIOS ? (
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <p className="font-medium text-sm">Como instalar no iPhone:</p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                  Toque em <Share className="h-4 w-4 inline mx-1" /> Compartilhar
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                  Role e toque em "Adicionar à Tela de Início"
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                  Toque em "Adicionar"
                </li>
              </ol>
            </div>
          ) : deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Instalar Agora
            </Button>
          ) : (
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <p className="font-medium text-sm">Como instalar no Android:</p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                  Toque em <MoreVertical className="h-4 w-4 inline mx-1" /> Menu do navegador
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                  Toque em "Instalar app" ou "Adicionar à tela inicial"
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                  Confirme a instalação
                </li>
              </ol>
            </div>
          )}

          <Link to="/" className="block">
            <Button variant="outline" className="w-full">
              Continuar no Navegador
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
