// Gera o manifest.json dinamicamente (Cloudflare Pages Function) pra que o icone
// do app instalado (desktop/celular) sempre acompanhe o favicon configurado no
// sistema, sem precisar de novo deploy toda vez que ele mudar.
const SUPABASE_URL = 'https://wzgdpfjsyxlxiapbuknp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z2RwZmpzeXhseGlhcGJ1a25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjI2NTYsImV4cCI6MjA5ODQzODY1Nn0.TdNlxIhdj0B2kvJ_QAnVqvbaIKKyRT7pqPWyfxifwpM';
const FALLBACK_ICON = 'https://wzgdpfjsyxlxiapbuknp.supabase.co/storage/v1/object/public/avatars/system/favicon/a66ab9e2-e1b5-47cc-88d0-5d75c637ca50.png';

export async function onRequestGet() {
  let icon = FALLBACK_ICON;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_system_favicon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: '{}',
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data === 'string' && data.trim()) icon = data.trim();
    }
  } catch (err) {
    // mantem o fallback se a consulta falhar
  }

  const manifest = {
    name: 'Argos Approval',
    short_name: 'Argos',
    description: 'Painel de aprovação e produção da Argos',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#14171f',
    theme_color: '#14171f',
    icons: [
      { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
