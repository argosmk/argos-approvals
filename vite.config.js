import { defineConfig } from 'vite';

// Ponte do Radar (beta) para o ambiente local.
//
// O navegador não consegue baixar RSS de outros sites por causa do CORS, então
// o próprio servidor de desenvolvimento do Vite faz o download e devolve o texto.
// Só existe em `npm run dev` — no build de produção esse endpoint não vai junto,
// e o painel avisa isso na tela.

const BLOCKED_HOST = /^(localhost$|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;
const TIMEOUT_MS = 12000;
const MAX_BYTES = 3 * 1024 * 1024;

function radarDevApi() {
  return {
    name: 'argos-radar-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/radar/fetch', async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        try {
          const asked = new URL(req.url || '', 'http://localhost').searchParams.get('url');
          if (!asked) return send(400, { ok: false, error: 'faltou o parâmetro url' });
          let target;
          try { target = new URL(asked); } catch { return send(400, { ok: false, error: 'url inválida' }); }
          if (!/^https?:$/.test(target.protocol)) return send(400, { ok: false, error: 'só http e https' });
          if (BLOCKED_HOST.test(target.hostname)) return send(400, { ok: false, error: 'endereço local bloqueado' });

          // algumas fontes recusam user-agent "de robô" ou o Accept de RSS:
          // pede JSON quando o endereço é de API e HTML quando é página de busca.
          const isApi = /\/xrpc\/|\.json(\?|$)|\/api\//i.test(target.pathname + target.search);
          const isPage = /youtube\.com\/results/i.test(target.hostname + target.pathname);
          const accept = isApi
            ? 'application/json, text/plain;q=0.9, */*;q=0.5'
            : isPage
              ? 'text/html,application/xhtml+xml;q=0.9, */*;q=0.5'
              : 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5';

          const upstream = await fetch(target, {
            redirect: 'follow',
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 ArgosRadarBeta/0.1',
              'Accept': accept,
              'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
            },
          });
          const text = await upstream.text();
          if (text.length > MAX_BYTES) return send(413, { ok: false, error: 'resposta grande demais' });
          return send(200, {
            ok: upstream.ok,
            status: upstream.status,
            contentType: upstream.headers.get('content-type') || '',
            body: text,
            error: upstream.ok ? null : `a fonte respondeu ${upstream.status}`,
          });
        } catch (err) {
          const message = err?.name === 'TimeoutError' ? 'a fonte demorou demais para responder' : (err?.message || String(err));
          return send(502, { ok: false, error: message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [radarDevApi()],
});
