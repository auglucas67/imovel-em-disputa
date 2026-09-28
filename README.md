# Imóvel em Disputa

Site publicado: https://imovel-em-disputa.auglucas.workers.dev/

MVP de catálogo para descoberta de imóveis ofertados pela CAIXA. O feed preserva o link oficial de cada imóvel e usa o CSV nacional público que a CAIXA publica em `venda-imoveis.caixa.gov.br/listaweb/`.

## Sincronização do catálogo

A opção **Todos** na [lista completa da CAIXA](https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp) fornece um CSV nacional. O script `scripts/download-caixa.ps1` baixa esse arquivo e `scripts/sync-caixa.mjs` valida as colunas, normaliza os registros e gera `public/data/listings.json`. Um arquivo inválido ou indisponível não substitui o catálogo anterior.

Para atualizar manualmente, execute `pnpm run sync:caixa` no Windows. O fluxo `.github/workflows/sync-caixa.yml` tenta uma atualização diária às 09:20 UTC e envia o feed validado ao repositório. O site lê esse arquivo diretamente do GitHub a cada visita, usando a cópia publicada no Cloudflare como reserva se o GitHub estiver indisponível. Assim, mudanças nos imóveis não exigem um novo deploy. Caso a CAIXA bloqueie a execução remota, o fluxo falha e o último catálogo válido continua disponível. A sincronização não acessa áreas autenticadas nem envia propostas.

## Publicação

1. `pnpm install`
2. `pnpm run sync:caixa`
3. `pnpm run deploy` com sua conta Cloudflare autenticada

O Worker publica os arquivos estáticos em `public/` no Cloudflare Workers. Mudanças de layout ou código ainda exigem um novo deploy; atualizações apenas do catálogo não.

## Fotos e filtros

As fotos são carregadas diretamente da galeria pública de cada imóvel no domínio oficial da CAIXA. Quando não há foto acessível, o cartão mostra um indicador neutro. Os filtros de estado, cidade, bairro, preço, desconto, tipo, modalidade, financiamento e área funcionam com a lista nacional; a área é extraída da descrição do CSV. Os filtros podem ser salvos no próprio navegador.

FGTS, condição de disputa, despesas de condomínio/IPTU e data do leilão não estão no CSV nacional. Por isso não são apresentados como filtros ativos: precisariam de enriquecimento verificável das páginas de detalhe, imóvel por imóvel.
