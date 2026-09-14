from pathlib import Path
import re

components = Path('src/components')
components.mkdir(parents=True, exist_ok=True)

Path('src/components/PanelHeader.jsx').write_text("""import React from 'react';
import './panelHeader.css';

/**
 * PADRÃO OFICIAL DE CABEÇALHO DO ARGOS FLOW
 *
 * Todo painel de primeiro nível deve usar <PanelHeader />.
 * Não criar <h1>, <header> ou CSS próprio para o topo de um painel novo.
 * Título, linha divisória, abas, selo e ações devem passar por este componente.
 * Se o padrão visual mudar, altere este componente/CSS em vez de corrigir painel por painel.
 */
export default function PanelHeader({ title, badge = '', tabs = [], active, onChange = () => {}, actions = null, className = '' }) {
  return <div className={`panel-header-block argos-standard-header ${className}`.trim()}>
    <div className=\"panel-tabs-header\">
      <div className=\"panel-tabs-heading\">
        <h1>{title}{badge ? <span className=\"panel-header-badge\">{badge}</span> : null}</h1>
        {tabs.length > 0 && <div className=\"panel-tabs\" role=\"tablist\">{tabs.map(([id,label]) => {
          const selected = active === id;
          return <span key={id} role=\"tab\" tabIndex={0} aria-selected={selected} aria-current={selected ? 'page' : undefined} className={`panel-tab-link ${selected ? 'active' : ''}`.trim()} onClick={() => onChange(id)} onKeyDown={event => { if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); onChange(id); } }}>{label}</span>;
        })}</div>}
      </div>
    </div>
    {actions ? <div className=\"panel-header-tools\">{actions}</div> : null}
  </div>;
}
""", encoding='utf-8')

Path('src/components/panelHeader.css').write_text("""/*
 * PADRÃO OFICIAL DE CABEÇALHOS DO ARGOS FLOW.
 * Todo painel de primeiro nível usa .argos-standard-header via <PanelHeader />.
 * Não criar geometria de cabeçalho específica em CSS de painel.
 */
.main .panel-header-block.argos-standard-header{display:block!important;width:100%!important;min-height:0!important;height:auto!important;margin:0 0 18px!important;padding:0!important;border:0!important;background:transparent!important;box-sizing:border-box!important}
.main .panel-header-block.argos-standard-header>.panel-tabs-header{display:block!important;width:100%!important;min-height:0!important;height:auto!important;margin:0!important;padding:0!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.09)!important;box-sizing:border-box!important}
.main .panel-header-block.argos-standard-header .panel-tabs-heading{display:grid!important;grid-template-columns:240px minmax(0,1fr)!important;align-items:end!important;column-gap:34px!important;row-gap:10px!important;width:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important}
.main .panel-header-block.argos-standard-header .panel-tabs-heading>h1{display:block!important;width:240px!important;min-width:240px!important;max-width:240px!important;min-height:0!important;height:auto!important;margin:0!important;padding:0 0 9px!important;font-size:20px!important;line-height:1.15!important;font-weight:750!important;letter-spacing:0!important;white-space:nowrap!important;box-sizing:border-box!important}
.main .panel-header-block.argos-standard-header .panel-tabs{display:flex!important;justify-content:flex-start!important;align-items:flex-end!important;gap:24px!important;min-width:0!important;width:100%!important;margin:0!important;padding:0!important}
.main .panel-header-block.argos-standard-header .panel-tab-link{margin:0!important;padding:0 0 9px!important}
.main .panel-header-block.argos-standard-header .panel-header-tools{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:12px!important;flex-wrap:wrap!important;width:100%!important;margin:10px 0 0!important;padding:0!important}
.main .panel-header-block.argos-standard-header .panel-header-tools>*{margin:0!important}
.main .panel-header-block.argos-standard-header .panel-header-badge{display:inline-block!important;margin-left:8px!important;padding:3px 8px!important;border:1px solid var(--line-gold)!important;border-radius:999px!important;color:var(--gold)!important;background:rgba(var(--accent-rgb),.08)!important;font-size:10px!important;line-height:1.2!important;font-weight:800!important;letter-spacing:.12em!important;text-transform:uppercase!important;vertical-align:2px!important}
@media(max-width:980px){.main .panel-header-block.argos-standard-header .panel-tabs-heading{grid-template-columns:220px minmax(0,1fr)!important;column-gap:26px!important}.main .panel-header-block.argos-standard-header .panel-tabs-heading>h1{width:220px!important;min-width:220px!important;max-width:220px!important}}
@media(max-width:760px){.main .panel-header-block.argos-standard-header .panel-tabs-heading{grid-template-columns:1fr!important;row-gap:12px!important}.main .panel-header-block.argos-standard-header .panel-tabs-heading>h1{width:100%!important;min-width:0!important;max-width:none!important;padding-bottom:8px!important}.main .panel-header-block.argos-standard-header .panel-tabs{gap:20px!important;overflow-x:auto!important;padding-bottom:2px!important;flex-wrap:nowrap!important}.main .panel-header-block.argos-standard-header .panel-header-tools{margin-top:12px!important}}
""", encoding='utf-8')

