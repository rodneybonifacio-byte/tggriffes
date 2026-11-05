# Project rules

- Compare local and Shopify catalog status through the read-only `audit_active_products` action in the existing Shopify sync function; mappings alone do not prove Shopify status, and the audit must never change products.
- Share billing calculations between frontend and edge functions; use paid annual invoice coverage dates to suppress covered monthly charges and cancel covered unpaid invoices only after bank confirmation.
- Storefront checkout must explicitly insert draft orders even for staff sessions, then release reservations and finalize; this prevents premature or double stock deductions.