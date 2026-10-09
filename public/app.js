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
  results: document.querySelector('#oportunidades'),
  quickState: document.querySelector('#quickState'), quickCity: document.querySelector('#quickCity'),
  quickCityOptions: document.querySelector('#quickCityOptions'), quickMode: document.querySelector('#quickMode'),
  quickType: document.querySelector('#quickType'), quickBank: document.querySelector('#quickBank'),
  quickPrice: document.querySelector('#quickPrice'),
  quickFinancing: document.querySelector('#quickFinancing'), quickDiscount: document.querySelector('#quickDiscount'),
  quickMessage: document.querySelector('#quickMessage'), loadSaved: document.querySelector('#loadSavedFilters'),
  stateInput: document.querySelector('#stateInput'), cityInput: document.querySelector('#cityInput'),
  neighborhoodInput: document.querySelector('#neighborhoodInput'),
  stateOptions: document.querySelector('#stateOptions'), cityOptions: document.querySelector('#cityOptions'),
  neighborhoodOptions: document.querySelector('#neighborhoodOptions'),
  selectedStates: document.querySelector('#selectedStates'), selectedCities: document.querySelector('#selectedCities'),
  selectedNeighborhoods: document.querySelector('#selectedNeighborhoods'),
  typeOptions: document.querySelector('#typeOptions'), modeOptions: document.querySelector('#modeOptions'),
  bankOptions: document.querySelector('#bankOptions'),
  financing: document.querySelector('#financingFilter'),
  fgts: document.querySelector('#fgtsFilter'), dispute: document.querySelector('#disputeFilter'),
  priceMin: document.querySelector('#priceMin'), priceMax: document.querySelector('#priceMax'),
  discountMin: document.querySelector('#discountMin'), discountMax: document.querySelector('#discountMax'),
  areaMin: document.querySelector('#areaMin'), areaMax: document.querySelector('#areaMax'),
  sort: document.querySelector('#sortFilter'), message: document.querySelector('#filterMessage'),
  dialog: document.querySelector('#detailDialog'), sourceStatus: document.querySelector('#sourceStatus'),
  more: document.querySelector('#moreButton'),
};

let listings = [];
let visibleCount = 24;
const selectedStates = new Set();
const selectedCities = new Set();
const selectedNeighborhoods = new Set();
const catalogUrls = [
  'https://raw.githubusercontent.com/auglucas67/imovel-em-disputa/main/public/data/listings.json',
  '/data/listings.json',
];
const bankCatalogUrls = [
  'https://raw.githubusercontent.com/auglucas67/imovel-em-disputa/main/public/data/banks.json',
  '/data/banks.json',
];
const conditionCatalogUrls = [
  'https://raw.githubusercontent.com/auglucas67/imovel-em-disputa/main/public/data/conditions.json',
  '/data/conditions.json',
];

const sortedUnique = values => [...new Set(values)].filter(Boolean)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));
const numericFilter = input => input.value === '' ? null : Number(input.value);
const checkedValues = container => new Set([...container.querySelectorAll('input:checked')].map(input => input.value));
const photoUrl = item => item.bank !== 'CAIXA' ? item.imageUrl || ''
  : /^\d{1,13}$/.test(item.id)
    ? `https://venda-imoveis.caixa.gov.br/fotos/F${item.id.padStart(13, '0')}21.jpg` : '';
const modeLabel = mode => ({
  'Leilão SFI - Edital Único': 'Leilão SFI',
  'Venda Direta Online': 'Compra Direta',
})[mode] || mode;

function areaFromDescription(description) {
  for (const label of ['privativa', 'total', 'do terreno']) {
    const match = description.match(new RegExp(`([\\d.,]+) de área ${label}`));
    const area = Number(match?.[1].replace(',', '.') || 0);
    if (area > 0) return area;
  }
  return null;
}

