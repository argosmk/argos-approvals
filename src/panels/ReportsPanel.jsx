import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  delta,
  dateLabel,
  formatLabel,
  generateReport,
  kindLabel,
  kpis,
  listReportAccounts,
  listSocialReports,
  num,
  periodLabel,
  temBaseParaComparar,
  weekdayLabel,
  MINIMO_PARA_COMPARAR,
} from '../services/reportsService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import './reports.css';

// Painel Relatórios: o banco fecha o período sozinho toda segunda, e o botão
// aqui em cima gera na hora — nos dois casos quem escreve é a mesma função.

export default function ReportsPanel({ companies = [] }) {
  const [reports, setReports] = useState([]);
  const [contas, setContas] = useState([]);
  const [cliente, setCliente] = useState('todos');
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const nomeDoCliente = useCallback(
    id => companies.find(c => c.id === id)?.name || id || 'cliente',
    [companies],
  );

  const carregar = useCallback(async (manterSelecao) => {
    const [lista, cs] = await Promise.all([
      listSocialReports(),
      listReportAccounts().catch(() => []),
    ]);
    setReports(lista);
    setContas(cs);
    setSelecionado(atual => (manterSelecao && lista.some(r => r.id === atual) ? atual : lista[0]?.id || null));
    return lista;
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await carregar(false);
      } catch (e) {
        if (vivo) setErro(e?.message || String(e));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [carregar]);

  const clientes = useMemo(() => {
    const ids = [...new Set(reports.map(r => r.company_id).filter(Boolean))];
    return ids.map(id => ({ id, label: nomeDoCliente(id), count: reports.filter(r => r.company_id === id).length }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [reports, nomeDoCliente]);

  const visiveis = useMemo(
    () => (cliente === 'todos' ? reports : reports.filter(r => r.company_id === cliente)),
    [reports, cliente],
  );

  useEffect(() => {
    if (visiveis.length && !visiveis.some(r => r.id === selecionado)) setSelecionado(visiveis[0].id);
  }, [visiveis, selecionado]);

  const atual = useMemo(() => reports.find(r => r.id === selecionado) || null, [reports, selecionado]);

  return <section className="panel-page rep">
    <header className="rep-head">
      <div>
        <h1>Relatórios<span className="rep-auto">automático</span></h1>
        <p>Toda segunda às 8h o banco fecha a semana e escreve o que funcionou, o que não funcionou e os ajustes
          para a próxima pauta. No dia 1º ele fecha o mês. Aqui do lado dá para gerar na hora, sem esperar.</p>
      </div>
      {!!contas.length && <Gerador contas={contas} nomeDoCliente={nomeDoCliente} aoGerar={carregar} />}
    </header>

    {carregando && <p className="rep-note">Carregando…</p>}
    {erro && <div className="rep-empty"><h3>Não consegui carregar</h3><p>{erro}</p></div>}

    {!carregando && !erro && !reports.length && <div className="rep-empty">
      <h3>Nenhum relatório ainda.</h3>
      <p>{isSupabaseConfigured
        ? 'O próximo fecha na segunda-feira, às 8h — ou use "Gerar agora" aqui em cima. Ele só tem o que dizer se houver post publicado no período.'
        : 'Este painel lê os relatórios gravados no banco do sistema. No ambiente local, com banco simulado, ele fica vazio.'}</p>
    </div>}

    {!carregando && !erro && !!reports.length && <>
      {clientes.length > 1 && <div className="rep-clients">
        <button className={`rep-chip${cliente === 'todos' ? ' is-on' : ''}`} onClick={() => setCliente('todos')}>
          Todos<small>{reports.length}</small>
        </button>
        {clientes.map(c => <button
          key={c.id}
          className={`rep-chip${cliente === c.id ? ' is-on' : ''}`}
          onClick={() => setCliente(c.id)}
        >{c.label}<small>{c.count}</small></button>)}
      </div>}

      <div className="rep-layout">
        <aside className="rep-weeks">
          {visiveis.map(r => {
            const resumo = r.numbers?.resumo || {};
            return <button
              key={r.id}
              className={`rep-week${r.id === selecionado ? ' is-on' : ''}`}
              onClick={() => setSelecionado(r.id)}
            >
              <b>{periodLabel(r.period_start, r.period_end)}<i>{kindLabel(r.kind)}</i></b>
              <small>
                {cliente === 'todos' ? `${nomeDoCliente(r.company_id)} · ` : ''}
                {num(resumo.posts)} post(s)
              </small>
            </button>;
          })}
        </aside>

        {atual && <ReportDetail report={atual} cliente={nomeDoCliente(atual.company_id)} />}
      </div>
    </>}
  </section>;
}

/** Gerar na hora: escolhe a conta e o período e chama a mesma função do cron. */
function Gerador({ contas, nomeDoCliente, aoGerar }) {
  const [conta, setConta] = useState(contas[0]?.account_id || '');
  const [kind, setKind] = useState('weekly');
  const [rodando, setRodando] = useState(false);
  const [recado, setRecado] = useState(null);

  useEffect(() => {
    if (!contas.some(c => c.account_id === conta)) setConta(contas[0]?.account_id || '');
  }, [contas, conta]);

  async function gerar() {
    if (!conta || rodando) return;
    setRodando(true);
    setRecado(null);
    try {
      const r = await generateReport(conta, kind);
      await aoGerar(false);
      setRecado({ ok: true, texto: `Pronto: ${num(r?.posts)} post(s) no período de @${r?.conta}.` });
    } catch (e) {
      setRecado({ ok: false, texto: e?.message || String(e) });
    } finally {
      setRodando(false);
    }
  }

  return <div className="rep-gerador">
    <div className="rep-gerador-row">
      <select value={conta} onChange={e => setConta(e.target.value)} aria-label="Cliente">
        {contas.map(c => <option key={c.account_id} value={c.account_id}>
          {nomeDoCliente(c.company_id)} · @{c.username}
        </option>)}
      </select>
      <select value={kind} onChange={e => setKind(e.target.value)} aria-label="Período">
        <option value="weekly">Últimos 7 dias</option>
        <option value="monthly">Últimos 30 dias</option>
      </select>
      <button className="rep-btn" onClick={gerar} disabled={rodando || !conta}>
        {rodando ? 'Gerando…' : 'Gerar agora'}
      </button>
    </div>
    {recado && <p className={`rep-recado${recado.ok ? '' : ' is-erro'}`}>{recado.texto}</p>}
  </div>;
}

function ReportDetail({ report, cliente }) {
  const n = report.numbers || {};
  const acoes = Array.isArray(report.actions) ? report.actions : [];
  const melhores = Array.isArray(n.melhores) ? n.melhores : [];
  const piores = Array.isArray(n.piores) ? n.piores : [];
  const mesmosPosts = melhores.length && piores.length
    && melhores.length === piores.length
    && melhores.every(m => piores.some(p => p.permalink === m.permalink));
  const base = temBaseParaComparar(n);
  const mensal = report.kind === 'monthly';

  return <div className="rep-body">
    <div className="rep-title">
      <h2>{cliente}<span>{kindLabel(report.kind)} · {periodLabel(report.period_start, report.period_end)}</span></h2>
      {n.conta && <a href={`https://instagram.com/${n.conta}`} target="_blank" rel="noreferrer">@{n.conta}</a>}
    </div>

    <div className="rep-kpis">
      {kpis(n).map(k => {
        const d = delta(k.valor, k.anterior);
        return <div className="rep-kpi" key={k.id}>
          <span>{k.label}</span>
          <b>{num(k.valor, k.casas || 0)}</b>
          {d && d.dir !== 'flat' && <i className={d.dir}>
            {d.dir === 'up' ? '↑' : '↓'} {num(d.abs, k.casas || 0)}{d.pct != null ? ` (${Math.abs(d.pct)}%)` : ''}
          </i>}
          {d && d.dir === 'flat' && <i>igual ao período anterior</i>}
        </div>;
      })}
    </div>

    {!base && <p className="rep-thin">
      Menos de {MINIMO_PARA_COMPARAR} posts no período: o que está abaixo é registro, não tendência.
      Comparação entre formatos e horários só passa a significar alguma coisa com mais volume.
    </p>}

    {report.narrative && <section className="rep-block">
      <h2>A leitura {mensal ? 'do mês' : 'da semana'}</h2>
      <p className="rep-narrative">{report.narrative}</p>
    </section>}

    {!!acoes.length && <section className="rep-block">
      <h2>Ajustes para a próxima pauta</h2>
      <ol className="rep-actions">{acoes.map((a, i) => <li key={i}>{String(a)}</li>)}</ol>
    </section>}

    {(melhores.length > 0) && <section className="rep-block rep-two">
      <div>
        <h3>{mesmosPosts ? 'Posts do período' : 'Melhores'}</h3>
        <PostList posts={melhores} />
      </div>
      {!mesmosPosts && <div>
        <h3>Piores</h3>
        <PostList posts={piores} />
      </div>}
    </section>}

    {(n.por_formato?.length > 0 || n.por_pilar?.length > 0) && <section className="rep-block">
      <h3>Por formato</h3>
      <Bars
        itens={(n.por_formato || []).map(f => ({
          label: formatLabel(f.formato), extra: `${f.posts} post(s)`, valor: f.views_medio,
        }))}
        sufixo="views em média"
      />
      <h3 style={{ marginTop: 20 }}>Por pilar</h3>
      <Bars
        itens={(n.por_pilar || []).map(p => ({
          label: p.pilar, extra: `${p.posts} post(s)`, valor: p.views_medio,
        }))}
        sufixo="views em média"
      />
    </section>}

    {n.por_horario?.length > 0 && <section className="rep-block">
      <h3>Por horário</h3>
      <Bars
        itens={n.por_horario.map(h => ({
          label: `${weekdayLabel(h.dia_semana)} ${String(h.hora).padStart(2, '0')}h`,
          extra: `${h.posts} post(s)`, valor: h.views_medio,
        }))}
        sufixo="views em média"
      />
    </section>}

    <Gaps lacunas={n.lacunas} />

    <div className="rep-foot">
      <span>Período: {periodLabel(report.period_start, report.period_end)}</span>
      <span>Gerado em {dateLabel(report.created_at)}</span>
      <span>Só posts desta conta no Instagram, medidos pelo próprio Instagram.</span>
    </div>
  </div>;
}

function PostList({ posts = [] }) {
  if (!posts.length) return <p className="rep-note">Nada com métrica confiável neste período.</p>;
  return <div className="rep-posts">
    {posts.map(p => <div className="rep-post" key={p.permalink}>
      <div style={{ minWidth: 0 }}>
        <a href={p.permalink} target="_blank" rel="noreferrer">{formatLabel(p.formato)}{p.pilar ? ` · ${p.pilar}` : ''}</a>
        <small>
          {num(p.views)} views · {num(p.alcance)} alcançados
          {p.alcance_relativo != null ? ` · ${num(p.alcance_relativo, 2)}× a mediana` : ''}
        </small>
      </div>
      <div className="rep-score">{num(p.indice, 1)}<em>índice</em></div>
    </div>)}
  </div>;
}

/**
 * Barras de magnitude: uma cor só (o dourado do sistema), comprimento
 * proporcional ao maior valor da lista. O número fica ao lado, nunca dentro
 * da barra — dentro ele corta quando a barra é curta.
 */
function Bars({ itens = [], sufixo = '' }) {
  if (!itens.length) return <p className="rep-note">Sem dados suficientes neste período.</p>;
  const max = Math.max(...itens.map(i => Number(i.valor) || 0), 1);
  return <div className="rep-bars">
    {itens.map((i, idx) => <div className="rep-bar" key={`${i.label}-${idx}`}>
      <span className="rep-bar-label">{i.label}{i.extra ? <small>{i.extra}</small> : null}</span>
      <div className="rep-track" title={`${i.label}: ${num(i.valor)} ${sufixo}`}>
        <i style={{ width: `${Math.max((Number(i.valor) || 0) / max * 100, 1)}%` }} />
      </div>
      <span className="rep-bar-val">{num(i.valor)}</span>
    </div>)}
  </div>;
}

function Gaps({ lacunas }) {
  if (!lacunas) return null;
  const itens = [];
  if (lacunas.posts_sem_metrica_confiavel > 0) {
    itens.push(`${lacunas.posts_sem_metrica_confiavel} post(s) do período sem métrica confiável — o Instagram devolve dado incompleto quando a coleta acontece muito depois da publicação.`);
  }
  if (lacunas.posts_sem_pilar > 0) {
    itens.push(`${lacunas.posts_sem_pilar} post(s) sem pilar definido — sem isso o relatório compara formatos, mas não consegue dizer qual tipo de conteúdo funciona.`);
  }
  if (Number(lacunas.base_historica_confiavel || 0) < 10) {
    itens.push(`Só ${num(lacunas.base_historica_confiavel)} post(s) no histórico têm métrica confiável. A comparação fica mais firme a cada semana publicada.`);
  }
  if (!itens.length) return null;
  return <div className="rep-gaps">
    <div>
      <b>O que está limitando esta análise</b>
      <ul>{itens.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  </div>;
}
