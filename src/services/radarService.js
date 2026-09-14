// Radar de Pautas (beta) — lógica pura, sem IA e sem backend.
//
// Como funciona: o briefing de cada cliente (o que ele vende + palavras-chave)
// vira uma lista de buscas em fontes públicas. O app baixa tudo pelo proxy do
// ambiente local, junta, tira repetidos, dá uma nota por palavra e recência, e
// guarda no localStorage com prazo de validade. Nada disso toca o resto do sistema.

const STORE_KEY = 'argos_radar_beta_v1';
const PROXY_URL = '/api/radar/fetch';

export const RADAR_TTL_DAYS_DEFAULT = 14;
export const RADAR_MAX_KEYWORDS = 8;
export const RADAR_MAX_ITEMS_PER_QUERY = 25;

export const RADAR_LANGUAGES = [
  { id: 'pt-BR', label: 'Português (Brasil)', news: 'hl=pt-BR&gl=BR&ceid=BR:pt-419' },
  { id: 'en-US', label: 'Inglês (EUA)', news: 'hl=en-US&gl=US&ceid=US:en' },
  { id: 'es-419', label: 'Espanhol (Am. Latina)', news: 'hl=es-419&gl=MX&ceid=MX:es-419' },
];

// Formatos que o radar sabe procurar sem chave de API e sem custo.
export const RADAR_SOURCES = [
  { id: 'news', label: 'Notícias', hint: 'Google Notícias', kind: 'noticia' },
  { id: 'video', label: 'Vídeos', hint: 'YouTube', kind: 'video' },
  { id: 'social', label: 'Redes sociais', hint: 'Mastodon — única rede aberta sem chave', kind: 'social' },
  { id: 'reddit', label: 'Discussões', hint: 'Reddit — recusa buscas seguidas', kind: 'discussao' },
];

export const RADAR_DEFAULT_SETTINGS = {
  language: 'pt-BR',
  sources: { news: true, video: true, social: false, reddit: false },
};

export function emptyBriefing(companyId = '') {
  return {
    companyId,
    active: true,
    business: '',        // o que o cliente vende, em uma frase
    keywords: [],        // assuntos que vão literalmente para a busca
    // campos antigos: continuam aceitos por quem já preencheu, mas saíram do formulário
    audience: '',
    themes: [],
    exclude: [],
    competitors: [],
    feeds: [],
    notes: '',
    updatedAt: null,
  };
}

export function emptyStore() {
  return {
    version: 2,
    ttlDays: RADAR_TTL_DAYS_DEFAULT,
    settings: { ...RADAR_DEFAULT_SETTINGS, sources: { ...RADAR_DEFAULT_SETTINGS.sources } },
    briefings: {},
    items: [],
    saved: [],
    lastScanAt: null,
  };
}

export function loadRadarStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!raw || typeof raw !== 'object') return emptyStore();
    const store = { ...emptyStore(), ...raw };
    store.briefings = Object.fromEntries(Object.entries(store.briefings || {}).map(([id, b]) => [id, normalizeBriefing(b)]));
    store.settings = normalizeSettings(store.settings, Object.values(store.briefings)[0]);
    return store;
  } catch { return emptyStore(); }
}

/** Antes as fontes e o idioma viviam em cada briefing; agora valem para o radar inteiro. */
export function normalizeSettings(settings, algumBriefing) {
  const base = { ...RADAR_DEFAULT_SETTINGS, sources: { ...RADAR_DEFAULT_SETTINGS.sources } };
  if (!settings && algumBriefing) {
    if (algumBriefing.language) base.language = algumBriefing.language;
    if (algumBriefing.sources) base.sources = { ...base.sources, ...algumBriefing.sources };
    return base;
  }
  return { ...base, ...(settings || {}), sources: { ...base.sources, ...(settings?.sources || {}) } };
}

export function saveRadarStore(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { console.warn('radar: não consegui salvar', e); }
  return store;
}

/**
 * "a, b\nc" -> ['a','b','c'].
 * Também aceita ponto como separador ("games.geek.nerd"), porque é como
 * muita gente digita — links e domínios ficam intactos.
 */