function filtered() {
  const types = checkedValues(els.typeOptions);
  const modes = checkedValues(els.modeOptions);
  const banks = checkedValues(els.bankOptions);
  const neighborhoodMode = document.querySelector('input[name="neighborhoodMode"]:checked').value;
  const priceMin = numericFilter(els.priceMin), priceMax = numericFilter(els.priceMax);
  const discountMin = numericFilter(els.discountMin), discountMax = numericFilter(els.discountMax);
  const areaMin = numericFilter(els.areaMin), areaMax = numericFilter(els.areaMax);
  const items = listings.filter(item =>
    (!selectedStates.size || selectedStates.has(item.state))
    && (!selectedCities.size || selectedCities.has(item._cityKey))
    && (!selectedNeighborhoods.size || (neighborhoodMode === 'include'
      ? selectedNeighborhoods.has(item._neighborhoodKey) : !selectedNeighborhoods.has(item._neighborhoodKey)))
    && (!types.size || types.has(item.type))
    && (!modes.size || modes.has(item.mode))
    && (!banks.size || banks.has(item.bank))
    && (!els.financing.checked || item.financing)
    && (!els.fgts.checked || item.fgts === true)
    && (!els.dispute.checked || item.inDispute === true
      && Date.parse(item.auctionEndsAt) > Date.now())
    && (priceMin === null || item.price >= priceMin)
    && (priceMax === null || item.price <= priceMax)
    && (discountMin === null || item.discount !== null && item.discount >= discountMin)
    && (discountMax === null || item.discount !== null && item.discount <= discountMax)
    && (areaMin === null || item._area !== null && item._area >= areaMin)
    && (areaMax === null || item._area !== null && item._area <= areaMax));
  return items.sort((a, b) => els.sort.value === 'price'
    ? a.price - b.price : (b.discount ?? -1) - (a.discount ?? -1));
}

function fillDatalist(element, values) {
  element.replaceChildren(...sortedUnique(values).map(value => {
    const option = document.createElement('option');
    option.value = value;
    return option;
  }));
}

function fillSelect(element, values, labelFor = value => value) {
  const current = element.value;
  element.querySelectorAll('option:not(:first-child)').forEach(option => option.remove());
  for (const value of sortedUnique(values)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labelFor(value);
    element.append(option);
  }
  element.value = [...element.options].some(option => option.value === current) ? current : '';
}

function refreshQuickCities() {
  const cities = listings.filter(item => !els.quickState.value || item.state === els.quickState.value)
    .map(item => item.city);
  fillDatalist(els.quickCityOptions, cities);
  if (els.quickCity.value && !cities.some(city => normalizeText(city) === normalizeText(els.quickCity.value))) {
    els.quickCity.value = '';
  }
}

function showResults() {
  els.results.hidden = false;
  document.querySelector('.filter-sidebar').scrollTop = 0;
  history.replaceState(null, '', '#oportunidades');
  els.results.scrollIntoView();
}

function applyQuickSearch() {
  const cityTerm = normalizeText(els.quickCity.value);
  const cityMatches = cityTerm ? sortedUnique(listings.filter(item =>
    (!els.quickState.value || item.state === els.quickState.value)
    && normalizeText(item.city).includes(cityTerm)).map(item => item.city)) : [];
  if (cityTerm && (cityMatches.length === 0 || cityMatches.length > 25)) {
    els.quickMessage.textContent = cityMatches.length ? 'Digite uma cidade mais específica.' : 'Cidade não encontrada neste estado.';
    return;
  }
  restoreSettings({});
  if (els.quickState.value) selectedStates.add(els.quickState.value);
  cityMatches.forEach(city => selectedCities.add(normalizeText(city)));
  for (const [container, value] of [[els.modeOptions, els.quickMode.value], [els.typeOptions, els.quickType.value]]) {
    if (value) container.querySelectorAll('input').forEach(input => { input.checked = input.value === value; });
  }
  if (els.quickBank.value) els.bankOptions.querySelectorAll('input').forEach(input => {
    input.checked = input.value === els.quickBank.value;
  });
  els.priceMax.value = els.quickPrice.value;
  els.financing.checked = els.quickFinancing.classList.contains('active');
  els.discountMin.value = els.quickDiscount.classList.contains('active') ? '30' : '';
  els.quickMessage.textContent = '';
  refreshLocations();
  visibleCount = 24;
  render();
  showResults();
}

