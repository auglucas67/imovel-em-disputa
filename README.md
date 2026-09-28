# Imóvel em Disputa

MVP de catálogo para descoberta de imóveis ofertados pela CAIXA. O feed preserva o link oficial de cada imóvel e usa exclusivamente os CSVs públicos que a própria CAIXA publica por UF em `venda-imoveis.caixa.gov.br/listaweb/`.

## Sincronização do catálogo

A opção **Todos** na [lista completa da CAIXA](https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp) fornece um CSV nacional. O script `scripts/download-caixa.ps1` baixa esse arquivo e `scripts/sync-caixa.mjs` valida as colunas, normaliza os registros e gera `public/data/listings.json`. Um arquivo inválido ou indisponível não substitui o catálogo anterior.

Para atualizar manualmente, execute `pnpm run sync:caixa` no Windows. O fluxo `.github/workflows/sync-caixa.yml` tenta uma atualização diária às 09:20 UTC e envia o feed validado ao repositório. Caso a CAIXA bloqueie a execução remota, o fluxo falha e o catálogo publicado continua disponível. A sincronização não acessa áreas autenticadas nem envia propostas.

## Publicação

1. `pnpm install`
2. `pnpm run sync:caixa`
3. `pnpm run deploy` com sua conta Cloudflare autenticada

O Worker publica os arquivos estáticos em `public/` no Cloudflare Workers.
