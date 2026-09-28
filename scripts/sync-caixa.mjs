import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const inputArg = process.argv.find(arg => arg.startsWith('--input='));
if (!inputArg) throw new Error('Informe --input=CAMINHO_DO_CSV da opção Todos no portal da CAIXA.');
const input = resolve(process.cwd(), inputArg.slice('--input='.length));
const output = resolve(process.cwd(), 'public', 'data', 'listings.json');
const sourceUrl = 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_geral.csv';

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

const amount = value => Number(String(value ?? '').trim().replaceAll('.', '').replace(',', '.'));
const csv = new TextDecoder('windows-1252').decode(await readFile(input));
const lines = csv.split(/\r?\n/);
if (!lines.some(line => line.includes('do imóvel;UF;Cidade;') && line.includes('Link de acesso'))) {
  throw new Error('O arquivo recebido não é a lista CSV oficial esperada. O feed anterior foi preservado.');
}
const generatedAt = lines.find(line => line.includes('Data de geração:'))?.split(';')[3]?.trim() || null;
const listings = lines.map(parseLine).filter(row => row.length >= 12 && /^\d+$/.test(row[0]?.trim())).map(row => {
  const description = row[9] || '';
  return {
    id: row[0].trim(), state: row[1].trim(), city: row[2].trim(), neighborhood: row[3].trim(),
    address: row[4].trim(), price: amount(row[5]), appraisal: amount(row[6]),
    discount: Number(String(row[7]).replace(',', '.')),
    financing: /^sim$/i.test(row[8].trim()), description,
    type: description.split(',')[0].trim() || 'Imóvel', mode: row[10].trim(),
    officialUrl: row[11].trim(),
  };
}).filter(item => item.id && /^[A-Z]{2}$/.test(item.state) && Number.isFinite(item.price)
  && Number.isFinite(item.appraisal) && Number.isFinite(item.discount)
  && item.officialUrl.startsWith('https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?'));

const unique = new Map(listings.map(item => [item.id, item]));
if (unique.size < 1000 || unique.size < listings.length * 0.95) {
  throw new Error(`CSV incompleto ou duplicado: ${listings.length} linhas, ${unique.size} imóveis únicos. Feed anterior preservado.`);
}
await mkdir(resolve(process.cwd(), 'public', 'data'), { recursive: true });
const draft = `${output}.tmp`;
const feed = { source: 'CAIXA — Lista completa de imóveis, opção Todos', sourceUrl,
  generatedAt, syncedAt: new Date().toISOString(), total: unique.size, listings: [...unique.values()] };
await writeFile(draft, JSON.stringify(feed));
await rename(draft, output);
console.log(`Feed atualizado: ${feed.total} imóveis em ${new Set(feed.listings.map(item => item.state)).size} UFs. Lista CAIXA gerada em ${generatedAt}.`);
