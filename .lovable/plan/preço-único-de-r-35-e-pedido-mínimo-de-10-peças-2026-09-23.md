# Preço único de R$ 35 e pedido mínimo de 10 peças

## Objetivo
Aplicar R$ 35,00 como preço definitivo de todos os produtos da loja e impedir a finalização de pedidos com menos de 10 peças.

## Alterações
- Atualizar todos os produtos existentes para R$ 35,00 no banco de dados.
- Garantir que novos produtos sejam criados com R$ 35,00 por padrão, preservando a edição administrativa permitida pelas regras atuais.
- Atualizar o banner para comunicar claramente: “Tudo por R$ 35” e “Pedido mínimo de 10 peças”.
- Remover da experiência pública a antiga condição promocional por quantidade/tamanhos, evitando desconto duplicado.
- Mostrar no carrinho quantas peças faltam para atingir o mínimo.
- Manter “Finalizar compra” desabilitado até o carrinho chegar a 10 peças.
- Validar novamente o mínimo ao concluir o pedido, evitando contorno da regra por estado antigo do navegador.
- Garantir que carrinho, pedido salvo, PDF e mensagem do WhatsApp usem o valor unitário definitivo de R$ 35,00.

## Segurança da mudança
- A alteração em massa de preços será feita por migração rastreável.
- Produtos inativos também receberão o novo preço, para voltarem corretos quando reativados.
- O Shopify não será alterado, conforme a opção escolhida.

## Validação
- Conferir catálogo e página do produto com R$ 35,00.
- Testar carrinho com 9 peças bloqueado e 10 peças liberado.
- Testar um pedido completo e conferir total, PDF e mensagem do WhatsApp.
- Conferir a versão móvel e a versão para computador.
