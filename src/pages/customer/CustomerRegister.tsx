import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ArrowLeft } from 'lucide-react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { supabase } from '@/integrations/supabase/client';

export default function CustomerRegister() {
  const { user, signUp, isLoading: authLoading } = useAuth();
  const { data: settings } = useStoreSettings();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Se já está logado, redireciona para a área do cliente
  if (user && !authLoading) {
    return <Navigate to="/minha-conta" replace />;
  }

  const handleWhatsappChange = (value: string) => {
    const cleaned = value.replace(/[^\d+]/g, '');
    setWhatsapp(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !whatsapp || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'Verifique a confirmação da senha.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Criar usuário no auth
      await signUp(email, password, name);

      // 2. Criar/atualizar registro de cliente com email
      const cleanWhatsapp = whatsapp.replace(/\D/g, '');
      
      // Primeiro tenta encontrar cliente existente pelo whatsapp
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('whatsapp', cleanWhatsapp)
        .maybeSingle();

      if (existingCustomer) {
        // Atualiza cliente existente com email
        await supabase
          .from('customers')
          .update({ email, name })
          .eq('id', existingCustomer.id);
      } else {
        // Cria novo cliente
        await supabase
          .from('customers')
          .insert({ name, whatsapp: cleanWhatsapp, email });
      }

      // 3. Atribuir role de customer
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase
          .from('user_roles')
          .insert({ user_id: newUser.id, role: 'customer' });
      }

      toast({
        title: 'Conta criada!',
        description: 'Você já pode acessar sua área.',
      });
      
      navigate('/minha-conta');
    } catch (error: any) {
      toast({
        title: 'Erro ao criar conta',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Voltar à loja</span>
          </Link>
          
          {settings?.store_logo_url ? (
            <img src={settings.store_logo_url} alt={settings.store_name} className="h-8 object-contain" />
          ) : (
            <span className="font-bold">{settings?.store_name || 'Loja'}</span>
          )}
          
          <div className="w-24" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Criar sua conta</CardTitle>
            <CardDescription>
              Cadastre-se para acompanhar seus pedidos
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  type="text"
                  placeholder="+5511999999999"
                  value={whatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  disabled={isLoading}
                  maxLength={20}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Criando conta...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Já tem conta? </span>
              <Link to="/entrar" className="text-primary hover:underline font-medium">
                Fazer login
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
