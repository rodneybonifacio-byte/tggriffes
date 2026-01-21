import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'seller' | null;

interface Permissions {
  // Visualização
  canViewProducts: boolean;
  canViewOrders: boolean;
  canViewCustomers: boolean;
  canViewStock: boolean;
  canViewSettings: boolean;
  canViewPrices: boolean;
  canViewPromotions: boolean;
  canViewShopify: boolean;
  canViewDashboard: boolean;
  canViewAbandonedCarts: boolean;
  
  // Edição
  canEditProducts: boolean;
  canEditOrders: boolean;
  canEditStock: boolean;
  canEditSettings: boolean;
  canEditPromotions: boolean;
  
  // Deleção
  canDeleteProducts: boolean;
  canDeleteOrders: boolean;
  
  // Gestão de Usuários
  canManageUsers: boolean;
  
  // Role
  role: UserRole;
  isAdmin: boolean;
  isCollaborator: boolean;
}

export function usePermissions(): Permissions & { isLoading: boolean } {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error || !data) return null;
      return data.role as UserRole;
    },
    enabled: !!user?.id,
  });

  const isAdmin = role === 'admin';
  const isCollaborator = role === 'seller';

  // Administrador: acesso total
  // Colaborador (seller): acesso limitado - sem configurações, sem preços
  const permissions: Permissions = {
    // Visualização
    canViewProducts: isAdmin || isCollaborator,
    canViewOrders: isAdmin || isCollaborator,
    canViewCustomers: isAdmin || isCollaborator,
    canViewStock: isAdmin || isCollaborator,
    canViewSettings: isAdmin, // Apenas admin
    canViewPrices: isAdmin, // Apenas admin
    canViewPromotions: isAdmin, // Apenas admin (envolve preços)
    canViewShopify: isAdmin, // Apenas admin
    canViewDashboard: isAdmin || isCollaborator,
    canViewAbandonedCarts: isAdmin || isCollaborator,
    
    // Edição
    canEditProducts: isAdmin, // Colaborador não edita produtos
    canEditOrders: isAdmin || isCollaborator, // Pode atualizar status
    canEditStock: isAdmin || isCollaborator, // Pode ajustar estoque
    canEditSettings: isAdmin, // Apenas admin
    canEditPromotions: isAdmin, // Apenas admin
    
    // Deleção
    canDeleteProducts: isAdmin, // Apenas admin
    canDeleteOrders: isAdmin, // Apenas admin
    
    // Gestão de Usuários
    canManageUsers: isAdmin, // Apenas admin
    
    // Role info
    role,
    isAdmin,
    isCollaborator,
  };

  return { ...permissions, isLoading };
}
