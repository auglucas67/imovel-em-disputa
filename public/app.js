const money = value => Number(value).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
});
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const normalizeText = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const els = {
  cards: document.querySelector('#cards'), count: document.querySelector('#count'),
  state: document.querySelector('#stateFilter'), city: document.querySelector('#cityFilter'),
  mode: document.querySelector('#modeFilter'), type: document.querySelector('#typeFilter'),
  price: document.querySelector('#priceFilter'), sort: document.querySelector('#sortFilter'),
  dialog: document.querySelector('#detailDialog'), sourceStatus: document.querySelector('#sourceStatus'),
  more: document.querySelector('#moreButton'),
};

let listings = [];
let visibleCount = 24;
let activeQuick = '';

function addOptions(select, values) {
  [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
}

function filtered() {
  const city = normalizeText(els.city.value);
  const maxPrice = Number(els.price.value);
  const items = listings.filter(item =>
    (!els.state.value || item.state === els.state.value)
    && (!city || normalizeText(item.city).includes(city))
    && (!els.mode.value || item.mode === els.mode.value)
    && (!els.type.value || item.type === els.type.value)
    && (!maxPrice || item.price <= maxPrice)
    && (activeQuick !== 'financing' || item.financing)
    && (activeQuick !== 'discount' || item.discount >= 30));
  return items.sort((a, b) => els.sort.value === 'price'
    ? a.price - b.price : b.discount - a.discount);
}

function render() {
  const items = filtered();
  els.count.textContent = `${items.length.toLocaleString('pt-BR')} ${items.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}`;
  els.cards.innerHTML = items.length ? items.slice(0, visibleCount).map(item => `
    <article class="card" data-id="${escapeHtml(item.id)}">
      <div class="card-photo" aria-label="Imagem ilustrativa, não representa o imóvel anunciado">
        <span>${Number(item.discount).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% OFF</span>
        <div class="photo-mark">${escapeHtml(item.type.slice(0, 1))}</div>
        <small>Foto não disponibilizada na lista</small>
      </div>
      <div class="card-body">
        <p>${escapeHtml(item.city)}, ${escapeHtml(item.state)} <small>· ${escapeHtml(item.neighborhood)}</small></p>
        <h3>${escapeHtml(item.type)}</h3>
        <div class="tags">${item.financing ? '<b>Financiamento</b>' : ''}<b>CAIXA</b></div>
        <strong>${money(item.price)}</strong>
        <del>Valor de avaliação ${money(item.appraisal)}</del>
        <footer><span>${escapeHtml(item.mode)}</span><button class="detail-button" type="button">Ver detalhes <i>→</i></button></footer>
      </div>
    </article>`).join('')
    : '<div class="empty">Nenhum imóvel encontrado. Ajuste os filtros e tente novamente.</div>';
  els.more.hidden = items.length <= visibleCount;
}

function openDetail(id) {
  const item = listings.find(listing => listing.id === id);
  if (!item) return;
  const officialUrl = new URL(item.officialUrl);
  if (officialUrl.hostname !== 'venda-imoveis.caixa.gov.br') return;
  document.querySelector('#detailContent').innerHTML = `
    <p class="eyebrow">${escapeHtml(item.mode.toUpperCase())} · Nº ${escapeHtml(item.id)}</p>
    <h2>${escapeHtml(item.type)} em ${escapeHtml(item.city)}, ${escapeHtml(item.state)}</h2>
    <p>${escapeHtml(item.neighborhood)} · ${escapeHtml(item.address)}</p>
    <strong>${money(item.price)}</strong>
    <p>Valor de avaliação: ${money(item.appraisal)} · desconto informado: ${Number(item.discount).toLocaleString('pt-BR')}%</p>
    <p>${escapeHtml(item.description)}</p>
    <a class="button primary" href="${escapeHtml(officialUrl.href)}" target="_blank" rel="noopener noreferrer">Abrir este imóvel na CAIXA ↗</a>
    <small>Confirme preço, disponibilidade, edital e condições no portal da CAIXA.</small>`;
  els.dialog.showModal();
}

async function loadCatalog() {
  els.sourceStatus.textContent = 'CARREGANDO LISTA DA CAIXA';
  try {
    const response = await fetch('/data/listings.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const feed = await response.json();
    if (!Array.isArray(feed.listings) || feed.listings.length < 1000) throw new Error('Catálogo incompleto');
    listings = feed.listings;
    addOptions(els.state, listings.map(item => item.state));
    addOptions(els.mode, listings.map(item => item.mode));
    addOptions(els.type, listings.map(item => item.type));
    els.sourceStatus.textContent = `LISTA DA CAIXA · GERADA EM ${feed.generatedAt || new Date(feed.syncedAt).toLocaleDateString('pt-BR')}`;
  } catch (error) {
    els.sourceStatus.textContent = 'CATÁLOGO TEMPORARIAMENTE INDISPONÍVEL';
    els.cards.innerHTML = '<div class="empty">Não foi possível carregar a lista agora. Consulte o portal oficial da CAIXA.</div>';
    els.more.hidden = true;
    console.error('Falha ao carregar catálogo:', error);
    return;
  }
  render();
}

document.querySelector('#searchButton').addEventListener('click', () => {
  visibleCount = 24;
  render();
  document.querySelector('#oportunidades').scrollIntoView({ behavior: 'smooth' });
});
[els.state, els.mode, els.type, els.price, els.sort].forEach(element =>
  element.addEventListener('change', () => { visibleCount = 24; render(); }));
els.city.addEventListener('input', () => { visibleCount = 24; render(); });
document.querySelectorAll('[data-quick]').forEach(button => button.addEventListener('click', () => {
  activeQuick = activeQuick === button.dataset.quick ? '' : button.dataset.quick;
  document.querySelectorAll('[data-quick]').forEach(candidate =>
    candidate.classList.toggle('active', candidate.dataset.quick === activeQuick));
  visibleCount = 24;
  render();
}));
els.cards.addEventListener('click', event => {
  if (event.target.closest('.detail-button')) openDetail(event.target.closest('.card').dataset.id);
});
els.more.addEventListener('click', () => { visibleCount += 24; render(); });
document.querySelector('.close').addEventListener('click', () => els.dialog.close());
document.querySelector('#year').textContent = new Date().getFullYear();
loadCatalog();
