import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const listingFile = resolve('public/data/listings.json');
const conditionFile = resolve('public/data/conditions.json');
const listings = JSON.parse(await readFile(listingFile, 'utf8')).listings;
const previous = JSON.parse(await readFile(conditionFile, 'utf8'));
const active = new Map(listings.map(item => [item.id, item]));
const maximumAge = 7 * 24 * 60 * 60 * 1000;
const verified = {};
const candidates = [...new Set(previous.candidateIds || Object.keys(previous.fgtsConfirmed || {}))]
  .filter(id => active.has(id));

for (const id of candidates) {
  const checkedAt = previous.fgtsConfirmed?.[id];
  if (checkedAt && Date.now() - Date.parse(checkedAt) <= maximumAge) verified[id] = checkedAt;
  try {
    const response = await fetch(active.get(id).officialUrl, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'ImovelEmDisputa/1.0 (+https://github.com/auglucas67/imovel-em-disputa)' },
    });
    if (!response.ok) continue;
    const html = await response.text();
    if (/Radware Bot Manager CAPTCHA|Fechar a seção/i.test(html)) continue;
    const payment = html.match(/FORMAS DE PAGAMENTO ACEITAS:([\s\S]*?)REGRAS PARA PAGAMENTO DAS DESPESAS/i)?.[1];
    if (!payment) continue;
    if (/Permite utilização de FGTS/i.test(payment)) verified[id] = new Date().toISOString();
    else delete verified[id];
  } catch (error) {
    console.warn(`Condição do imóvel ${id} não verificada: ${error.message}`);
  }
  await new Promise(resolveDelay => setTimeout(resolveDelay, 700));
}

const next = { source: previous.source, candidateIds: candidates, fgtsConfirmed: verified };
await writeFile(`${conditionFile}.tmp`, JSON.stringify(next));
await rename(`${conditionFile}.tmp`, conditionFile);
console.log(`FGTS confirmado em ${Object.keys(verified).length} imóveis ativos (cobertura parcial).`);