main = Path('src/main.jsx')
s = main.read_text(encoding='utf-8')
if "import PanelHeader from './components/PanelHeader';" not in s:
    s = s.replace("import './style.css';", "import './style.css';\nimport PanelHeader from './components/PanelHeader';", 1)
s, n = re.subn(r"function PanelTabsHeader\(\{title,tabs=\[\],active,onChange,actions=null,className=''\}\)\{.*?\n\}\n\nfunction Dashboard", "function Dashboard", s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('PanelTabsHeader anchor not found')
s = s.replace('<PanelTabsHeader', '<PanelHeader')
main.write_text(s, encoding='utf-8')

radar = Path('src/panels/RadarBetaPanel.jsx')
s = radar.read_text(encoding='utf-8')
if "import PanelHeader from '../components/PanelHeader';" not in s:
    s = s.replace("import './radarBeta.css';", "import PanelHeader from '../components/PanelHeader';\nimport './radarBeta.css';", 1)
s, n = re.subn(r'\s*<header className=\"radar-head\">\s*<h1>Radar de Pautas<span className=\"radar-beta\">beta</span></h1>\s*</header>', '\n    <PanelHeader title=\"Radar de Pautas\" badge=\"beta\"/>', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('Radar header anchor not found')
radar.write_text(s, encoding='utf-8')

reports = Path('src/panels/ReportsPanel.jsx')
s = reports.read_text(encoding='utf-8')
if "import PanelHeader from '../components/PanelHeader';" not in s:
    s = s.replace("import './reports.css';", "import PanelHeader from '../components/PanelHeader';\nimport './reports.css';", 1)
s, n = re.subn(r'\s*<header className=\"rep-head\">\s*<h1>Relatórios<span className=\"rep-beta\">beta</span></h1>\s*</header>', '\n    <PanelHeader title=\"Relatórios\" badge=\"beta\"/>', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('Reports header anchor not found')
reports.write_text(s, encoding='utf-8')

index = Path('index.html')
s = index.read_text(encoding='utf-8')
s = re.sub(r'<link[^>]+headerAlignment\.css[^>]*>', '', s)
index.write_text(s, encoding='utf-8')

legacy = Path('src/headerAlignment.css')
if legacy.exists():
    legacy.unlink()

radar_css = Path('src/panels/radarBeta.css')
s = radar_css.read_text(encoding='utf-8')
s = re.sub(r'/\* cabeçalho.*?\*/.*?(?=/\* barra de filtros \*/)', '', s, count=1, flags=re.S)
s = re.sub(r'\n/\* HEADER ROOT FIX 2026-09-14 \*/.*?$', '\n', s, count=1, flags=re.S)
radar_css.write_text(s, encoding='utf-8')

reports_css = Path('src/panels/reports.css')
s = reports_css.read_text(encoding='utf-8')
s = re.sub(r'/\* ---------------------------------------------------------------- \*/\n/\* cabeçalho.*?(?=/\* ---------------------------------------------------------------- \*/\n/\* barra de comando)', '', s, count=1, flags=re.S)
reports_css.write_text(s, encoding='utf-8')
