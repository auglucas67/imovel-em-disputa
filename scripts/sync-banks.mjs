import { load } from 'cheerio';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('public/data/banks.json');
const money = text => {
  const match = String(text).match(/R\$\s*([\d.]+,\d{2})/);
  return match ? Number(match[1].replaceAll('.', '').replace(',', '.')) : null;
};
const absolute = (base, value) => value ? new URL(value, base).href.split('?')[0] : '';
const clean = text => String(text || '').replace(/\s+/g, ' ').trim();

async function html(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'ImovelEmDisputa/1.0 (+https://github.com/auglucas67/imovel-em-disputa)',
      ...options.headers } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function bbPage(page) {
  const body = new URLSearchParams({ pagina: String(page), categorias: '', tipoVenda: '',
    tipoPagamento: '', evolua: '', localidade: '||', minimo: '', maximo: '', texto: '',
    ordem: '0', contento: '3', cppnp: '' });
  const raw = await html('https://www.seuimovelbb.com.br/catalogo', {
    method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const result = JSON.parse(raw);
  if (!result.sucesso || !Number.isFinite(Number(result.imoveis))) throw new Error('Resposta BB inválida');
  const $ = load(result.lista || '');
  const listings = [];
  $('.card.carta').each((_, element) => {
    const card = $(element);
    const path = card.find('a[href^="/imovel/id/"]').first().attr('href') || '';
    const id = path.match(/\/imovel\/id\/(\d+)/)?.[1];
    const price = money(card.find('.valor').first().text());
    const location = clean(card.find('.localidade').first().text()).match(/^(.+?)\s*-\s*([A-Z]{2})$/);
    const type = clean(card.find('.tipo').first().text()) || 'Imóvel';
    if (!id || !price || !location) return;
    const event = clean(card.find('.leilao:not(.d-none)').first().text());
    listings.push({ id: `bb-${id}`, bank: 'Banco do Brasil', state: location[2],
      city: location[1], neighborhood: '', address: '', type, price, appraisal: null,
      discount: null, financing: false, fgts: null, inDispute: null, description: '',
      mode: /venda direta/i.test(event) ? 'Venda direta' : 'Leilão',
      imageUrl: absolute('https://www.seuimovelbb.com.br', card.find('.foto').attr('src')),
      officialUrl: absolute('https://www.seuimovelbb.com.br', path),
      sourceName: 'Seu Imóvel BB' });
  });
  return { total: Number(result.imoveis), listings };
}

async function syncBB() {
  const first = await bbPage(1);
  if (first.total < 50) throw new Error(`BB retornou apenas ${first.total} registros`);
  const pages = Math.ceil(first.total / 200);
  if (pages > 50) throw new Error(`Paginação BB inesperada: ${pages}`);
  const listings = [...first.listings];
  for (let page = 2; page <= pages; page += 1) {
    const next = await bbPage(page);
    if (next.total !== first.total) throw new Error('Catálogo BB mudou durante a coleta');
    listings.push(...next.listings);
  }
  const unique = [...new Map(listings.map(item => [item.id, item])).values()];
  if (unique.length < 20) throw new Error('BB sem anúncios precificados suficientes');
  return unique;
}

async function megaPage(seller, page) {
  const url = `https://www.megaleiloes.com.br/imoveis?banco=${seller}&pagina=${page}`;
  const $ = load(await html(url));
  const pages = Math.max(1, ...$('a[href*="pagina="]').map((_, a) =>
    Number(new URL($(a).attr('href'), url).searchParams.get('pagina')) || 1).get());
  const listings = [];
  $('.col-sm-6.col-md-4.col-lg-3[data-key]').each((_, element) => {
    const card = $(element);
    if (!card.find('.card.open').length) return;
    const id = String(card.attr('data-key') || '');
    const link = card.find('a.card-title').attr('href') || '';
    const officialUrl = absolute(url, link);
    const price = money(card.find('.card-price').first().text());
    const location = clean(card.find('.card-locality').first().text()).match(/^(.+?),\s*([A-Z]{2})$/);
    const title = clean(card.find('.card-title').first().text());
    if (!/^\d+$/.test(id) || !price || !location || !officialUrl.startsWith('https://www.megaleiloes.com.br/imoveis/')) return;
    const type = title.match(/^(Apartamento|Casa|Terreno|Lote|Sala|Loja|Prédio|Galpão|Gleba|Ex-agência)/i)?.[1] || 'Imóvel';
    const imageUrl = card.find('.card-image').attr('data-bg') || '';
    const date = clean(card.find('.instance.active .card-first-instance-date, .instance.active .card-second-instance-date').first().text());
    const dateParts = date.match(/(\d{2})\/(\d{2})\/(\d{4}) às (\d{2}):(\d{2})/);
    const endTime = dateParts
      ? Date.parse(`${dateParts[3]}-${dateParts[2]}-${dateParts[1]}T${dateParts[4]}:${dateParts[5]}:00-03:00`) : NaN;
    const auctionEndsAt = Number.isFinite(endTime) ? new Date(endTime).toISOString() : null;
    if (auctionEndsAt && Date.parse(auctionEndsAt) < Date.now()) return;
    const bidCount = Number(clean(card.find('.card-views-bids span').eq(1).text()).replace(/\D/g, '')) || 0;
    listings.push({ id: `mega-${id}`, state: location[2], city: location[1],
      neighborhood: '', address: '', type, price, appraisal: null, discount: null,
      financing: false, fgts: null, inDispute: bidCount > 0 && Boolean(auctionEndsAt), bidCount,
      description: title, mode: 'Leilão', auctionDate: date, auctionEndsAt,
      imageUrl: /^https:\/\/cdn\d*\.megaleiloes\.com\.br\//.test(imageUrl) ? imageUrl : '',
      officialUrl, sourceName: 'Mega Leilões' });
  });
  return { pages, listings };
}

async function syncMegaBank(bank, sellers) {
  const collected = [];
  for (const seller of sellers) {
    const first = await megaPage(seller, 1);
    if (first.pages > 50) throw new Error(`Paginação Mega Leilões inesperada: ${first.pages}`);
    collected.push(...first.listings);
    for (let page = 2; page <= first.pages; page += 1) {
      collected.push(...(await megaPage(seller, page)).listings);
    }
  }
  const unique = [...new Map(collected.map(item => [item.id, { ...item, bank }])).values()];
  if (!unique.length) throw new Error(`${bank}: nenhum anúncio validado`);
  return unique;
}

const groups = {
  'Banco do Brasil': await syncBB(),
  'Itaú': await syncMegaBank('Itaú', [1, 57]),
  'Santander': await syncMegaBank('Santander', [2, 69]),
};
const listings = Object.values(groups).flat();
const feed = { syncedAt: new Date().toISOString(), total: listings.length,
  coverage: 'BB: portal Seu Imóvel BB; Itaú e Santander: ofertas publicadas na Mega Leilões (cobertura parcial)',
  counts: Object.fromEntries(Object.entries(groups).map(([name, items]) => [name, items.length])), listings };
await mkdir(resolve('public/data'), { recursive: true });
await writeFile(`${output}.tmp`, JSON.stringify(feed));
await rename(`${output}.tmp`, output);
console.log(`Catálogo adicional atualizado: ${JSON.stringify(feed.counts)}`);
