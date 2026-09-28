# Imóvel em Disputa

MVP de catálogo para descoberta de imóveis ofertados pela CAIXA. O feed preserva o link oficial de cada imóvel e usa exclusivamente os CSVs públicos que a própria CAIXA publica por UF em `venda-imoveis.caixa.gov.br/listaweb/`.

## Sincronização do catálogo

O portal da CAIXA responde com Radware Bot Manager CAPTCHA quando a coleta vem da infraestrutura do Cloudflare. Por isso a sincronização roda em uma máquina/servidor autorizado, sem tentar contornar esta proteção:

```powershell
pnpm run sync:caixa
```

Para um teste rápido de uma UF:

```powershell
pnpm run sync:caixa --states=MG
```

O comando gera `public/data/listings.json`, que é publicado como feed estático junto com o site. Programe este comando uma vez ao dia apenas depois de obter a autorização da CAIXA para reutilização comercial dos dados. A navegação nunca envia propostas nem manipula áreas autenticadas.

## Publicação

1. `npm install --save-dev wrangler`
2. `npx wrangler login`
3. `npm run deploy`

O Worker publica os arquivos estáticos em `public/` no Cloudflare Workers.