function refreshLocations() {
  const inStates = listings.filter(item => !selectedStates.size || selectedStates.has(item.state));
  const inCities = inStates.filter(item => !selectedCities.size || selectedCities.has(item._cityKey));
  fillDatalist(els.stateOptions, listings.map(item => item.state));
  fillDatalist(els.cityOptions, inStates.map(item => item.city));
  fillDatalist(els.neighborhoodOptions, inCities.map(item => item.neighborhood));
  for (const [element, values, kind] of [
    [els.selectedStates, selectedStates, 'state'],
    [els.selectedCities, selectedCities, 'city'],
    [els.selectedNeighborhoods, selectedNeighborhoods, 'neighborhood'],
  ]) {
    element.replaceChildren(...[...values].map(value => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.remove = kind;
      button.dataset.value = value;
      const displayValue = kind === 'state' ? value : value.toLocaleUpperCase('pt-BR');
      button.textContent = `${displayValue} ×`;
      button.setAttribute('aria-label', `Remover ${displayValue}`);
      return button;
    }));
  }
}

function addLocation(input, values, selected, normalize = value => value) {
  const match = sortedUnique(values).find(value => normalizeText(value) === normalizeText(input.value));
  if (!match) {
    els.message.textContent = 'Selecione uma opção válida da lista.';
    return;
  }
  selected.add(normalize(match));
  input.value = '';
  els.message.textContent = '';
  refreshLocations();
  visibleCount = 24;
  render();
}

function addCheckOptions(container, values, prefix, labelFor = value => value) {
  container.replaceChildren(...sortedUnique(values).map(value => {
    const label = document.createElement('label');
    label.className = 'check-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = prefix;
    input.value = value;
    label.append(input, document.createTextNode(` ${labelFor(value)}`));
    return label;
  }));
}

function savedSettings() {
  return {
    states: [...selectedStates], cities: [...selectedCities], neighborhoods: [...selectedNeighborhoods],
    neighborhoodMode: document.querySelector('input[name="neighborhoodMode"]:checked').value,
    types: [...checkedValues(els.typeOptions)], modes: [...checkedValues(els.modeOptions)],
    banks: [...checkedValues(els.bankOptions)],
    financing: els.financing.checked, fgts: els.fgts.checked,
    dispute: els.dispute.checked, sort: els.sort.value,
    priceMin: els.priceMin.value, priceMax: els.priceMax.value,
    discountMin: els.discountMin.value, discountMax: els.discountMax.value,
    areaMin: els.areaMin.value, areaMax: els.areaMax.value,
  };
}

function restoreSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  for (const [target, values] of [[selectedStates, settings.states], [selectedCities, settings.cities],
    [selectedNeighborhoods, settings.neighborhoods]]) {
    target.clear();
    if (Array.isArray(values)) values.filter(value => typeof value === 'string').forEach(value => target.add(value));
  }
  for (const [container, values] of [[els.typeOptions, settings.types], [els.modeOptions, settings.modes],
    [els.bankOptions, settings.banks]]) {
    container.querySelectorAll('input').forEach(input => { input.checked = Array.isArray(values) && values.includes(input.value); });
  }
  for (const name of ['priceMin', 'priceMax', 'discountMin', 'discountMax', 'areaMin', 'areaMax']) {
    els[name].value = settings[name] ?? '';
  }
  els.financing.checked = Boolean(settings.financing);
  els.fgts.checked = Boolean(settings.fgts);
  els.dispute.checked = Boolean(settings.dispute);
  els.sort.value = settings.sort === 'price' ? 'price' : 'discount';
  document.querySelector(`input[name="neighborhoodMode"][value="${settings.neighborhoodMode === 'exclude' ? 'exclude' : 'include'}"]`).checked = true;
  refreshLocations();
  visibleCount = 24;
  render();
}

