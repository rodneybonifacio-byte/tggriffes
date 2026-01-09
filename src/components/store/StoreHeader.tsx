import { Link } from 'react-router-dom';
import { Search, Menu, X, Settings } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useCategories } from '@/hooks/useProducts';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { getWhatsAppLink } from '@/lib/utils';
import logoImage from '@/assets/logo.png';
import { CartDrawer } from './CartDrawer';

interface StoreHeaderProps {
  onSearch?: (query: string) => void;
  searchValue?: string;
}

export function StoreHeader({ onSearch, searchValue = '' }: StoreHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchValue);
  const { data: categories } = useCategories();
  const { data: settings } = useStoreSettings();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(localSearch);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <nav className="flex flex-col gap-4 mt-8">
              <Link to="/" className="text-lg font-medium hover:text-primary/80">
                Início
              </Link>
              <Link to="/admin" className="text-lg font-medium hover:text-primary/80 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Painel Admin
              </Link>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-muted-foreground mb-2">Categorias</p>
                {categories?.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/?category=${cat.slug}`}
                    className="block py-2 hover:text-primary/80"
                    onClick={() => {
                      // Close the sheet after clicking
                      const closeButton = document.querySelector('[data-sheet-close]') as HTMLButtonElement;
                      closeButton?.click();
                    }}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logoImage} alt={settings?.store_name || 'TG GRIFFES'} className="h-10 md:h-12" />
        </Link>

        {/* Desktop Search */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-10 bg-secondary border-0"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {/* WhatsApp */}
          {settings?.seller_whatsapp && (
            <a
              href={getWhatsAppLink(settings.seller_whatsapp, 'Olá! Vim pelo catálogo online.')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon" className="text-whatsapp hover:text-whatsapp/80">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </Button>
            </a>
          )}

          {/* Cart */}
          <CartDrawer />
        </div>
      </div>

      {/* Mobile Search Bar */}
      {isSearchOpen && (
        <form onSubmit={handleSearch} className="md:hidden border-t p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-10 bg-secondary border-0"
              autoFocus
            />
          </div>
        </form>
      )}

      {/* Desktop Categories */}
      <nav className="hidden lg:block">
        <div className="container">
          <div className="flex items-center gap-6 h-12 overflow-x-auto scrollbar-hide">
            {categories?.map((cat) => (
              <Link
                key={cat.id}
                to={`/?category=${cat.slug}`}
                className="text-sm font-medium whitespace-nowrap hover:text-primary/80 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
