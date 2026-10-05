# Project rules

- Compare local and Shopify catalog status through the read-only `audit_active_products` action in the existing Shopify sync function; mappings alone do not prove Shopify status, and the audit must never change products.