function render() {
  const items = filtered();
  els.count.textContent = `${items.length.toLocaleString('pt-BR')} ${items.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}`;
  els.cards.innerHTML = items.length ? items.slice(0, visibleCount).map(item => `
    <article class="card" data-id="${escapeHtml(item.id)}">
      <div class="card-photo${photoUrl(item) ? '' : ' fallback'}" aria-label="Foto do anúncio, quando disponível">
        ${photoUrl(item) ? `<img src="${escapeHtml(photoUrl(item))}" alt="Foto do imóvel ${escapeHtml(item.id)}" loading="lazy" referrerpolicy="no-referrer" />` : ''}
        ${item.discount !== null ? `<span>${Number(item.discount).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% OFF</span>` : ''}
        <div class="photo-mark">${escapeHtml(item.type.slice(0, 1))}</div>
        <small>Foto indisponível</small>
      </div>
      <div class="card-body">
        <p>${escapeHtml(item.city)}, ${escapeHtml(item.state)} <small>· ${escapeHtml(item.neighborhood)}</small></p>
        <h3>${escapeHtml(item.type)}</h3>
        <div class="tags">${item.financing ? '<b>Financiamento</b>' : ''}<b>${escapeHtml(item.bank)}</b></div>
        <strong>${money(item.price)}</strong>
        ${item.appraisal ? `<del>Valor de avaliação ${money(item.appraisal)}</del>` : '<small class="price-note">Preço anunciado na fonte</small>'}
        <footer><span>${escapeHtml(item.mode)}</span><button class="detail-button" type="button">Ver detalhes <i>→</i></button></footer>
      </div>
    </article>`).join('')
    : `<div class="empty">${els.fgts.checked || els.dispute.checked
      ? 'Nenhum imóvel com essa condição confirmada nas fontes consultadas. A cobertura destes filtros é parcial; confira também o anúncio original.'
      : 'Nenhum imóvel encontrado. Ajuste os filtros e tente novamente.'}</div>`;
  els.more.hidden = items.length <= visibleCount;
}

function openDetail(id) {
  const item = listings.find(listing => listing.id === id);
  if (!item) return;
  const officialUrl = new URL(item.officialUrl);
  if (officialUrl.protocol !== 'https:' || ![
    'venda-imoveis.caixa.gov.br', 'www.seuimovelbb.com.br', 'www.megaleiloes.com.br',
  ].includes(officialUrl.hostname)) return;
  const shareUrl = new URL(location.pathname, location.origin);
  shareUrl.searchParams.set('imovel', item.id);
  const shareText = `${item.type} em ${item.city}/${item.state} por ${money(item.price)} — ${item.bank}. Veja no catálogo: ${shareUrl.href}\nAnúncio na fonte: ${officialUrl.href}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  document.querySelector('#detailContent').innerHTML = `
    <div class="detail-photo${photoUrl(item) ? '' : ' fallback'}">${photoUrl(item) ? `<img src="${escapeHtml(photoUrl(item))}" alt="Foto do imóvel ${escapeHtml(item.id)}" referrerpolicy="no-referrer" />` : ''}<span>Foto indisponível · consulte a fonte</span></div>
    <p class="eyebrow">${escapeHtml(item.mode.toUpperCase())} · Nº ${escapeHtml(item.id)}</p>
    <h2>${escapeHtml(item.type)} em ${escapeHtml(item.city)}, ${escapeHtml(item.state)}</h2>
    ${item.neighborhood || item.address ? `<p>${escapeHtml([item.neighborhood, item.address].filter(Boolean).join(' · '))}</p>` : ''}
    <strong>${money(item.price)}</strong>
    ${item.appraisal ? `<p>Valor de avaliação: ${money(item.appraisal)} · desconto informado: ${Number(item.discount).toLocaleString('pt-BR')}%</p>` : ''}
    ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
    ${item.auctionDate ? `<p>${escapeHtml(item.auctionDate)}</p>` : ''}
    ${item._area ? `<p>Área informada: ${item._area.toLocaleString('pt-BR')} m²</p>` : ''}
    ${item.fgts === true ? '<p class="verified-condition">✓ FGTS permitido na página individual da CAIXA. Confirme seu enquadramento.</p>' : ''}
    ${item.inDispute === true ? `<p class="verified-condition">✓ ${item.bidCount} ${item.bidCount === 1 ? 'lance registrado' : 'lances registrados'} na oferta aberta.</p>` : ''}
    <div class="share-box"><strong>Compartilhe este imóvel</strong><p>Envie o link desta ficha para alguém analisar com você.</p><div class="share-actions"><a class="share-whatsapp" href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp ↗</a><button type="button" id="copyShareLink" data-link="${escapeHtml(shareUrl.href)}">Copiar link</button></div><small id="shareFeedback" role="status" aria-live="polite"></small></div>
    <a class="button primary" href="${escapeHtml(officialUrl.href)}" target="_blank" rel="noopener noreferrer">Abrir anúncio na fonte ↗</a>
    <small>Fonte: ${escapeHtml(item.sourceName || item.bank)}. Confirme preço, disponibilidade, edital e condições antes de participar.</small>`;
  els.dialog.showModal();
}

async function loadCatalog() {
  els.sourceStatus.textContent = 'CARREGANDO LISTA DA CAIXA';
  try {
    let feed;
    for (const url of catalogUrls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const candidate = await response.json();
        if (!Array.isArray(candidate.listings) || candidate.listings.length < 1000) {
          throw new Error('Catálogo incompleto');
        }
        feed = candidate;
        els.sourceStatus.dataset.source = url;
        break;
      } catch (error) {
        console.warn(`Fonte do catálogo indisponível: ${url}`, error);
      }
    }
    if (!feed) throw new Error('Nenhuma fonte do catálogo respondeu');
    let fgtsConfirmed = new Set();
    for (const url of conditionCatalogUrls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const candidate = await response.json();
        if (!candidate.fgtsConfirmed || typeof candidate.fgtsConfirmed !== 'object') throw new Error('Condições inválidas');
        fgtsConfirmed = new Set(Object.entries(candidate.fgtsConfirmed)
          .filter(([id, checkedAt]) => /^\d{1,13}$/.test(id)
            && Date.now() - Date.parse(checkedAt) <= 7 * 24 * 60 * 60 * 1000)
          .map(([id]) => id));
        break;
      } catch (error) {
        console.warn(`Condições individuais indisponíveis: ${url}`, error);
      }
    }
    let bankItems = [];
    let bankFeedTime = '';
    for (const url of bankCatalogUrls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const candidate = await response.json();
        const age = Date.now() - Date.parse(candidate.syncedAt);
        if (!Array.isArray(candidate.listings) || candidate.listings.length < 10
          || !Number.isFinite(age) || age < 0 || age > 72 * 60 * 60 * 1000) {
          throw new Error('Catálogo de outros bancos ausente ou desatualizado');
        }
        bankItems = candidate.listings.filter(item => ['Banco do Brasil', 'Itaú', 'Santander'].includes(item.bank)
          && Number.isFinite(item.price) && item.price > 0
          && (!item.auctionEndsAt || Date.parse(item.auctionEndsAt) > Date.now())
          && /^https:\/\/(www\.seuimovelbb\.com\.br|www\.megaleiloes\.com\.br)\//.test(item.officialUrl));
        bankFeedTime = new Date(candidate.syncedAt).toLocaleDateString('pt-BR');
        break;
      } catch (error) {
        console.warn(`Catálogo de outros bancos indisponível: ${url}`, error);
      }
    }
    listings = [...feed.listings.map(item => ({ ...item, bank: 'CAIXA', sourceName: 'CAIXA',
      fgts: fgtsConfirmed.has(item.id), inDispute: null })),
      ...bankItems].map(item => ({ ...item,
      _cityKey: normalizeText(item.city), _neighborhoodKey: normalizeText(item.neighborhood),
      _area: areaFromDescription(item.description || ''),
    }));
    addCheckOptions(els.typeOptions, listings.map(item => item.type), 'type');
    addCheckOptions(els.modeOptions, listings.map(item => item.mode), 'mode', modeLabel);
    addCheckOptions(els.bankOptions, listings.map(item => item.bank), 'bank');
    const fgtsCount = listings.filter(item => item.fgts === true).length;
    const disputeCount = listings.filter(item => item.inDispute === true
      && Date.parse(item.auctionEndsAt) > Date.now()).length;
    document.querySelector('#conditionsCoverage').textContent = `Cobertura parcial verificada: ${fgtsCount} imóveis com FGTS explicitamente permitido na CAIXA e ${disputeCount} ofertas abertas com lances registrados na Mega Leilões. Ausência no resultado não significa que a condição não se aplique. Confirme no anúncio original.`;
    refreshLocations();
    fillSelect(els.quickState, listings.map(item => item.state));
    fillSelect(els.quickMode, listings.map(item => item.mode), modeLabel);
    fillSelect(els.quickType, listings.map(item => item.type));
    fillSelect(els.quickBank, listings.map(item => item.bank));
    refreshQuickCities();
    document.querySelector('#searchButton').disabled = false;
    els.quickMessage.textContent = '';
    try { els.loadSaved.hidden = !localStorage.getItem('imovel-em-disputa-filters'); }
    catch { els.loadSaved.hidden = true; }
    els.sourceStatus.textContent = bankItems.length
      ? `CAIXA + BB + ITAÚ + SANTANDER · ATUALIZADO EM ${bankFeedTime}`
      : `LISTA DA CAIXA · GERADA EM ${feed.generatedAt || new Date(feed.syncedAt).toLocaleDateString('pt-BR')} · OUTROS BANCOS INDISPONÍVEIS`;
  } catch (error) {
    els.sourceStatus.textContent = 'CATÁLOGO TEMPORARIAMENTE INDISPONÍVEL';
    els.quickMessage.textContent = 'Não foi possível carregar a lista agora. Tente novamente mais tarde.';
    els.cards.innerHTML = '<div class="empty">Não foi possível carregar a lista agora. Consulte o portal oficial da CAIXA.</div>';
    els.more.hidden = true;
    console.error('Falha ao carregar catálogo:', error);
    return;
  }
  render();
  const sharedId = new URLSearchParams(location.search).get('imovel');
  if (sharedId && listings.some(item => item.id === sharedId)) {
    showResults();
    openDetail(sharedId);
  } else if (location.hash === '#oportunidades') showResults();
}

els.quickState.addEventListener('change', refreshQuickCities);
document.querySelector('#searchButton').addEventListener('click', applyQuickSearch);
els.quickCity.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); applyQuickSearch(); }
});
for (const button of [els.quickFinancing, els.quickDiscount]) {
  button.addEventListener('click', () => {
    const active = button.classList.toggle('active');
    button.setAttribute('aria-pressed', String(active));
  });
}
els.loadSaved.addEventListener('click', () => {
  try {
    const saved = JSON.parse(localStorage.getItem('imovel-em-disputa-filters'));
    if (!saved) throw new Error('Nenhum filtro salvo');
    restoreSettings(saved);
    showResults();
  } catch { els.quickMessage.textContent = 'Não foi possível recuperar os filtros salvos.'; }
});
document.querySelector('#backToSearch').addEventListener('click', () => {
  els.results.hidden = true;
  history.replaceState(null, '', '#busca');
  document.querySelector('#busca').scrollIntoView();
});
document.querySelector('#addState').addEventListener('click', () =>
  addLocation(els.stateInput, listings.map(item => item.state), selectedStates));
document.querySelector('#addCity').addEventListener('click', () =>
  addLocation(els.cityInput, listings.filter(item => !selectedStates.size || selectedStates.has(item.state))
    .map(item => item.city), selectedCities, normalizeText));
document.querySelector('#addNeighborhood').addEventListener('click', () =>
  addLocation(els.neighborhoodInput, listings.filter(item =>
    (!selectedStates.size || selectedStates.has(item.state))
    && (!selectedCities.size || selectedCities.has(item._cityKey)))
    .map(item => item.neighborhood), selectedNeighborhoods, normalizeText));
for (const [input, button] of [[els.stateInput, '#addState'], [els.cityInput, '#addCity'],
  [els.neighborhoodInput, '#addNeighborhood']]) {
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); document.querySelector(button).click(); }
  });
}
document.querySelector('.filter-content').addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  ({ state: selectedStates, city: selectedCities, neighborhood: selectedNeighborhoods })[button.dataset.remove]
    .delete(button.dataset.value);
  refreshLocations(); visibleCount = 24; render();
});
[els.typeOptions, els.modeOptions, els.bankOptions, els.financing, els.fgts, els.dispute, els.sort,
  ...document.querySelectorAll('input[name="neighborhoodMode"]')].forEach(element =>
  element.addEventListener('change', () => { visibleCount = 24; render(); }));
document.querySelector('#applyFilters').addEventListener('click', () => {
  for (const [minimum, maximum, label] of [[els.priceMin, els.priceMax, 'preço'],
    [els.discountMin, els.discountMax, 'desconto'], [els.areaMin, els.areaMax, 'área']]) {
    if (minimum.value !== '' && maximum.value !== '' && Number(minimum.value) > Number(maximum.value)) {
      els.message.textContent = `O valor mínimo de ${label} não pode superar o máximo.`;
      minimum.focus();
      return;
    }
  }
  els.message.textContent = '';
  visibleCount = 24; render();
  if (window.innerWidth < 850) document.querySelector('#filtersPanel').open = false;
});
document.querySelector('#saveFilters').addEventListener('click', () => {
  try { localStorage.setItem('imovel-em-disputa-filters', JSON.stringify(savedSettings()));
    els.message.textContent = 'Filtros salvos neste navegador.';
    els.loadSaved.hidden = false;
  } catch { els.message.textContent = 'Não foi possível salvar os filtros neste navegador.'; }
});
document.querySelector('#clearFilters').addEventListener('click', () => {
  restoreSettings({});
  els.message.textContent = 'Filtros limpos.';
  try { localStorage.removeItem('imovel-em-disputa-filters'); } catch { /* armazenamento indisponível */ }
  els.loadSaved.hidden = true;
});
els.cards.addEventListener('click', event => {
  if (event.target.closest('.detail-button')) openDetail(event.target.closest('.card').dataset.id);
});
document.querySelector('#detailContent').addEventListener('click', async event => {
  const button = event.target.closest('#copyShareLink');
  if (!button) return;
  const feedback = document.querySelector('#shareFeedback');
  try {
    await navigator.clipboard.writeText(button.dataset.link);
    feedback.textContent = 'Link copiado. Agora você pode enviar para quem quiser.';
  } catch {
    feedback.textContent = 'Não foi possível copiar automaticamente. Use o botão do WhatsApp para compartilhar.';
  }
});
document.addEventListener('click', event => {
  const menu = document.querySelector('#portalMenu');
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
for (const container of [els.cards, document.querySelector('#detailContent')]) {
  container.addEventListener('error', event => {
    if (event.target.tagName === 'IMG') event.target.parentElement.classList.add('fallback');
  }, true);
}
els.more.addEventListener('click', () => { visibleCount += 24; render(); });
document.querySelector('.close').addEventListener('click', () => els.dialog.close());
document.querySelector('#year').textContent = new Date().getFullYear();
if (window.innerWidth < 850) document.querySelector('#filtersPanel').open = false;
loadCatalog();
