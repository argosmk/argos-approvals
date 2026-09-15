import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { delta, formatLabel, generateReport, kindLabel, listReportAccounts, listSocialReports, num, periodLabel, temBaseParaComparar } from '../services/reportsService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import './reports.css';
import './reportsCompact.css';

export default function ReportsPanel({ companies = [] }) {
  const [reports,setReports]=useState([]); const [contas,setContas]=useState([]);
  const [cliente,setCliente]=useState(''); const [kind,setKind]=useState('weekly'); const [periodo,setPeriodo]=useState('');
  const [loading,setLoading]=useState(true); const [erro,setErro]=useState(null); const [gerando,setGerando]=useState(false); const [flash,setFlash]=useState(null);
  const nome=useCallback(id=>companies.find(c=>c.id===id)?.name||id||'Cliente',[companies]);
  const carregar=useCallback(async()=>{const [r,c]=await Promise.all([listSocialReports(),listReportAccounts().catch(()=>[])]);setReports(r);setContas(c);return r},[]);
  useEffect(()=>{let vivo=true;(async()=>{try{await carregar()}catch(e){if(vivo)setErro(e?.message||String(e))}finally{if(vivo)setLoading(false)}})();return()=>{vivo=false}},[carregar]);
  const clientes=useMemo(()=>[...new Set([...contas.map(c=>c.company_id),...reports.map(r=>r.company_id)].filter(Boolean))].map(id=>({id,label:nome(id)})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR')),[contas,reports,nome]);
  useEffect(()=>{if(!cliente&&clientes.length)setCliente(clientes[0].id)},[clientes,cliente]);
  const filtrados=useMemo(()=>reports.filter(r=>(!cliente||r.company_id===cliente)&&r.kind===kind),[reports,cliente,kind]);
  useEffect(()=>{if(filtrados.length&&!filtrados.some(r=>r.id===periodo))setPeriodo(filtrados[0].id);if(!filtrados.length)setPeriodo('')},[filtrados,periodo]);
  const atual=filtrados.find(r=>r.id===periodo)||null;
  const contaAtual=contas.find(c=>c.company_id===cliente)||null;
  async function gerar(){if(!contaAtual||gerando)return;setGerando(true);setFlash(null);try{await generateReport(contaAtual.account_id,kind);await carregar();setFlash({ok:true,text:'Relatório atualizado.'})}catch(e){setFlash({ok:false,text:e?.message||String(e)})}finally{setGerando(false)}}
  return <section className="panel-page rep">
    <header className="rep-head"><h1>Relatórios<span className="rep-beta">beta</span></h1></header>
    {loading&&<p className="rep-note">Carregando…</p>}{erro&&<div className="rep-empty"><h3>Não consegui carregar</h3><p>{erro}</p></div>}
    {!loading&&!erro&&<>
      <div className="rep-compact-nav">
        <select value={cliente} onChange={e=>setCliente(e.target.value)} aria-label="Cliente">{clientes.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <div className="rep-kind-toggle"><button className={kind==='weekly'?'is-on':''} onClick={()=>setKind('weekly')}>Semanal</button><button className={kind==='monthly'?'is-on':''} onClick={()=>setKind('monthly')}>Mensal</button></div>
        <select className="rep-period" value={periodo} onChange={e=>setPeriodo(e.target.value)} aria-label="Período">{filtrados.map(r=><option key={r.id} value={r.id}>{periodLabel(r.period_start,r.period_end)}</option>)}</select>
        <span className="rep-nav-spacer"/><button className="rep-generate" onClick={gerar} disabled={!contaAtual||gerando}>{gerando?'Gerando…':'Gerar relatório'}</button>
      </div>
      {flash&&<p className={`rep-flash${flash.ok?'':' is-error'}`}>{flash.text}</p>}
      {!atual?<div className="rep-empty"><h3>Nenhum relatório neste período.</h3><p>{isSupabaseConfigured?'Gere um relatório quando houver posts publicados.':'O ambiente local não possui relatórios do banco.'}</p></div>:<CompactReport report={atual} cliente={nome(atual.company_id)}/>} 
    </>}
  </section>
}

function CompactReport({report,cliente}){
  const n=report.numbers||{}, r=n.resumo||{}, prev=n.semana_anterior||{};
  const metrics=[['Posts',r.posts,prev.posts],['Views',r.views,prev.views],['Alcance',r.alcance,prev.alcance],['Interações',r.interacoes,null],['Seguidores',r.seguidores_ganhos,prev.seguidores_ganhos],['Visitas ao perfil',r.visitas_perfil,null]];
  const paragraphs=String(report.narrative||'').split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).slice(0,3);
  const actions=(Array.isArray(report.actions)?report.actions:[]).slice(0,3);
  const best=(Array.isArray(n.melhores)?n.melhores:[])[0]||null;
  return <div className="rep-compact-body">
    <div className="rep-compact-meta"><div><h2>{cliente}</h2><p>{kindLabel(report.kind)} · {periodLabel(report.period_start,report.period_end)}{n.conta?` · @${n.conta}`:''}</p></div></div>
    <div className="rep-kpis-compact">{metrics.map(([label,value,old])=><Metric key={label} label={label} value={value} old={old}/>)}</div>
    {!temBaseParaComparar(n)&&<p className="rep-sample">Amostra baixa: {num(r.posts)} post(s). Use os números como registro, não como tendência.</p>}
    <div className="rep-compact-grid">
      <section className="rep-compact-card"><h3>O que aconteceu</h3>{paragraphs.length?<ul className="rep-insights">{paragraphs.map((p,i)=><li key={i}>{p}</li>)}</ul>:<p className="rep-note">Ainda não há leitura suficiente para este período.</p>}</section>
      <section className="rep-compact-card"><h3>O que fazer na próxima pauta</h3>{actions.length?<ol className="rep-next">{actions.map((a,i)=><li key={i}>{String(a)}</li>)}</ol>:<p className="rep-note">Sem recomendação confiável ainda.</p>}</section>
    </div>
    {best&&<section className="rep-compact-card"><h3>Conteúdo que mais se destacou</h3><div className="rep-best"><div><a href={best.permalink} target="_blank" rel="noreferrer">{formatLabel(best.formato)}{best.pilar?` · ${best.pilar}`:''}</a><small>{num(best.views)} views · {num(best.alcance)} alcançados{best.alcance_relativo!=null?` · ${num(best.alcance_relativo,2)}× a mediana`:''}</small></div>{best.indice!=null&&<div className="rep-best-score">{num(best.indice,1)}</div>}</div></section>}
  </div>
}
function Metric({label,value,old}){const d=delta(value,old);return <div className="rep-kpi-compact"><span>{label}</span><b>{num(value)}</b>{d&&d.dir!=='flat'&&<i className={d.dir}>{d.dir==='up'?'↑':'↓'} {num(d.abs)}</i>}</div>}
