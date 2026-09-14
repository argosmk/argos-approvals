// Pré-preenchimento inicial do Radar no Alfa.
// Só cria um briefing quando ainda não existe no localStorage do navegador.
// Briefings já criados/editados pelo usuário nunca são sobrescritos.

const STORE_KEY = 'argos_radar_beta_v1';

const ALPHA_BRIEFING_SEEDS = {
  argos: {
    business: 'Marketing digital, posicionamento e conteúdo para empresas.',
    audience: 'Empresas e empreendedores que buscam melhorar presença, posicionamento e aquisição no digital.',
    keywords: [
      'marketing digital',
      'inteligência artificial no marketing',
      'GEO marketing',
      'SEO',
      'posicionamento digital',
      'social media',
      'negócios locais',
    ],
    themes: ['IA e marketing', 'reputação digital', 'busca e recomendação por IA'],
  },
  broetto: {
    business: '',
    audience: '',
    keywords: [],
    themes: ['memes para redes sociais'],
    notes: 'As tarefas recentes não trazem contexto suficiente sobre o nicho da Broetto. Completar manualmente o que a empresa vende e as palavras-chave antes da varredura.',
  },
  'new-marketing': {
    business: 'Produção de conteúdo e criativos de marketing, com forte presença recente de clientes do segmento de piscinas.',
    audience: 'Consumidores interessados em piscinas, área de lazer e melhoria do quintal, além de negócios do setor de piscinas.',
    keywords: [
      'piscinas',
      'mercado de piscinas',
      'tendências de piscinas',
      'manutenção de piscinas',
      'tratamento de água de piscina',
      'área de lazer',
      'tecnologia para piscinas',
      'promoção de piscinas',
    ],
    themes: ['desejo de compra', 'dicas para piscina', 'produtos e tecnologias para piscinas'],
  },
  'rafael-sales': {
    business: 'Maquiagem profissional e conteúdo de beleza.',
    audience: 'Pessoas interessadas em maquiagem, beleza, técnicas de make e serviços profissionais de maquiagem.',
    keywords: [
      'maquiagem',
      'maquiagem profissional',
      'maquiagem de noiva',
      'técnicas de maquiagem',
      'tendências de maquiagem',
      'beleza',
      'makeup trends',
      'maquiagem Goiânia',
    ],
    themes: ['dicas de maquiagem', 'react de beleza', 'polêmicas de maquiagem', 'noivas'],
  },
  sevenx: {
    business: 'Marketing para negócios locais nos Estados Unidos; a tarefa recente está focada em uma empresa de flooring e instalação de pisos.',
    audience: 'Homeowners buscando trocar ou instalar pisos e melhorar a casa.',
    keywords: [
      'flooring',
      'flooring installation',
      'luxury vinyl plank',
      'hardwood flooring',
      'laminate flooring',
      'mobile flooring showroom',
      'home improvement',
      'flooring trends',
    ],
    themes: ['flooring', 'reformas residenciais', 'ofertas para homeowners', 'marketing local nos EUA'],
  },
  sprinthub: {
    business: 'Plataforma de CRM, atendimento, marketing, automações e inteligência artificial para operações comerciais.',
    audience: 'Empresas, equipes comerciais e agências que precisam integrar vendas, atendimento, automações e IA.',
    keywords: [
      'CRM',
      'automação de vendas',
      'agentes de IA',
      'IA em vendas',
      'WhatsApp CRM',
      'gestão comercial',
      'CRM white label',
      'automação de atendimento',
    ],
    themes: ['IA aplicada à operação', 'vendas', 'CRM', 'automação', 'white label'],
  },
  supergeeks: {
    business: 'Educação em programação e tecnologia para crianças e adolescentes.',
    audience: 'Pais de crianças e adolescentes e jovens interessados em programação, games, robótica e tecnologia.',
    keywords: [
      'programação para crianças',
      'programação para adolescentes',
      'robótica educacional',
      'educação tecnológica',
      'inteligência artificial na educação',
      'games e educação',
      'Python para jovens',
      'futuro do trabalho tecnologia',
    ],
    themes: ['educação do futuro', 'programação', 'games', 'IA', 'mercado de tecnologia'],
  },
  'unik-villas': {
    business: 'Casas de temporada em Orlando para viagens em família e turismo na região dos parques.',
    audience: 'Famílias e turistas planejando viagem para Orlando, Disney e atrações da Flórida.',
    keywords: [
      'Orlando travel',
      'Disney World',
      'vacation homes Orlando',
      'EPCOT',
      'Universal Orlando',
      'Orlando travel tips',
      'family travel Florida',
      'Orlando attractions',
    ],
    themes: ['dicas de Orlando', 'parques', 'economia em viagem', 'eventos e atrações', 'casas de temporada'],
  },
};

function makeBriefing(companyId, seed) {
  return {
    companyId,
    active: true,
    business: seed.business || '',
    keywords: seed.keywords || [],
    audience: seed.audience || '',
    themes: seed.themes || [],
    exclude: [],
    competitors: [],
    feeds: [],
    notes: seed.notes || 'Pré-preenchido automaticamente com base nas tarefas recentes do Sistema Argos. Revise e ajuste antes de usar como briefing definitivo.',
    updatedAt: new Date().toISOString(),
  };
}

function applyAlphaRadarSeeds() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const store = parsed && typeof parsed === 'object' ? parsed : {};
    const briefings = { ...(store.briefings || {}) };
    let changed = false;

    for (const [companyId, seed] of Object.entries(ALPHA_BRIEFING_SEEDS)) {
      if (Object.prototype.hasOwnProperty.call(briefings, companyId)) continue;
      briefings[companyId] = makeBriefing(companyId, seed);
      changed = true;
    }

    if (!changed) return;
    localStorage.setItem(STORE_KEY, JSON.stringify({
      ...store,
      version: Math.max(Number(store.version) || 0, 2),
      briefings,
    }));
  } catch (error) {
    console.warn('radar: não foi possível aplicar os briefings iniciais do Alfa', error);
  }
}

applyAlphaRadarSeeds();
