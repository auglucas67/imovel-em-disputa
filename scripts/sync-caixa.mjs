import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const states = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
const sourcePrefix = 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_';
const requestedStates = (process.argv.find(arg => arg.startsWith('--states='))?.split('=')[1]?.split(',') ?? states).map(value => value.trim().toUpperCase()).filter(value => states.includes(value));
const delayMs = Number(process.argv.find(arg => arg.startsWith('--delay='))?.split('=')[1] ?? 1600);
const output = resolve(process.cwd(), 'public', 'data', 'listings.json');

function numberBR(value) {
  return Number(String(value ?? '').trim().replaceAll('.', '').replace(',', '.')) || 0;
}

function parseLine(line) {
  const cells = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ';' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += char;
  }
  cells.push(value.trim());
  return cells;
}

function normalize(csv) {
  return csv.split(/\r?\n/).slice(3).map(parseLine)
    .filter(row => row.length >= 12 && row[0]?.trim())
    .map(row => {
      const description = row[9] || '';
      return { id: row[0].trim(), state: row[1].trim(), city: row[2].trim(), neighborhood: row[3].trim(), address: row[4].trim(), price: numberBR(row[5]), appraisal: numberBR(row[6]), discount: Number(String(row[7]).replace(',', '.')) || 0, financing: /^sim$/i.test(row[8].trim()), description, type: description.split(',')[0].trim() || 'Imóvel', mode: row[10].trim(), officialUrl: row[11].trim() };
    }).filter(item => item.officialUrl.startsWith('https://venda-imoveis.caixa.gov.br/'));
}

const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
const decoder = new TextDecoder('windows-1252');
const listings = [];
const failures = [];
for (const [index, state] of requestedStates.entries()) {
  try {
    const response = await fetch(`${sourcePrefix}${state}.csv?159567998`, { headers: { accept: 'text/csv,*/*' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = normalize(decoder.decode(await response.arrayBuffer()));
    listings.push(...rows);
    console.log(`${state}: ${rows.length} imóveis`);
  } catch (error) {
    failures.push({ state, message: error instanceof Error ? error.message : 'falha desconhecida' });
    console.error(`${state}: falhou`);
  }
  if (index < requestedStates.length - 1) await pause(delayMs);
}

if (!listings.length) throw new Error('Nenhuma lista foi obtida. A fonte pode exigir autorização ou estar indisponível.');
await mkdir(resolve(process.cwd(), 'public', 'data'), { recursive: true });
await writeFile(output, JSON.stringify({ source: 'CAIXA — Lista completa de imóveis por UF', sourceUrl: 'https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp', syncedAt: new Date().toISOString(), requestedStates, failures, total: listings.length, listings }));
console.log(`Feed salvo em ${output} (${listings.length} imóveis).`);
