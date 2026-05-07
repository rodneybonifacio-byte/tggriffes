import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Settings, 
  LogOut, 
  Menu,
  ChevronLeft,
  Warehouse,
  Tag,
  Users,
  ShoppingBasket,
  Store,
  UserCog,
  LayoutGrid,
  Receipt,
  LucideIcon
} from 'lucide-react';
import logoImage from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { BillingBanner } from '@/components/admin/BillingBanner';
import { BillingPaymentModal } from '@/components/admin/BillingPaymentModal';

interface MenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  permission?: keyof ReturnType<typeof usePermissions>;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin', permission: 'canViewDashboard' },
  { icon: Package, label: 'Produtos', href: '/admin/produtos', permission: 'canViewProducts' },
  { icon: LayoutGrid, label: 'Organizar Home', href: '/admin/organizar-home', permission: 'canEditProducts' },
  { icon: Warehouse, label: 'Estoque', href: '/admin/estoque', permission: 'canViewStock' },
  { icon: Tag, label: 'Promoções', href: '/admin/promocoes', permission: 'canViewPromotions' },
  { icon: ShoppingCart, label: 'Pedidos', href: '/admin/pedidos', permission: 'canViewOrders' },
  { icon: ShoppingBasket, label: 'Abandonados', href: '/admin/carrinhos', permission: 'canViewAbandonedCarts' },
  { icon: Users, label: 'Clientes', href: '/admin/clientes', permission: 'canViewCustomers' },
  { icon: Store, label: 'Shopify', href: '/admin/shopify', permission: 'canViewShopify' },
  { icon: UserCog, label: 'Usuários', href: '/admin/usuarios', permission: 'canManageUsers' },
  { icon: Settings, label: 'Configurações', href: '/admin/configuracoes', permission: 'canViewSettings' },
  { icon: Receipt, label: 'Assinatura BRHUB', href: '/admin/cobranca', permission: 'canViewSettings' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
}

export function AdminLayout({ children, title, backHref }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const permissions = usePermissions();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  // Filtrar itens do menu baseado nas permissões
  const visibleMenuItems = menuItems.filter(item => {
    // Durante carregamento das permissões, mostrar todos os itens para evitar
    // que o menu pisque vazio (especialmente após deploy/refresh)
    if (permissions.isLoading) return true;
    if (!item.permission) return true;
    return permissions[item.permission] === true;
  });

  const NavContent = () => (
    <nav className="flex flex-col h-full">
      <div className="p-6 border-b">
        <Link to="/" className="block">
          <img src={logoImage} alt="Logo" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm text-muted-foreground">Painel Admin</p>
          {permissions.isCollaborator && (
            <Badge variant="secondary" className="text-xs">Colaborador</Badge>
          )}
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-1">
        {visibleMenuItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/admin' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t">
        <div className="text-sm text-muted-foreground mb-3 truncate">
          {user?.email}
        </div>
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:bg-background lg:border-r">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-4 h-16 px-4 border-b bg-background">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent />
          </SheetContent>
        </Sheet>
        
        {backHref && (
          <Link to={backHref}>
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
        )}
        
        <h1 className="font-display text-lg font-semibold truncate">
          {title || 'Admin'}
        </h1>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <BillingBanner />
        <BillingPaymentModal />
        <div className="p-4 lg:p-8">
          {/* Desktop Title */}
          {title && (
            <div className="hidden lg:flex items-center gap-4 mb-6">
              {backHref && (
                <Link to={backHref}>
                  <Button variant="ghost" size="icon">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </Link>
              )}
              <h1 className="font-display text-2xl font-bold">{title}</h1>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
