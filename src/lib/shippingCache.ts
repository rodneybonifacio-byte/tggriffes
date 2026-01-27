/**
 * Cache local para cálculos de frete
 * Evita chamadas repetidas à Edge Function para mesmas condições
 */

export interface ShippingCacheEntry {
  options: ShippingOption[];
  timestamp: number;
  warning?: string;
}

export interface ShippingOption {
  service: string;
  price: number;
  deadline: number;
}

interface ShippingParams {
  cepOrigem: string;
  cepDestino: string;
  peso: number;
  comprimento: number;
  largura: number;
  altura: number;
}

const CACHE_KEY = 'tg-shipping-cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos
const MAX_CACHE_ENTRIES = 20; // Limita entradas para não ocupar muito storage

/**
 * Gera uma chave única para os parâmetros de frete
 */
export function generateCacheKey(params: ShippingParams): string {
  // Arredonda dimensões para reduzir variações insignificantes
  const peso = Math.round(params.peso / 100) * 100; // Arredonda para 100g
  const comprimento = Math.round(params.comprimento);
  const largura = Math.round(params.largura);
  const altura = Math.round(params.altura);
  
  return `${params.cepOrigem}|${params.cepDestino}|${peso}|${comprimento}|${largura}|${altura}`;
}

/**
 * Obtém o cache do sessionStorage
 */
function getCache(): Map<string, ShippingCacheEntry> {
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (!stored) return new Map();
    
    const parsed = JSON.parse(stored);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

/**
 * Salva o cache no sessionStorage
 */
function saveCache(cache: Map<string, ShippingCacheEntry>): void {
  try {
    // Limpa entradas expiradas
    const now = Date.now();
    const validEntries = Array.from(cache.entries())
      .filter(([, entry]) => now - entry.timestamp < CACHE_TTL)
      .slice(-MAX_CACHE_ENTRIES); // Mantém apenas as últimas N entradas
    
    const obj = Object.fromEntries(validEntries);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Falha silenciosa se não conseguir salvar (quota excedida, etc)
    console.warn('[shippingCache] Failed to save cache');
  }
}

/**
 * Busca resultado cacheado para os parâmetros de frete
 */
export function getCachedShipping(params: ShippingParams): ShippingCacheEntry | null {
  const key = generateCacheKey(params);
  const cache = getCache();
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  // Verifica se ainda é válido
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    // Expirado, remove do cache
    cache.delete(key);
    saveCache(cache);
    return null;
  }
  
  console.log('[shippingCache] Cache hit for', key);
  return entry;
}

/**
 * Armazena resultado de cálculo de frete no cache
 */
export function setCachedShipping(
  params: ShippingParams, 
  options: ShippingOption[], 
  warning?: string
): void {
  const key = generateCacheKey(params);
  const cache = getCache();
  
  cache.set(key, {
    options,
    timestamp: Date.now(),
    warning,
  });
  
  saveCache(cache);
  console.log('[shippingCache] Cached result for', key);
}

/**
 * Limpa todo o cache de frete
 */
export function clearShippingCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignora erros
  }
}
