import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { useUsers, useAssignRole, useRemoveRole, UserWithRole } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, Search, Shield, UserX, Loader2, Crown, UserCog, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

const AdminUsers = () => {
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'seller'>('seller');
  const [isCreating, setIsCreating] = useState(false);
  
  const { data: users = [], isLoading, refetch } = useUsers();
  const { mutateAsync: assignRole, isPending: isAssigning } = useAssignRole();
  const { mutateAsync: removeRole, isPending: isRemoving } = useRemoveRole();
  const { isAdmin } = usePermissions();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Only admins can access this page
  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssignRole = async (userId: string, role: 'admin' | 'seller') => {
    try {
      await assignRole({ userId, role });
      toast({
        title: 'Role atribuída!',
        description: `Usuário agora é ${role === 'admin' ? 'Administrador' : 'Colaborador'}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao atribuir role',
        description: 'Não foi possível atribuir a role.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRole = async (userId: string) => {
    try {
      await removeRole(userId);
      toast({
        title: 'Role removida!',
        description: 'Usuário não tem mais acesso ao painel.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao remover role',
        description: 'Não foi possível remover a role.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome, email e senha.',
        variant: 'destructive',
      });
      return;
    }

    if (newUserPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      // Criar usuário via Supabase Admin API (signUp cria o usuário)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: { name: newUserName },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Atribuir role
        await assignRole({ userId: authData.user.id, role: newUserRole });
      }

      toast({
        title: 'Usuário criado!',
        description: `${newUserName} foi adicionado como ${newUserRole === 'admin' ? 'Administrador' : 'Colaborador'}.`,
      });

      setShowAddDialog(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('seller');
      refetch();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Não foi possível criar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleBadge = (role: string | null) => {
    if (role === 'admin') {
      return (
        <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-300">
          <Crown className="h-3 w-3" />
          Administrador
        </Badge>
      );
    }
    if (role === 'seller') {
      return (
        <Badge variant="secondary" className="gap-1">
          <UserCog className="h-3 w-3" />
          Colaborador
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <UserX className="h-3 w-3" />
        Sem acesso
      </Badge>
    );
  };

  const adminCount = users.filter(u => u.role === 'admin').length;
  const collaboratorCount = users.filter(u => u.role === 'seller').length;
  const noAccessCount = users.filter(u => !u.role).length;

  return (
    <AdminGuard>
      <AdminLayout title="Gerenciar Usuários">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-600" />
                Administradores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserCog className="h-4 w-4 text-blue-600" />
                Colaboradores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{collaboratorCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserX className="h-4 w-4 text-muted-foreground" />
                Sem Acesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{noAccessCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
              <Shield className="h-4 w-4" />
              Níveis de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-1">
            <p><strong>Administrador:</strong> Acesso total ao sistema, incluindo preços, configurações e gestão de usuários.</p>
            <p><strong>Colaborador:</strong> Visualiza produtos, estoque, pedidos e clientes. Não vê preços nem configurações.</p>
          </CardContent>
        </Card>

        {/* Search and Add Button */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Add User Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie uma conta para um novo colaborador ou administrador.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newName">Nome</Label>
                <Input
                  id="newName"
                  placeholder="Nome completo"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newEmail">Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newRole">Nível de Acesso</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'admin' | 'seller')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seller">
                      <span className="flex items-center gap-2">
                        <UserCog className="h-3 w-3 text-blue-600" />
                        Colaborador
                      </span>
                    </SelectItem>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2">
                        <Crown className="h-3 w-3 text-amber-600" />
                        Administrador
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar Usuário
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum usuário encontrado</p>
            <p className="text-muted-foreground">
              {search ? 'Tente alterar o termo de busca' : 'Usuários cadastrados aparecerão aqui'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-center">Role Atual</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isCurrentUser = user.id === currentUser?.id;
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {user.name || 'Sem nome'}
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">Você</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-center">
                          {getRoleBadge(user.role)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              value={user.role || 'none'}
                              onValueChange={(value) => {
                                if (value === 'none') {
                                  handleRemoveRole(user.id);
                                } else {
                                  handleAssignRole(user.id, value as 'admin' | 'seller');
                                }
                              }}
                              disabled={isAssigning || isRemoving || isCurrentUser}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Selecionar role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <span className="flex items-center gap-2">
                                    <Crown className="h-3 w-3 text-amber-600" />
                                    Administrador
                                  </span>
                                </SelectItem>
                                <SelectItem value="seller">
                                  <span className="flex items-center gap-2">
                                    <UserCog className="h-3 w-3 text-blue-600" />
                                    Colaborador
                                  </span>
                                </SelectItem>
                                <SelectItem value="none">
                                  <span className="flex items-center gap-2">
                                    <UserX className="h-3 w-3 text-muted-foreground" />
                                    Sem acesso
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredUsers.map((user) => {
                const isCurrentUser = user.id === currentUser?.id;
                
                return (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{user.name || 'Sem nome'}</p>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">Você</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Desde {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        {getRoleBadge(user.role)}
                      </div>

                      <Select
                        value={user.role || 'none'}
                        onValueChange={(value) => {
                          if (value === 'none') {
                            handleRemoveRole(user.id);
                          } else {
                            handleAssignRole(user.id, value as 'admin' | 'seller');
                          }
                        }}
                        disabled={isAssigning || isRemoving || isCurrentUser}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecionar role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-2">
                              <Crown className="h-3 w-3 text-amber-600" />
                              Administrador
                            </span>
                          </SelectItem>
                          <SelectItem value="seller">
                            <span className="flex items-center gap-2">
                              <UserCog className="h-3 w-3 text-blue-600" />
                              Colaborador
                            </span>
                          </SelectItem>
                          <SelectItem value="none">
                            <span className="flex items-center gap-2">
                              <UserX className="h-3 w-3 text-muted-foreground" />
                              Sem acesso
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminUsers;
