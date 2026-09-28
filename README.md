# Imóvel em Disputa

MVP de catálogo para descoberta de imóveis ofertados pela CAIXA. A base apresentada é demonstrativa: antes da publicação com dados reais, a ingestão precisa usar uma fonte autorizada pela CAIXA.

## Publicação

1. `npm install --save-dev wrangler`
2. `npx wrangler login`
3. `npm run deploy`

O Worker publica os arquivos estáticos em `public/` no Cloudflare Workers.
