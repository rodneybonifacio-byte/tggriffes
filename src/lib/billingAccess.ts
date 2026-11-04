export type BillingRole = 'admin' | 'seller' | 'customer' | null | undefined;

/**
 * Admins e colaboradores (vendedores) podem ver e pagar a mensalidade da loja.
 * Clientes da loja não têm acesso à cobrança.
 */
export function canViewBilling(role: BillingRole): boolean {
  return role === 'admin' || role === 'seller';
}
