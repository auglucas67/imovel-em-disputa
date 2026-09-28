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
  quickType: document.querySelector('#quickType'), quickPrice: document.querySelector('#quickPrice'),
  quickFinancing: document.querySelector('#quickFinancing'), quickDiscount: document.querySelector('#quickDiscount'),
  quickMessage: document.querySelector('#quickMessage'), loadSaved: document.querySelector('#loadSavedFilters'),
  stateInput: document.querySelector('#stateInput'), cityInput: document.querySelector('#cityInput'),
  neighborhoodInput: document.querySelector('#neighborhoodInput'),
  stateOptions: document.querySelector('#stateOptions'), cityOptions: document.querySelector('#cityOptions'),
  neighborhoodOptions: document.querySelector('#neighborhoodOptions'),
  selectedStates: document.querySelector('#selectedStates'), selectedCities: document.querySelector('#selectedCities'),
  selectedNeighborhoods: document.querySelector('#selectedNeighborhoods'),
  typeOptions: document.querySelector('#typeOptions'), modeOptions: document.querySelector('#modeOptions'),
  financing: document.querySelector('#financingFilter'),
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

const sortedUnique = values => [...new Set(values)].filter(Boolean)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));
const numericFilter = input => input.value === '' ? null : Number(input.value);
const checkedValues = container => new Set([...container.querySelectorAll('input:checked')].map(input => input.value));
const photoUrl = id => /^\d{1,13}$/.test(id)
  ? `https://venda-imoveis.caixa.gov.br/fotos/F${id.padStart(13, '0')}21.jpg` : '';
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
    && (!els.financing.checked || item.financing)
    && (priceMin === null || item.price >= priceMin)
    && (priceMax === null || item.price <= priceMax)
    && (discountMin === null || item.discount >= discountMin)
    && (discountMax === null || item.discount <= discountMax)
    && (areaMin === null || item._area !== null && item._area >= areaMin)
    && (areaMax === null || item._area !== null && item._area <= areaMax));
  return items.sort((a, b) => els.sort.value === 'price'
    ? a.price - b.price : b.discount - a.discount);
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
    financing: els.financing.checked, sort: els.sort.value,
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
  for (const [container, values] of [[els.typeOptions, settings.types], [els.modeOptions, settings.modes]]) {
    container.querySelectorAll('input').forEach(input => { input.checked = Array.isArray(values) && values.includes(input.value); });
  }
  for (const name of ['priceMin', 'priceMax', 'discountMin', 'discountMax', 'areaMin', 'areaMax']) {
    els[name].value = settings[name] ?? '';
  }
  els.financing.checked = Boolean(settings.financing);
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
      <div class="card-photo" aria-label="Foto oficial da CAIXA, quando disponível">
        <img src="${photoUrl(item.id)}" alt="Foto do imóvel ${escapeHtml(item.id)}" loading="lazy" referrerpolicy="no-referrer" />
        <span>${Number(item.discount).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% OFF</span>
        <div class="photo-mark">${escapeHtml(item.type.slice(0, 1))}</div>
        <small>Foto indisponível</small>
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
    <div class="detail-photo"><img src="${photoUrl(item.id)}" alt="Foto do imóvel ${escapeHtml(item.id)}" referrerpolicy="no-referrer" /><span>Foto indisponível · consulte a CAIXA</span></div>
    <p class="eyebrow">${escapeHtml(item.mode.toUpperCase())} · Nº ${escapeHtml(item.id)}</p>
    <h2>${escapeHtml(item.type)} em ${escapeHtml(item.city)}, ${escapeHtml(item.state)}</h2>
    <p>${escapeHtml(item.neighborhood)} · ${escapeHtml(item.address)}</p>
    <strong>${money(item.price)}</strong>
    <p>Valor de avaliação: ${money(item.appraisal)} · desconto informado: ${Number(item.discount).toLocaleString('pt-BR')}%</p>
    <p>${escapeHtml(item.description)}</p>
    ${item._area ? `<p>Área informada: ${item._area.toLocaleString('pt-BR')} m²</p>` : ''}
    <a class="button primary" href="${escapeHtml(officialUrl.href)}" target="_blank" rel="noopener noreferrer">Abrir este imóvel na CAIXA ↗</a>
    <small>Confirme preço, disponibilidade, edital e condições no portal da CAIXA.</small>`;
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
    listings = feed.listings.map(item => ({ ...item,
      _cityKey: normalizeText(item.city), _neighborhoodKey: normalizeText(item.neighborhood),
      _area: areaFromDescription(item.description || ''),
    }));
    addCheckOptions(els.typeOptions, listings.map(item => item.type), 'type');
    addCheckOptions(els.modeOptions, listings.map(item => item.mode), 'mode', modeLabel);
    refreshLocations();
    fillSelect(els.quickState, listings.map(item => item.state));
    fillSelect(els.quickMode, listings.map(item => item.mode), modeLabel);
    fillSelect(els.quickType, listings.map(item => item.type));
    refreshQuickCities();
    document.querySelector('#searchButton').disabled = false;
    els.quickMessage.textContent = '';
    try { els.loadSaved.hidden = !localStorage.getItem('imovel-em-disputa-filters'); }
    catch { els.loadSaved.hidden = true; }
    els.sourceStatus.textContent = `LISTA DA CAIXA · GERADA EM ${feed.generatedAt || new Date(feed.syncedAt).toLocaleDateString('pt-BR')}`;
  } catch (error) {
    els.sourceStatus.textContent = 'CATÁLOGO TEMPORARIAMENTE INDISPONÍVEL';
    els.quickMessage.textContent = 'Não foi possível carregar a lista agora. Tente novamente mais tarde.';
    els.cards.innerHTML = '<div class="empty">Não foi possível carregar a lista agora. Consulte o portal oficial da CAIXA.</div>';
    els.more.hidden = true;
    console.error('Falha ao carregar catálogo:', error);
    return;
  }
  render();
  if (location.hash === '#oportunidades') showResults();
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
[els.typeOptions, els.modeOptions, els.financing, els.sort,
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
