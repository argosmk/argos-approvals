// Relatórios do Instagram — leitura e geração sob demanda.
//
// Quem grava é sempre o banco: o pg_cron fecha o período toda segunda (e todo
// dia 1º, no mensal), e o botão "Gerar agora" chama a mesma função por RPC.
// Nenhum dos dois depende de agente externo.

import { supabase, isSupabaseConfigured } from './supabaseClient';

export const REPORTS_TABLE = 'social_reports';

export async function listSocialReports(limit = 60) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from(REPORTS_TABLE)
    .select('id, account_id, company_id, kind, period_start, period_end, numbers, narrative, actions, created_at')
    .order('period_end', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Contas que têm relatório: só clientes com conta conectada.
 * Cliente de agência, que pede criativo para tráfego e não posta pelo sistema,
 * não aparece aqui — e é assim que o sistema separa um do outro.
 */
export async function listReportAccounts() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('contas_com_relatorio');
  if (error) throw error;
  return data || [];
}

/** Gera (ou regrava) o relatório do período que termina agora. */
export async function generateReport(accountId, kind = 'weekly') {
  if (!isSupabaseConfigured || !supabase) throw new Error('banco não configurado');
  const { data, error } = await supabase.rpc('gerar_relatorio', {
    p_account_id: accountId,
    p_kind: kind,
  });
  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------ */
/* formatação                                                          */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function num(v, casas = 0) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** "08 – 14 set" ou "29 set – 5 out" quando o período vira o mês. */
export function periodLabel(inicio, fim) {
  const a = new Date(inicio);
  const b = new Date(fim);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 'período';
  const fimReal = new Date(b.getTime() - 1); // o fim é exclusivo
  const mesmoMes = a.getMonth() === fimReal.getMonth();
  return mesmoMes
    ? `${a.getDate()} – ${fimReal.getDate()} ${MESES[fimReal.getMonth()]}`
    : `${a.getDate()} ${MESES[a.getMonth()]} – ${fimReal.getDate()} ${MESES[fimReal.getMonth()]}`;
}

export function dateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const KIND_LABELS = { weekly: 'Semanal', monthly: 'Mensal' };
export function kindLabel(kind) {
  return KIND_LABELS[kind] || 'Semanal';
}

export const FORMAT_LABELS = { REELS: 'Reels', CAROUSEL: 'Carrossel', IMAGE: 'Estático', STORY: 'Story' };
export function formatLabel(id) {
  return FORMAT_LABELS[id] || id || 'Outro';
}

const DIAS = { Mon: 'Segunda', Tue: 'Terça', Wed: 'Quarta', Thu: 'Quinta', Fri: 'Sexta', Sat: 'Sábado', Sun: 'Domingo' };
export function weekdayLabel(id) {
  return DIAS[id] || id;
}

/* ------------------------------------------------------------------ */
/* comparação com o período anterior                                   */

/**
 * Variação em relação ao período anterior.
 * Devolve null quando não há com o que comparar — e nesse caso a tela não
 * mostra seta nenhuma, em vez de fingir que houve estabilidade.
 */
export function delta(atual, anterior) {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined) return null;
  const a = Number(atual);
  const b = Number(anterior);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (b === 0) return a === 0 ? null : { dir: 'up', abs: a, pct: null };
  const diff = a - b;
  if (diff === 0) return { dir: 'flat', abs: 0, pct: 0 };
  return { dir: diff > 0 ? 'up' : 'down', abs: Math.abs(diff), pct: Math.round((diff / b) * 100) };
}

/** Os números que viram cartão no topo do relatório.
 *  nivel 1 carrega a leitura; nivel 2 dá contexto e fica menor. */
export function kpis(numbers) {
  const r = numbers?.resumo || {};
  const p = numbers?.semana_anterior || {};
  return [
    { id: 'posts', label: 'Posts', valor: r.posts, anterior: p.posts, nivel: 1 },
    { id: 'views', label: 'Views', valor: r.views, anterior: p.views, nivel: 1 },
    { id: 'alcance', label: 'Contas alcançadas', valor: r.alcance, anterior: p.alcance, nivel: 1 },
    { id: 'indice', label: 'Índice Argos', valor: r.indice_medio, anterior: p.indice_medio, casas: 1, nivel: 1 },
    { id: 'interacoes', label: 'Interações', valor: r.interacoes, nivel: 2 },
    { id: 'seguidores', label: 'Seguidores ganhos', valor: r.seguidores_ganhos, anterior: p.seguidores_ganhos, nivel: 2 },
    { id: 'perfil', label: 'Visitas ao perfil', valor: r.visitas_perfil, nivel: 2 },
  ];
}

/** Um post só não é tendência: abaixo disso o relatório registra, não conclui. */
export const MINIMO_PARA_COMPARAR = 3;

export function temBaseParaComparar(numbers) {
  return Number(numbers?.resumo?.posts || 0) >= MINIMO_PARA_COMPARAR;
}
