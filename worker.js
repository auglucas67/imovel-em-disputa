// Os arquivos estáticos são atendidos pelo Cloudflare Assets.
// A sincronização do catálogo é feita pelo script scripts/sync-caixa.mjs em
// ambiente autorizado, pois a CAIXA bloqueia acessos automatizados originados
// de Workers com Radware Bot Manager.
export default {
  fetch() {
    return new Response('Not found', { status: 404 });
  },
};
