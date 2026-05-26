import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { usePWA } from "@/hooks/usePWA";
import Index from "./pages/Index";
import ProductPage from "./pages/ProductPage";
import Install from "./pages/Install";
import PedidoPDF from "./pages/PedidoPDF";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminStock from "./pages/admin/AdminStock";
import AdminPromotions from "./pages/admin/AdminPromotions";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminAbandonedCarts from "./pages/admin/AdminAbandonedCarts";
import AdminShopify from "./pages/admin/AdminShopify";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminImageOptimizer from "./pages/admin/AdminImageOptimizer";
import AdminHomeOrganization from "./pages/admin/AdminHomeOrganization";
import AdminBilling from "./pages/admin/AdminBilling";
import { SiteBlockGuard } from "@/components/SiteBlockGuard";
import { PageViewTracker } from "@/components/PageViewTracker";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerRegister from "./pages/customer/CustomerRegister";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - reduces unnecessary refetches
      retry: 1,
    },
  },
});

const App = () => {
  usePWA();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <SiteBlockGuard>
              <PageViewTracker />
              <Routes>
              {/* Public Store */}
                <Route path="/" element={<Index />} />
                <Route path="/produto/:slug" element={<ProductPage />} />
                <Route path="/instalar" element={<Install />} />
                <Route path="/pedidos/pdf/:orderNumber" element={<PedidoPDF />} />
                
                {/* Customer Area */}
                <Route path="/entrar" element={<CustomerLogin />} />
                <Route path="/criar-conta" element={<CustomerRegister />} />
                <Route path="/minha-conta" element={<CustomerDashboard />} />

                {/* Admin */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/produtos" element={<AdminProducts />} />
                <Route path="/admin/produtos/novo" element={<AdminProductForm />} />
                <Route path="/admin/produtos/:id" element={<AdminProductForm />} />
                <Route path="/admin/estoque" element={<AdminStock />} />
                <Route path="/admin/promocoes" element={<AdminPromotions />} />
                <Route path="/admin/pedidos" element={<AdminOrders />} />
                <Route path="/admin/clientes" element={<AdminCustomers />} />
                <Route path="/admin/carrinhos" element={<AdminAbandonedCarts />} />
                <Route path="/admin/shopify" element={<AdminShopify />} />
                <Route path="/admin/configuracoes" element={<AdminSettings />} />
                <Route path="/admin/usuarios" element={<AdminUsers />} />
                <Route path="/admin/otimizar-imagens" element={<AdminImageOptimizer />} />
                <Route path="/admin/organizar-home" element={<AdminHomeOrganization />} />
                <Route path="/admin/cobranca" element={<AdminBilling />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </SiteBlockGuard>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

