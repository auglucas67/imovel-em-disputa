# Imóvel em Disputa

Site publicado: https://imovel-em-disputa.auglucas.workers.dev/

Catálogo independente para descoberta de imóveis anunciados pela CAIXA, Banco do Brasil, Itaú e Santander. Cada imóvel mantém um link direto para o anúncio de origem. A cobertura da CAIXA é nacional; a de Itaú e Santander abrange apenas as ofertas encontradas na Mega Leilões.

## Sincronização do catálogo

A opção **Todos** na [lista completa da CAIXA](https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp) fornece um CSV nacional. O script `scripts/download-caixa.ps1` baixa esse arquivo e `scripts/sync-caixa.mjs` valida as colunas, normaliza os registros e gera `public/data/listings.json`. Um arquivo inválido ou indisponível não substitui o catálogo anterior.

Para atualizar manualmente, execute `pnpm run sync:caixa` no Windows. O fluxo `.github/workflows/sync-caixa.yml` tenta uma atualização diária às 09:20 UTC e envia o feed validado ao repositório. O site lê esse arquivo diretamente do GitHub a cada visita, usando a cópia publicada no Cloudflare como reserva se o GitHub estiver indisponível. Assim, mudanças nos imóveis não exigem um novo deploy. Caso a CAIXA bloqueie a execução remota, o fluxo falha e o último catálogo válido continua disponível. A sincronização não acessa áreas autenticadas nem envia propostas.

## Banco do Brasil, Itaú e Santander

`pnpm run sync:banks` consulta anúncios públicos no [Seu Imóvel BB](https://www.seuimovelbb.com.br/catalogo) e nas páginas de vendedor Itaú/Santander da [Mega Leilões](https://www.megaleiloes.com.br/imoveis). O importador usa apenas cards com preço, localização, link e estado aberto; não estima avaliação ou desconto ausentes. O resultado fica em `public/data/banks.json`. O fluxo `.github/workflows/sync-banks.yml` tenta atualizar diariamente às 09:45 UTC; se uma fonte falhar, não substitui o feed anterior. No site, anúncios dos outros bancos são ocultados automaticamente se o feed tiver mais de 72 horas, para não apresentar anúncios possivelmente encerrados como atuais. A cobertura de Itaú e Santander é parcial e não equivale ao inventário completo de cada banco.

As páginas dos bancos e do leiloeiro podem mudar sem aviso, e não há API pública contratada. Preço, data, disponibilidade, edital, comissão e condições devem sempre ser confirmados no link do anúncio antes de qualquer lance.

## Publicação

1. `pnpm install`
2. `pnpm run sync:caixa`
3. `pnpm run sync:banks`
4. `pnpm run deploy` com sua conta Cloudflare autenticada

O Worker publica os arquivos estáticos em `public/` no Cloudflare Workers. Mudanças de layout ou código ainda exigem um novo deploy; atualizações apenas do catálogo não.

## Fotos e filtros

As fotos são carregadas da galeria pública da CAIXA ou do anúncio de origem de BB/Mega Leilões. Quando não há foto acessível, o cartão mostra um indicador neutro. A primeira tela mantém uma busca simples (estado, cidade, banco, modalidade, tipo e valor); ao avançar para os resultados, aparecem os filtros laterais de banco, múltiplos estados/cidades, bairro, preço, desconto, tipo, modalidade, financiamento e área. A área é extraída da descrição quando disponível. Os filtros podem ser salvos no próprio navegador e retomados pela busca inicial.

FGTS, condição de disputa, despesas de condomínio/IPTU e data do leilão não estão no CSV nacional. Por isso não são apresentados como filtros ativos: precisariam de enriquecimento verificável das páginas de detalhe, imóvel por imóvel.
