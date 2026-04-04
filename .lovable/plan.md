
## Diagnóstico Atual do SP2

| Serviço | Status | Observação |
|---------|--------|------------|
| Kong (Gateway) | ✅ 200 OK | JWT aceito corretamente |
| PostgREST (API) | ✅ 200 OK | Respondendo, mas tabelas vazias |
| Auth (GoTrue) | ✅ 200 OK | Login/signup funcional |
| Storage | ✅ 200 OK | Buckets product-images e order-pdfs existem |
| **Dados** | ❌ Vazio | products=0, categories=0, orders=0 |

### Problema Principal
O PostgREST provavelmente está conectado ao banco `postgres` padrão, mas os dados migrados estão no banco `supabase_sp2`. Apenas `store_settings` (1), `customers` (2) e `user_roles` (2) possuem dados.

---

## Plano de Ação (7 etapas)

### Etapa 1: Confirmar banco do PostgREST
Verificar no VPS qual database o PostgREST está usando:
```bash
cd /opt/apps/supabase-sp2 && docker compose exec rest env | grep PGRST_DB_URI
```
Se apontar para `postgres` em vez de `supabase_sp2`, corrigir no `.env` e recriar.

### Etapa 2: Re-sincronizar dados do Lovable Cloud → SP2
Após confirmar o banco correto, executar sync completo das 17 tabelas:
- products, categories, product_variants, product_images
- customers, order_intents, order_intent_items, order_history
- promotions, stock_movements, store_settings
- shopify_product_mappings, shopify_variant_mappings, shopify_sync_logs
- user_roles, profiles
- Sequência `order_number_seq`

### Etapa 3: Validar auth com login real
Testar login com `contato@tggriffes.com.br` via endpoint Auth do SP2 para garantir que os usuários migrados funcionam.

### Etapa 4: Validar Edge Functions
Verificar se o edge-runtime do SP2 está rodando e se as 9 funções estão respondendo (calculate-shipping, generate-order-pdf, etc.)

### Etapa 5: Configurar DNS/Domínio
Apontar `atacado.tggriffes.com.br` para o frontend no VPS que conectará ao SP2 como backend.

### Etapa 6: Switchover do Frontend
Atualizar as variáveis de ambiente do frontend para usar:
- `SUPABASE_URL` → `https://sp2.srv981319.hstgr.cloud`
- `SUPABASE_ANON_KEY` → nova chave gerada

### Etapa 7: Monitoramento pós-switchover
- Verificar pedidos entrando
- Confirmar sync Shopify funcionando
- Validar cálculo de frete

---

## Riscos e Mitigação
- **Perda de dados durante switchover**: Fazer sync delta imediatamente antes da troca
- **Downtime**: Switchover pode ser feito em horário de baixo movimento
- **Rollback**: Manter Lovable Cloud como fallback por 48h