export function parseList(text, { splitDots = true } = {}) {
  const parts = String(text || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  if (!splitDots) return parts;
  const out = [];
  for (const part of parts) {
    if (/^https?:\/\//i.test(part) || /\.(com|br|net|org|io|xml|rss)\b/i.test(part)) { out.push(part); continue; }
    const pieces = part.split(/(?<=\p{L})\.(?=\p{L})/gu).map(x => x.trim()).filter(Boolean);
    out.push(...pieces);
  }
  return out;
}

/** Arruma briefings salvos antes das correções (palavras grudadas por ponto). */
export function normalizeBriefing(briefing) {
  if (!briefing) return briefing;
  return {
    ...emptyBriefing(briefing.companyId),
    ...briefing,
    themes: parseList(listToText(briefing.themes)),
    keywords: parseList(listToText(briefing.keywords)),
    competitors: parseList(listToText(briefing.competitors)),
    exclude: parseList(listToText(briefing.exclude)),
    feeds: parseList((briefing.feeds || []).join('\n'), { splitDots: false }),
  };
}

export function listToText(list) {
  return (Array.isArray(list) ? list : []).join(', ');
}

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** "robótica educacional" -> "roboticaeducacional" (formato de hashtag). */
export function hashtagOf(term) {
  return normalize(term).replace(/[^a-z0-9]+/g, '');
}

/** Os termos de busca de um briefing: as palavras-chave são o que vai para a fonte. */
export function briefingTerms(briefing) {
  return [...(briefing.keywords || []), ...(briefing.themes || [])]
    .map(t => String(t || '').trim())
    .filter(Boolean)
    .slice(0, RADAR_MAX_KEYWORDS);
}

/** As buscas que um briefing gera. Uma linha por consulta, pra dar pra mostrar o progresso. */
export function briefingQueries(briefing, settings = RADAR_DEFAULT_SETTINGS) {
  const cfg = normalizeSettings(settings, briefing);
  const lang = RADAR_LANGUAGES.find(l => l.id === cfg.language) || RADAR_LANGUAGES[0];
  const terms = briefingTerms(briefing);
  const out = [];

  if (cfg.sources.news) {
    for (const term of terms) {
      out.push({
        source: 'Google Notícias', kind: 'noticia', parser: 'xml', term,
        url: `https://news.google.com/rss/search?q=${encodeURIComponent(`"${term}" when:14d`)}&${lang.news}`,
        retryUrl: `https://news.google.com/rss/search?q=${encodeURIComponent(term)}&${lang.news}`,
      });
    }
  }
  if (cfg.sources.video) {
    for (const term of terms) {
      out.push({
        source: 'YouTube', kind: 'video', parser: 'youtube', term,
        // sp=EgQIAxAB: só vídeos, publicados neste mês
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}&sp=EgQIAxAB`,
      });
    }
  }
  if (cfg.sources.social) {
    for (const term of terms) {
      const tag = hashtagOf(term);
      if (tag.length < 3) continue;
      out.push({
        source: 'Mastodon', kind: 'social', parser: 'xml', term, emptyOn404: true,
        url: `https://mastodon.social/tags/${tag}.rss`,
      });
    }
  }
  if (cfg.sources.reddit) {
    for (const term of terms.slice(0, 4)) {
      out.push({
        source: 'Reddit', kind: 'discussao', parser: 'xml', term,
        url: `https://www.reddit.com/search.rss?q=${encodeURIComponent(term)}&sort=top&t=week&limit=25`,
      });
    }
  }
  for (const feed of briefing.feeds || []) {
    if (/^https?:\/\//i.test(feed)) out.push({ source: 'Feed do cliente', kind: 'feed', parser: 'xml', term: '', url: feed });
  }
  return out;
}

/** Baixa uma fonte pelo proxy do ambiente local (o navegador não pode buscar direto por causa do CORS). */
export async function fetchFeed(url, { signal, emptyOn404 = false } = {}) {
  const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`, { signal });
  if (!res.ok) {
    if (res.status === 404) throw new Error('A varredura em tempo real só funciona rodando o sistema localmente (npm run dev).');
    throw new Error(`Falha ao buscar a fonte (${res.status})`);
  }
  const data = await res.json();
  if (!data?.ok) {
    // hashtag que ninguém usou ainda: não é erro, é resultado vazio
    if (data?.status === 404 && emptyOn404) return '';
    if (data?.status === 429) throw new Error('a fonte limitou o acesso (429) — o Reddit costuma recusar buscas seguidas; tente daqui a pouco');
    throw new Error(data?.error || 'Fonte não respondeu');
  }
  return data.body;
}

function pick(node, ...names) {
  for (const name of names) {
    const el = node.getElementsByTagName(name)[0];
    if (el?.textContent) return el.textContent.trim();
  }
  return '';
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Lê RSS 2.0 e Atom. Devolve itens crus, ainda sem nota. */
export function parseFeedXml(xml, fallbackSource = '') {
  const doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  const feedTitle = pick(doc.documentElement, 'title') || fallbackSource;
  const nodes = [...doc.getElementsByTagName('item'), ...doc.getElementsByTagName('entry')];
  const items = [];
  for (const node of nodes.slice(0, RADAR_MAX_ITEMS_PER_QUERY)) {
    let link = pick(node, 'link');
    if (!link) {
      const linkEl = [...node.getElementsByTagName('link')].find(el => el.getAttribute('href'));
      link = linkEl?.getAttribute('href') || '';
    }
    if (!link) continue;
    const body = stripTags(pick(node, 'description', 'summary', 'content'));
    // post de rede social não tem título: usa a primeira frase do texto
    const title = stripTags(pick(node, 'title')) || firstSentence(body);
    if (!title) continue;
    const published = pick(node, 'pubDate', 'published', 'updated', 'dc:date');
    const publishedAt = published ? new Date(published) : null;
    const sourceName = stripTags(pick(node, 'source') || feedTitle) || fallbackSource;
    items.push({
      title: stripSourceSuffix(title, sourceName),
      url: link.trim(),
      snippet: body.slice(0, 400),
      sourceName,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null,
    });
  }
  return items;
}

function firstSentence(text, max = 120) {
  const t = String(text || '').trim();
  if (!t) return '';
  const cut = t.slice(0, max);
  const stop = cut.search(/[.!?](\s|$)/);
  return (stop > 25 ? cut.slice(0, stop) : cut).trim() + (t.length > max && stop <= 25 ? '…' : '');
}

/**
 * Lê a página de resultados do YouTube. Não é API: o próprio HTML traz um JSON
 * (ytInitialData) com a lista de vídeos. Se o YouTube mudar esse formato, a
 * fonte simplesmente devolve zero — nada quebra.
 */
export function parseYouTubeHtml(html) {
  const match = String(html || '').match(/ytInitialData\s*=\s*(\{.+?\})\s*;\s*<\/script>/s);
  if (!match) return [];
  let data;
  try { data = JSON.parse(match[1]); } catch { return []; }

  const found = [];
  const walk = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 30 || found.length >= RADAR_MAX_ITEMS_PER_QUERY) return;
    if (node.videoRenderer?.videoId) found.push(node.videoRenderer);
    if (Array.isArray(node)) { for (const child of node) walk(child, depth + 1); return; }
    for (const key of Object.keys(node)) walk(node[key], depth + 1);
  };
  walk(data);

  return found.map(v => {
    const title = v.title?.runs?.[0]?.text || v.title?.simpleText || '';
    const channel = v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || 'YouTube';
    const desc = (v.detailedMetadataSnippets?.[0]?.snippetText?.runs || []).map(r => r.text).join('');
    const views = v.viewCountText?.simpleText || '';
    return {
      title: stripTags(title),
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      snippet: [stripTags(desc), views].filter(Boolean).join(' · ').slice(0, 400),
      sourceName: stripTags(channel),
      publishedAt: relativeToIso(v.publishedTimeText?.simpleText || ''),
    };
  }).filter(v => v.title);
}

/** "há 6 dias", "há 2 semanas", "3 days ago" -> data aproximada. */
export function relativeToIso(text, now = new Date()) {
  const t = normalize(text);
  const m = t.match(/(\d+)\s*(segundo|minuto|hora|dia|semana|m[eê]s|mes|ano|second|minute|hour|day|week|month|year)/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const h = /segundo|second/.test(unit) ? 0
    : /minuto|minute/.test(unit) ? n / 60
    : /hora|hour/.test(unit) ? n
    : /dia|day/.test(unit) ? n * 24
    : /semana|week/.test(unit) ? n * 24 * 7
    : /m[eê]s|mes|month/.test(unit) ? n * 24 * 30
    : n * 24 * 365;
  return new Date(now.getTime() - h * 3600000).toISOString();
}

/** O Google Notícias cola " - Nome do veículo" no fim do título; o veículo já aparece separado. */
export function stripSourceSuffix(title, sourceName) {
  const t = String(title || '').trim();
  const src = String(sourceName || '').trim();
  if (!src) return t;
  const tail = new RegExp(`\\s*[-–—|]\\s*${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  return t.replace(tail, '').trim() || t;
}

/** O resumo do Google Notícias costuma repetir o título; nesse caso não mostra nada. */
export function cleanSnippet(snippet, title) {
  const text = String(snippet || '').trim();
  if (!text) return '';
  const a = text.toLowerCase().replace(/\s+/g, ' ');
  const b = String(title || '').toLowerCase().replace(/\s+/g, ' ');
  if (!b) return text;
  if (a.startsWith(b) || a.includes(b)) {
    const resto = text.replace(new RegExp(String(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(/^[\s\-–—|·]+/, '').trim();
    return resto.length > 25 ? resto : '';
  }
  return text;
}

export function urlKey(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    [...u.searchParams.keys()].forEach(k => { if (/^utm_|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k); });
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch { return String(url || '').toLowerCase(); }
}

/**
 * Nota do item para um cliente, sem IA:
 *   relevância = a busca que trouxe o item + palavras do briefing encontradas no texto
 *   recência   = decai com as horas desde a publicação
 *   nota       = relevância x recência, de 0 a 100
 * Palavra da lista de exclusão (quando existir) zera o item.
 */
export const RELEVANCE_CEILING = 6;

export function scoreItem(item, briefing, now = new Date(), queryTerm = '') {
  const haystack = normalize(`${item.title} ${item.snippet} ${item.sourceName}`);
  const hits = [];
  let relevance = 0;

  // o item veio de uma busca por esse termo: a própria fonte já casou com ele,
  // mesmo que a palavra não apareça no título nem no resumo
  if (queryTerm) { relevance += 2; hits.push(queryTerm); }

  for (const kw of briefing.keywords || []) {
    if (kw && haystack.includes(normalize(kw))) { relevance += 2; hits.push(kw); }
  }
  for (const theme of briefing.themes || []) {
    if (theme && haystack.includes(normalize(theme))) { relevance += 3; hits.push(theme); }
  }
  for (const comp of briefing.competitors || []) {
    if (comp && haystack.includes(normalize(comp))) { relevance += 3; hits.push(comp); }
  }
  for (const bad of briefing.exclude || []) {
    if (bad && haystack.includes(normalize(bad))) return { score: 0, hits: [], blocked: bad };
  }
  if (!relevance) return { score: 0, hits: [], blocked: null };

  const hours = item.publishedAt ? Math.max(0, (now - new Date(item.publishedAt)) / 3600000) : 48;
  const recency = hours <= 24 ? 1 : hours <= 72 ? 0.85 : hours <= 168 ? 0.65 : 0.4;
  const score = Math.min(100, Math.round((relevance / RELEVANCE_CEILING) * 100 * recency));
  return { score, hits: [...new Set(hits)], blocked: null };
}

/** A validade conta a partir do dia em que a pauta entrou no feed. */
export function expiresAt(_item, ttlDays, now = new Date()) {
  return new Date(now.getTime() + ttlDays * 86400000).toISOString();
}

/** Notícia velha demais não vira pauta. */
export const RADAR_MAX_AGE_DAYS = 45;
export function isTooOld(item, now = new Date()) {
  if (!item.publishedAt) return false;
  return (now - new Date(item.publishedAt)) > RADAR_MAX_AGE_DAYS * 86400000;
}

/** Junta o que veio da varredura com o que já estava guardado, sem repetir link. */
export function mergeItems(existing, incoming) {
  const byKey = new Map(existing.map(it => [it.key, it]));
  let added = 0;
  for (const item of incoming) {
    const old = byKey.get(item.key);
    if (!old) { byKey.set(item.key, item); added++; continue; }
    // item já conhecido: mantém o mais antigo, mas atualiza clientes e nota
    byKey.set(item.key, {
      ...old,
      clients: { ...(old.clients || {}), ...(item.clients || {}) },
      expiresAt: item.expiresAt > old.expiresAt ? item.expiresAt : old.expiresAt,
    });
  }
  return { items: [...byKey.values()], added };
}

export function pruneExpired(items, savedKeys = [], now = new Date()) {
  const keep = new Set(savedKeys);
  return items.filter(it => keep.has(it.key) || !it.expiresAt || new Date(it.expiresAt) > now);
}

export function sortItems(items, companyId) {
  const scoreOf = it => (companyId ? (it.clients?.[companyId]?.score || 0) : Math.max(0, ...Object.values(it.clients || {}).map(c => c.score || 0)));
  return [...items].sort((a, b) => scoreOf(b) - scoreOf(a) || String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

export function itemsForCompany(items, companyId) {
  if (!companyId) return items;
  return items.filter(it => it.clients?.[companyId]);
}

export function kindLabel(kind) {
  return ({ noticia: 'Notícia', video: 'Vídeo', social: 'Post', discussao: 'Discussão', feed: 'Feed' })[kind] || 'Pauta';
}

/**
 * Varredura. Recebe os briefings ativos e devolve os itens já pontuados.
 * onProgress({done,total,label}) é chamado a cada consulta.
 */
export async function runScan(briefings, { ttlDays = RADAR_TTL_DAYS_DEFAULT, settings = RADAR_DEFAULT_SETTINGS, onProgress = () => {}, signal } = {}) {
  const now = new Date();
  const jobs = [];
  for (const briefing of briefings) {
    for (const query of briefingQueries(briefing, settings)) jobs.push({ briefing, query });
  }
  const collected = new Map();
  const errors = [];
  let done = 0;

  const parse = (text, query) => (query.parser === 'youtube' ? parseYouTubeHtml(text) : parseFeedXml(text, query.source));

  for (const { briefing, query } of jobs) {
    onProgress({ done, total: jobs.length, label: `${query.source}${query.term ? ` · ${query.term}` : ''}` });
    try {
      let body = await fetchFeed(query.url, { signal, emptyOn404: query.emptyOn404 });
      let raws = parse(body, query);
      // repescagem: termo entre aspas costuma voltar vazio em assunto de nicho
      if (!raws.length && query.retryUrl) {
        body = await fetchFeed(query.retryUrl, { signal });
        raws = parse(body, query);
      }
      for (const raw of raws) {
        if (isTooOld(raw, now)) continue;
        const { score, hits, blocked } = scoreItem(raw, briefing, now, query.term);
        if (blocked || score <= 0) continue;
        const key = urlKey(raw.url);
        const entry = collected.get(key) || {
          key,
          title: raw.title,
          url: raw.url,
          snippet: cleanSnippet(raw.snippet, raw.title),
          sourceName: raw.sourceName,
          sourceType: query.source,
          kind: query.kind,
          publishedAt: raw.publishedAt,
          collectedAt: now.toISOString(),
          expiresAt: expiresAt(raw, ttlDays, now),
          clients: {},
        };
        entry.clients[briefing.companyId] = { score, hits, term: query.term };
        collected.set(key, entry);
      }
    } catch (err) {
      const message = err?.message || String(err);
      errors.push({ source: query.source, term: query.term, message });
      if (err?.name === 'AbortError') break;
    }
    done++;
    onProgress({ done, total: jobs.length, label: '' });
  }
  return { items: [...collected.values()], errors, queries: jobs.length };
}
