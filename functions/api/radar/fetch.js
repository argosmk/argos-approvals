// Ponte do Radar de Pautas (Cloudflare Pages Function).
//
// O navegador não consegue baixar feeds de outros sites por causa do CORS, então
// quem baixa é o servidor. Em `npm run dev` esse mesmo caminho é servido pelo
// middleware do Vite (vite.config.js); em produção, por este arquivo.
//
// Só aceita os endereços que o radar realmente usa: isso impede que a rota vire
// um proxy aberto para qualquer site. Se um dia voltarem os "feeds extras" do
// briefing, é aqui que a lista precisa crescer.
const ALLOWED_HOSTS = [
  'news.google.com',
  'www.youtube.com',
  'm.youtube.com',
  'www.reddit.com',
  'old.reddit.com',
  'mastodon.social',
];

const TIMEOUT_MS = 12000;
const MAX_BYTES = 3 * 1024 * 1024;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export async function onRequestGet(context) {
  const asked = new URL(context.request.url).searchParams.get('url');
  if (!asked) return json(400, { ok: false, error: 'faltou o parâmetro url' });

  let target;
  try { target = new URL(asked); } catch { return json(400, { ok: false, error: 'url inválida' }); }
  if (target.protocol !== 'https:') return json(400, { ok: false, error: 'só https' });
  if (!ALLOWED_HOSTS.includes(target.hostname.toLowerCase())) {
    return json(400, { ok: false, error: `fonte não liberada: ${target.hostname}` });
  }

  // algumas fontes recusam user-agent "de robô" ou o Accept de RSS
  const isPage = /youtube\.com$/i.test(target.hostname);
  const accept = isPage
    ? 'text/html,application/xhtml+xml;q=0.9, */*;q=0.5'
    : 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5';

  try {
    const upstream = await fetch(target.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 ArgosRadarBeta/0.1',
        'Accept': accept,
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
      },
    });
    const text = await upstream.text();
    if (text.length > MAX_BYTES) return json(413, { ok: false, error: 'resposta grande demais' });
    return json(200, {
      ok: upstream.ok,
      status: upstream.status,
      contentType: upstream.headers.get('content-type') || '',
      body: text,
      error: upstream.ok ? null : `a fonte respondeu ${upstream.status}`,
    });
  } catch (err) {
    const message = err?.name === 'TimeoutError' ? 'a fonte demorou demais para responder' : (err?.message || String(err));
    return json(502, { ok: false, error: message });
  }
}
