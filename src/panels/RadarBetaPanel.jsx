import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RADAR_LANGUAGES,
  RADAR_SOURCES,
  RADAR_TTL_DAYS_DEFAULT,
  briefingQueries,
  emptyBriefing,
  itemsForCompany,
  kindLabel,
  listToText,
  loadRadarStore,
  mergeItems,
  normalizeSettings,
  parseList,
  pruneExpired,
  runScan,
  saveRadarStore,
  sortItems,
} from '../services/radarService';
import './radarBeta.css';

// Painel Radar (beta): vive por conta própria. Guarda tudo no localStorage,
// não usa Supabase, não mexe em tarefas e não chama IA. A varredura é só manual.

function fmtWhen(iso) {
  if (!iso) return 'sem data';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'sem data';
  const diff = (Date.now() - d.getTime()) / 3600000;
  if (diff < 1) return 'agora há pouco';
  if (diff < 24) return `há ${Math.round(diff)}h`;
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function RadarBetaPanel({ companies = [] }) {
  const [store, setStore] = useState(() => loadRadarStore());
  const [tab, setTab] = useState('feed');
  const [view, setView] = useState('todas');       // todas | salvos
  const [companyFilter, setCompanyFilter] = useState('');
  const [editing, setEditing] = useState('');
  const [scan, setScan] = useState(null);           // {done,total,label}
  const [message, setMessage] = useState(null);
  const abortRef = useRef(null);

  // limpeza por validade ao abrir o painel
  useEffect(() => {
    const savedKeys = (store.saved || []).map(s => s.key);
    const kept = pruneExpired(store.items || [], savedKeys);
    if (kept.length !== (store.items || []).length) persist({ ...store, items: kept });
    return () => abortRef.current?.abort();
     
  }, []);

  function persist(next) {
    setStore(next);
    saveRadarStore(next);
    return next;
  }

  const settings = useMemo(() => normalizeSettings(store.settings), [store.settings]);
  const briefings = useMemo(() => Object.values(store.briefings || {}), [store.briefings]);
  const activeBriefings = briefings.filter(b => b.active !== false && briefingQueries(b, settings).length);
  const companyName = id => companies.find(c => c.id === id)?.name || id;
  const savedKeys = useMemo(() => new Set((store.saved || []).map(s => s.key)), [store.saved]);

  const visibleItems = useMemo(() => {
    let list = itemsForCompany(store.items || [], companyFilter);
    if (view === 'salvos') list = list.filter(it => savedKeys.has(it.key));
    return sortItems(list, companyFilter).slice(0, 200);
  }, [store.items, companyFilter, view, savedKeys]);

  async function handleScan() {
    if (!activeBriefings.length) {
      setMessage({ type: 'warn', text: 'Cadastre o briefing de pelo menos um cliente antes de varrer.' });
      setTab('briefings');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setMessage(null);
    setView('todas');
    setScan({ done: 0, total: 0, label: 'preparando' });
    try {
      const result = await runScan(activeBriefings, {
        ttlDays: store.ttlDays || RADAR_TTL_DAYS_DEFAULT,
        settings,
        signal: controller.signal,
        onProgress: p => setScan(p),
      });
      const merged = mergeItems(store.items || [], result.items);
      const kept = pruneExpired(merged.items, [...savedKeys]);
      persist({ ...store, items: kept, lastScanAt: new Date().toISOString() });
      const repetidas = result.items.length - merged.added;
      const parts = [`${result.queries} busca(s)`, `${merged.added} pauta(s) nova(s)`];
      if (repetidas > 0) parts.push(`${repetidas} já conhecida(s)`);
      setMessage({
        type: merged.added ? 'ok' : 'warn',
        text: parts.join(' · '),
        detail: result.errors.length
          ? `${result.errors.length} fonte(s) não responderam: ${result.errors.slice(0, 2).map(e => `${e.source} — ${e.message}`).join(' · ')}`
          : '',
      });
    } catch (err) {
      setMessage({ type: 'bad', text: err?.message || String(err) });
    } finally {
      setScan(null);
      abortRef.current = null;
    }
  }

  function toggleSaved(item) {
    const saved = store.saved || [];
    const next = savedKeys.has(item.key)
      ? saved.filter(s => s.key !== item.key)
      : [...saved, { key: item.key, title: item.title, url: item.url, savedAt: new Date().toISOString() }];
    persist({ ...store, saved: next });
  }

  function discard(item) {
    persist({
      ...store,
      items: (store.items || []).filter(it => it.key !== item.key),
      saved: (store.saved || []).filter(s => s.key !== item.key),
    });
  }

  return <section className="panel-page radar">
    <header className="radar-head">
      <div>
        <h1>Radar de Pautas<span className="radar-beta">beta</span></h1>
        <p>Procura assuntos em notícias, vídeos e redes a partir das palavras-chave de cada cliente. Sem IA, sem custo, isolado do resto do sistema.</p>
      </div>
      <div className="radar-head-actions">
        <button onClick={() => setTab(tab === 'feed' ? 'briefings' : 'feed')}>{tab === 'feed' ? 'Briefings' : 'Voltar ao feed'}</button>
        <button className="primary" disabled={!!scan} onClick={handleScan}>{scan ? 'Varrendo…' : 'Varredura agora'}</button>
      </div>
    </header>

    {scan && <div className="radar-scan">
      <div className="radar-scan-top">
        <b>Varrendo fontes…</b>
        <span>{scan.done}/{scan.total || '?'}{scan.label ? ` · ${scan.label}` : ''}</span>
        <button onClick={() => abortRef.current?.abort()}>Parar</button>
      </div>
      <div className="radar-progress"><i style={{ width: `${scan.total ? (scan.done / scan.total) * 100 : 5}%` }} /></div>
    </div>}

    {message && <p className={`radar-status is-${message.type}`}>
      <i className="radar-dot" />
      <span>{message.text}{message.detail ? ` — ${message.detail}` : ''}</span>
    </p>}

    {tab === 'feed'
      ? <FeedTab
          items={visibleItems}
          allItems={store.items || []}
          briefings={briefings}
          companyName={companyName}
          companyFilter={companyFilter}
          setCompanyFilter={setCompanyFilter}
          view={view}
          setView={setView}
          savedKeys={savedKeys}
          toggleSaved={toggleSaved}
          discard={discard}
          lastScanAt={store.lastScanAt}
          ttlDays={store.ttlDays || RADAR_TTL_DAYS_DEFAULT}
          setTtlDays={days => persist({ ...store, ttlDays: days })}
          goToBriefings={() => setTab('briefings')}
        />
      : <BriefingsTab
          companies={companies}
          store={store}
          settings={settings}
          setSettings={next => persist({ ...store, settings: next })}
          persist={persist}
          editing={editing}
          setEditing={setEditing}
        />}
  </section>;
}

function FeedTab({ items, allItems, briefings, companyName, companyFilter, setCompanyFilter, view, setView, savedKeys, toggleSaved, discard, lastScanAt, ttlDays, setTtlDays, goToBriefings }) {
  const doCliente = itemsForCompany(allItems, companyFilter);
  const salvosAqui = doCliente.filter(it => savedKeys.has(it.key)).length;
  const chips = [
    { id: '', label: 'Todos', count: allItems.length },
    ...briefings.map(b => ({
      id: b.companyId,
      label: companyName(b.companyId),
      count: itemsForCompany(allItems, b.companyId).length,
    })),
  ];

  return <>
    <div className="radar-bar">
      {chips.map(chip => <button
        key={chip.id || 'all'}
        className={`radar-chip${companyFilter === chip.id ? ' is-on' : ''}`}
        onClick={() => setCompanyFilter(chip.id)}
      >{chip.label}<span className="radar-chip-count">{chip.count}</span></button>)}
      <div className="radar-bar-right">
        <div className="radar-views">
          <button className={view === 'todas' ? 'is-on' : ''} onClick={() => setView('todas')}>Pautas</button>
          <button className={view === 'salvos' ? 'is-on' : ''} onClick={() => setView('salvos')}>Salvos {salvosAqui ? `(${salvosAqui})` : ''}</button>
        </div>
        <label className="radar-check" style={{ fontWeight: 500 }}>
          descartar em
          <input type="number" min="1" max="90" value={ttlDays}
            onChange={e => setTtlDays(Math.max(1, Number(e.target.value) || RADAR_TTL_DAYS_DEFAULT))}
            style={{ width: 58, minHeight: 30, textAlign: 'center' }} />
          dias
        </label>
      </div>
    </div>

    {lastScanAt && view === 'todas' && <p className="radar-status"><i className="radar-dot" /><span>Última varredura {fmtWhen(lastScanAt)}</span></p>}

    {!items.length
      ? <div className="radar-empty">
          <h3>{view === 'salvos' ? 'Nada salvo por aqui ainda.' : 'Nenhuma pauta por aqui ainda.'}</h3>
          <p>{view === 'salvos'
            ? 'As pautas que você salvar no feed ficam guardadas aqui, sem prazo de validade.'
            : briefings.length
              ? 'Clique em “Varredura agora” para buscar nas fontes ligadas.'
              : 'Comece cadastrando o briefing de um cliente — é ele que diz ao radar o que procurar.'}</p>
          {!briefings.length && view === 'todas' && <p style={{ marginTop: 14 }}><button onClick={goToBriefings}>Abrir briefings</button></p>}
        </div>
      : <div className="radar-list">
          {items.map(item => <RadarCard
            key={item.key}
            item={item}
            companyName={companyName}
            saved={savedKeys.has(item.key)}
            onToggleSave={() => toggleSaved(item)}
            onDiscard={() => discard(item)}
          />)}
        </div>}
  </>;
}

function RadarCard({ item, companyName, saved, onToggleSave, onDiscard }) {
  const clients = Object.entries(item.clients || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.score - a.score);
  const best = clients[0];
  const termos = [...new Set(clients.map(c => c.term).filter(Boolean))];
  const casou = [...new Set((best?.hits || []).filter(h => h && h !== best.term))];

  return <article className={`radar-card kind-${item.kind || 'noticia'}${saved ? ' is-saved' : ''}`}>
    <div style={{ minWidth: 0 }}>
      <div className="radar-card-source">
        <span className="radar-kind">{kindLabel(item.kind)}</span>
        <span>{item.sourceName || item.sourceType}</span>
        <span className="radar-sep">•</span>
        <span>{fmtWhen(item.publishedAt)}</span>
      </div>
      <a className="radar-card-title" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
      {item.snippet && <p className="radar-card-snippet">
        {item.snippet.slice(0, 220)}{item.snippet.length > 220 ? '…' : ''}
      </p>}

      <div className="radar-tags">
        {clients.map(c => <span key={c.id} className="radar-tag is-client">
          {companyName(c.id)}<em>Relevância:</em><b>{c.score}</b>
        </span>)}
        {termos.map(t => <span key={t} className="radar-tag is-term">{t}</span>)}
      </div>

      <p className="radar-card-why">
        <span className="radar-why-label">Por que apareceu</span>
        <span>
          {best?.term ? <>veio da busca por <b>{best.term}</b></> : 'veio de um feed do briefing'}
          {casou.length ? <> e bateu com <b>{casou.join(', ')}</b></> : null}
          {clients.length > 1 ? ` · também serve para ${clients.slice(1).map(c => companyName(c.id)).join(', ')}` : ''}
        </span>
      </p>
    </div>

    <div className="radar-card-actions">
      <button className={saved ? 'radar-saved' : ''} onClick={onToggleSave}>{saved ? 'Salvo ✓' : 'Salvar'}</button>
      <button className="ghost" onClick={onDiscard}>Descartar</button>
    </div>
  </article>;
}

function BriefingsTab({ companies, store, settings, setSettings, persist, editing, setEditing }) {
  const briefings = store.briefings || {};
  const semBriefing = companies.filter(c => c.active !== false && !briefings[c.id]);

  function update(companyId, patch) {
    const atual = briefings[companyId] || emptyBriefing(companyId);
    persist({ ...store, briefings: { ...briefings, [companyId]: { ...atual, ...patch, updatedAt: new Date().toISOString() } } });
  }
  function remove(id) {
    if (!confirm('Apagar o briefing deste cliente?')) return;
    const next = { ...briefings };
    delete next[id];
    persist({ ...store, briefings: next });
    if (editing === id) setEditing('');
  }
  const setSource = (id, on) => setSettings({ ...settings, sources: { ...settings.sources, [id]: on } });

  return <>
    <div className="radar-settings">
      <b>Onde o radar procura</b>
      <small>Vale para todos os clientes. A varredura só acontece quando você clica em “Varredura agora”.</small>
      <div className="radar-settings-grid">
        {RADAR_SOURCES.map(s => <label key={s.id} className="radar-check">
          <input type="checkbox" checked={!!settings.sources[s.id]} onChange={e => setSource(s.id, e.target.checked)} />
          {s.label} <small>({s.hint})</small>
        </label>)}
        <label className="radar-check" style={{ marginLeft: 'auto', gap: 8 }}>
          Idioma
          <select value={settings.language} onChange={e => setSettings({ ...settings, language: e.target.value })} style={{ minHeight: 32 }}>
            {RADAR_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
      </div>
      <p className="radar-note" style={{ marginTop: 12 }}>
        Instagram e TikTok não têm busca pública sem chave de API — quando quisermos esses dois, vai precisar de integração paga.
      </p>
    </div>

    <div className="radar-clients">
      <div className="radar-clients-head">
        <b>Clientes no radar</b>
        <select value="" onChange={e => { if (e.target.value) { setEditing(e.target.value); update(e.target.value, {}); } }}>
          <option value="">+ adicionar cliente</option>
          {semBriefing.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="radar-clients-list">
        {Object.values(briefings).map(b => <button
          key={b.companyId}
          className={`radar-chip${editing === b.companyId ? ' is-on' : ''}`}
          onClick={() => setEditing(b.companyId)}
        >
          {companies.find(c => c.id === b.companyId)?.name || b.companyId}{b.active === false ? ' (pausado)' : ''}
          <span className="radar-chip-count">{briefingQueries(b, settings).length} busca(s)</span>
        </button>)}
        {!Object.keys(briefings).length && <span className="radar-note" style={{ margin: 0 }}>Nenhum cliente configurado ainda.</span>}
      </div>
    </div>

    {editing && <BriefingEditor
      key={editing}
      briefing={briefings[editing] || emptyBriefing(editing)}
      settings={settings}
      title={companies.find(c => c.id === editing)?.name || editing}
      onChange={patch => update(editing, patch)}
      onRemove={() => remove(editing)}
    />}

    <p className="radar-note">
      Beta: tudo fica guardado só neste navegador e a varredura depende do ambiente local (npm run dev).
      Por enquanto ela é sempre manual — nada roda sozinho.
    </p>
  </>;
}

/**
 * Campo de lista. O texto digitado fica intacto enquanto a pessoa escreve
 * (dá pra usar espaço, vírgula e acento à vontade); a lista só é recalculada
 * a cada tecla para quem consome, sem reescrever o que está na tela.
 */
function ListField({ label, hint, value, onChange, placeholder }) {
  const [text, setText] = useState(() => listToText(value));
  function handle(e) {
    setText(e.target.value);
    onChange(parseList(e.target.value));
  }
  return <label>{label}{hint ? <> <small>{hint}</small></> : null}
    <textarea rows={2} value={text} onChange={handle} placeholder={placeholder} />
  </label>;
}

function BriefingEditor({ briefing, settings, title, onChange, onRemove }) {
  const buscas = briefingQueries(briefing, settings).length;
  return <div className="radar-editor">
    <div className="radar-editor-head">
      <h2>{title}</h2>
      <div className="radar-editor-tools">
        <label className="radar-switch">
          <input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={briefing.active !== false} onChange={e => onChange({ active: e.target.checked })} /> ativo no radar
        </label>
        <button className="ghost" onClick={onRemove}>Apagar</button>
      </div>
    </div>

    <div className="radar-form">
      <label>O que o cliente vende
        <textarea rows={2} defaultValue={briefing.business} onBlur={e => onChange({ business: e.target.value })}
          placeholder="Escola de programação e robótica para crianças e adolescentes." />
      </label>
      <ListField label="Palavras-chave de assuntos" hint="(é o que vai literalmente para a busca; separe por vírgula)"
        value={briefing.keywords} onChange={keywords => onChange({ keywords })}
        placeholder="robótica educacional, ensino de IA, futuro do trabalho" />
    </div>

    <p className="radar-note">
      Gera <b>{buscas}</b> busca(s) por varredura. Salva sozinho enquanto você edita.
    </p>
  </div>;
}
