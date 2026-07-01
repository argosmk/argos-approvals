import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { loadWorkspaceState, saveWorkspaceState } from './services/workspaceStateService';


const ARGOS_UI_POLISH_CSS = `
.task-topbar-split{display:grid;grid-template-columns:auto minmax(260px,1fr);align-items:center;gap:12px;margin-bottom:12px;}
.task-topbar-split .task-nav-actions{justify-self:end;display:flex;gap:8px;flex-wrap:wrap;}
.task-topbar-split .task-nav-actions button{white-space:nowrap;}
.status-visibility-list{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:7px!important;margin-top:8px!important;max-height:none!important;overflow:visible!important;padding:0!important;border:0!important;background:transparent!important;}
.status-visibility-list label.status-visibility-item{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;width:100%!important;min-width:0!important;max-width:280px!important;min-height:0!important;height:auto!important;margin:0!important;padding:3px 0!important;border:0!important;border-radius:0!important;background:transparent!important;text-align:left!important;box-shadow:none!important;}
.status-visibility-list label.status-visibility-item input{appearance:auto!important;-webkit-appearance:auto!important;width:14px!important;height:14px!important;min-width:14px!important;flex:0 0 14px!important;margin:0!important;position:static!important;display:inline-block!important;}
.status-visibility-list label.status-visibility-item .status-dot{width:8px!important;height:8px!important;border-radius:50%!important;flex:0 0 8px!important;display:inline-block!important;margin:0!important;}
.status-visibility-list label.status-visibility-item .status-name{font-weight:500!important;font-size:13px!important;line-height:1.2!important;margin:0!important;display:inline!important;}
.instruction-box{white-space:pre-wrap!important;word-break:break-word!important;line-height:1.55!important;}

/* Round 38: busca respeita permissões e mídia tenta ocupar só a dimensão real */
.media-box.adaptive-media-box{display:flex!important;justify-content:center!important;align-items:center!important;background:transparent!important;overflow:visible!important;height:auto!important;min-height:0!important;max-height:none!important;}
.media-box.adaptive-media-box .media-inner{display:flex!important;justify-content:center!important;align-items:center!important;width:auto!important;max-width:100%!important;height:auto!important;min-height:0!important;background:transparent!important;overflow:visible!important;}
.media-box.adaptive-media-box .media-inner img,
.media-box.adaptive-media-box .media-inner video{display:block!important;width:auto!important;max-width:100%!important;height:auto!important;max-height:72vh!important;object-fit:contain!important;background:transparent!important;}
.media-box.adaptive-media-box .media-inner iframe{width:min(100%,720px)!important;min-height:520px!important;max-height:72vh!important;border:0!important;}
@media (max-width: 760px){
  .media-box.adaptive-media-box .media-inner img,
  .media-box.adaptive-media-box .media-inner video{max-height:68vh!important;}
  .media-box.adaptive-media-box .media-inner iframe{min-height:420px!important;max-height:68vh!important;}
}


/* Round 37: força status visíveis compactos, mesmo contra CSS antigo */
.modal .status-visibility-list,
.status-visibility-list{
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  justify-content:flex-start!important;
  gap:6px!important;
  margin:8px 0 0!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  max-height:none!important;
  overflow:visible!important;
}
.modal .status-visibility-list .status-visibility-item,
.status-visibility-list .status-visibility-item{
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:8px!important;
  width:auto!important;
  max-width:none!important;
  min-width:0!important;
  height:auto!important;
  min-height:0!important;
  margin:0!important;
  padding:2px 0!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  text-align:left!important;
  line-height:1.2!important;
}
.modal .status-visibility-list .status-visibility-item input,
.status-visibility-list .status-visibility-item input{
  appearance:auto!important;
  -webkit-appearance:auto!important;
  display:inline-block!important;
  position:static!important;
  width:14px!important;
  height:14px!important;
  min-width:14px!important;
  max-width:14px!important;
  margin:0!important;
  padding:0!important;
  flex:0 0 14px!important;
}
.modal .status-visibility-list .status-visibility-item .status-dot,
.status-visibility-list .status-visibility-item .status-dot{
  display:inline-block!important;
  width:8px!important;
  height:8px!important;
  min-width:8px!important;
  border-radius:50%!important;
  flex:0 0 8px!important;
  margin:0!important;
}
.modal .status-visibility-list .status-visibility-item .status-name,
.status-visibility-list .status-visibility-item .status-name{
  display:inline-block!important;
  font-size:13px!important;
  font-weight:500!important;
  line-height:1.2!important;
  margin:0!important;
  padding:0!important;
  white-space:nowrap!important;
}
@media (max-width: 1100px){
  .task-topbar-split{display:flex!important;align-items:center!important;gap:8px!important;margin-bottom:10px!important;position:sticky;top:0;z-index:5;background:rgba(0,0,0,.94);padding:8px 0;}
  .task-topbar-split>button{flex:0 0 auto!important;}
  .task-topbar-split .task-nav-actions{margin-left:auto!important;justify-self:auto!important;display:flex!important;gap:6px!important;flex-wrap:nowrap!important;}
  .task-topbar-split .task-nav-actions button{font-size:12px!important;padding:8px 9px!important;white-space:nowrap!important;}
  .task-page{display:flex!important;flex-direction:column!important;gap:14px!important;align-items:stretch!important;}
  .task-left,.task-side{width:100%!important;max-width:none!important;min-width:0!important;display:flex!important;flex-direction:column!important;gap:14px!important;align-self:stretch!important;}
  .task-side>.panel,.task-left>.panel,.content-fields{width:100%!important;max-width:none!important;box-sizing:border-box!important;}
  .comments-panel{order:1!important;}
  .panel-actions{order:2!important;}
  .panel-config{order:3!important;}
  .panel-stats{order:4!important;}
  .content-fields{display:flex!important;flex-direction:column!important;}
  .status-action-row{display:flex!important;flex-direction:column!important;align-items:stretch!important;width:100%!important;}
  .status-action-row button{width:100%!important;}
}

@media (max-width: 1100px){
  .task-page{display:flex!important;flex-direction:column!important;gap:14px!important;align-items:stretch!important;}
  .task-page .task-left,
  .task-page .task-side{display:contents!important;}
  .task-page .task-title{order:1!important;width:100%!important;box-sizing:border-box!important;}
  .task-page .panel-config{order:2!important;width:100%!important;box-sizing:border-box!important;}
  .task-page .insta{order:3!important;width:100%!important;box-sizing:border-box!important;}
  .task-page .content-fields{order:4!important;width:100%!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;gap:12px!important;}
  .task-page .comments-panel{order:5!important;width:100%!important;box-sizing:border-box!important;}
  .task-page .panel-actions{order:6!important;width:100%!important;box-sizing:border-box!important;}
  .task-page .panel-stats{order:7!important;width:100%!important;box-sizing:border-box!important;}
  .task-page .panel{max-width:none!important;}
  .task-topbar-split{display:flex!important;align-items:center!important;gap:8px!important;margin-bottom:10px!important;position:sticky;top:0;z-index:8;background:rgba(0,0,0,.96);padding:8px 0;}
  .task-topbar-split>button{flex:0 0 auto!important;}
  .task-topbar-split .task-nav-actions{margin-left:auto!important;display:flex!important;gap:6px!important;justify-content:flex-end!important;flex:1 1 auto!important;min-width:0!important;}
  .task-topbar-split .task-nav-actions button{font-size:12px!important;padding:8px 8px!important;white-space:nowrap!important;}
}


/* Round 39: ajustes finais de tarefa e status compactos */
.argos-status-pick-list{display:flex!important;flex-direction:column!important;gap:8px!important;margin:8px 0 0!important;padding:0!important;border:0!important;background:transparent!important;align-items:flex-start!important;}
.argos-status-pick-item{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;text-align:left!important;}
.argos-status-pick-item input{appearance:auto!important;-webkit-appearance:auto!important;display:inline-block!important;position:static!important;width:14px!important;height:14px!important;min-width:14px!important;max-width:14px!important;margin:0!important;padding:0!important;flex:0 0 14px!important;transform:none!important;}
.argos-status-pick-dot{width:8px!important;height:8px!important;min-width:8px!important;border-radius:50%!important;display:inline-block!important;flex:0 0 8px!important;margin:0!important;}
.argos-status-pick-name{font-size:13px!important;font-weight:500!important;line-height:1.2!important;white-space:nowrap!important;margin:0!important;padding:0!important;}
.task-title-input{width:100%!important;max-width:100%!important;font-size:28px!important;font-weight:800!important;line-height:1.15!important;background:transparent!important;color:inherit!important;border:1px solid transparent!important;border-radius:10px!important;padding:6px 8px!important;margin:0!important;box-sizing:border-box!important;}
.task-title-input:focus{border-color:rgba(225,177,44,.55)!important;background:rgba(255,255,255,.03)!important;outline:none!important;}
.task-title{display:flex!important;align-items:center!important;gap:12px!important;}
.task-title h1{margin:0!important;}
.panel-config label{display:block!important;width:100%!important;box-sizing:border-box!important;margin-bottom:10px!important;}
.panel-config input,.panel-config select,.panel-config textarea{width:100%!important;box-sizing:border-box!important;min-height:42px!important;text-align:left!important;}
.panel-config .select-entity,.panel-config .status-select{display:grid!important;grid-template-columns:minmax(150px,220px) 1fr!important;align-items:center!important;width:100%!important;gap:0!important;box-sizing:border-box!important;min-height:42px!important;}
.panel-config .select-entity select,.panel-config .status-select select{width:100%!important;min-width:0!important;}
.panel-config .entity-label{min-width:0!important;overflow:hidden!important;white-space:nowrap!important;}
@media (max-width:760px){
  .task-title{align-items:flex-start!important;flex-direction:column!important;}
  .task-title-input{font-size:30px!important;padding-left:0!important;}
  .panel-config .select-entity,.panel-config .status-select{grid-template-columns:1fr!important;}
  .panel-config .entity-label{border-bottom:1px solid rgba(255,255,255,.08)!important;padding-bottom:8px!important;margin-bottom:8px!important;}
}



/* Round 51: marca limpa e ações de risco dentro do modal */
.side .brand.brand-logo-only{display:flex!important;align-items:center!important;justify-content:center!important;padding:8px 0 14px!important;margin:0 0 12px!important;border-bottom:1px solid rgba(255,255,255,.08)!important;gap:0!important;}
.side .brand.brand-logo-only small{display:none!important;}
.side .brand.brand-logo-only .brand-logo{width:86px!important;height:52px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:visible!important;}
.side .brand.brand-logo-only .brand-logo img{width:100%!important;height:100%!important;object-fit:contain!important;display:block!important;}
.settings-toolbar{display:flex!important;gap:10px!important;align-items:end!important;flex-wrap:wrap!important;justify-content:flex-end!important;}
.toggle-archived{display:flex!important;align-items:center!important;gap:8px!important;width:auto!important;min-width:auto!important;margin:0!important;white-space:nowrap!important;}
.toggle-archived input{width:15px!important;height:15px!important;margin:0!important;}
.archived-card{opacity:.58!important;filter:saturate(.6)!important;}
.danger-zone{margin-top:18px!important;padding:14px!important;border:1px solid rgba(255,80,80,.35)!important;border-radius:14px!important;background:rgba(255,80,80,.05)!important;}
.danger-zone h3{margin:0 0 6px!important;color:#ff6b6b!important;}
.danger-zone p{margin:0 0 12px!important;color:#b8ad9a!important;font-size:13px!important;}
.danger-zone-actions{display:flex!important;gap:10px!important;flex-wrap:wrap!important;}
.danger-button{border-color:#ff4d4f!important;color:#ff6b6b!important;background:rgba(255,77,79,.06)!important;}
@media (max-width:760px){
  .side .brand.brand-logo-only .brand-logo{width:74px!important;height:44px!important;}
  .settings-toolbar{justify-content:flex-start!important;align-items:stretch!important;width:100%!important;}
  .settings-toolbar > *{max-width:100%!important;}
  .settings-toolbar label:not(.toggle-archived){flex:1 1 160px!important;}
  .settings-toolbar .primary{flex:1 1 160px!important;}
  .toggle-archived{flex:1 1 100%!important;}
  .row-actions{display:flex!important;gap:8px!important;flex-wrap:wrap!important;}
  .row-actions button{flex:0 1 auto!important;}
  .login .login-logo-big{width:128px!important;height:96px!important;margin-bottom:18px!important;border:0!important;background:transparent!important;}
  .login .login-logo-big img{width:100%!important;height:100%!important;object-fit:contain!important;}
}
`;
if (typeof document !== 'undefined') {
  let style = document.getElementById('argos-ui-polish');
  if (!style) {
    style = document.createElement('style');
    style.id = 'argos-ui-polish';
    document.head.appendChild(style);
  }
  style.textContent = ARGOS_UI_POLISH_CSS;
}


const ARGOS_ROUND40_FIX_CSS = `
/* Round 40: compactação real dos checkboxes e correção responsiva */
.arg-vs-list-v2{display:grid!important;grid-template-columns:1fr!important;gap:5px!important;margin:6px 0 0!important;padding:0!important;border:0!important;background:transparent!important;max-height:none!important;overflow:visible!important;align-items:start!important;justify-items:start!important;}
.arg-vs-row-v2{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;width:auto!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:2px 0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;text-align:left!important;line-height:1.15!important;}
.arg-vs-row-v2 input{appearance:auto!important;-webkit-appearance:auto!important;width:13px!important;height:13px!important;min-width:13px!important;max-width:13px!important;flex:0 0 13px!important;margin:0!important;padding:0!important;position:static!important;display:inline-block!important;transform:none!important;}
.arg-vs-dot-v2{width:8px!important;height:8px!important;min-width:8px!important;max-width:8px!important;border-radius:50%!important;display:inline-block!important;flex:0 0 8px!important;margin:0!important;padding:0!important;}
.arg-vs-name-v2{font-size:13px!important;font-weight:600!important;line-height:1.15!important;white-space:nowrap!important;margin:0!important;padding:0!important;}
.arg-linked-company-list-v2{display:grid!important;grid-template-columns:1fr!important;gap:6px!important;margin-top:6px!important;}
.arg-linked-company-row-v2{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:4px 0!important;border:0!important;background:transparent!important;box-shadow:none!important;}
.arg-linked-company-row-v2 input{appearance:auto!important;-webkit-appearance:auto!important;width:13px!important;height:13px!important;min-width:13px!important;flex:0 0 13px!important;margin:0!important;}
.arg-linked-company-row-v2 .avatar-mini{width:22px!important;height:22px!important;min-width:22px!important;font-size:10px!important;}
.arg-linked-company-row-v2 span:last-child{font-size:13px!important;font-weight:600!important;}
.settings-toolbar{display:flex!important;gap:12px!important;align-items:end!important;flex-wrap:wrap!important;justify-content:flex-end!important;}
.panel-config label{margin-bottom:6px!important;}
.panel-config label>input,.panel-config label>select{min-height:40px!important;padding-top:8px!important;padding-bottom:8px!important;}
.panel-config .select-entity,.panel-config .status-select{min-height:40px!important;grid-template-columns:minmax(135px,200px) 1fr!important;}
.panel-config .entity-label{padding:0 10px!important;min-height:40px!important;display:flex!important;align-items:center!important;gap:8px!important;}
.panel-config .entity-label .avatar-mini{width:24px!important;height:24px!important;min-width:24px!important;}
.insta{width:fit-content!important;max-width:100%!important;align-self:center!important;}
.insta .insta-top,.insta .insta-icons,.insta .insta-caption{box-sizing:border-box!important;}
.media-box.adaptive-media-box{width:auto!important;max-width:100%!important;background:#000!important;}
.media-box.adaptive-media-box .media-inner{width:auto!important;max-width:100%!important;background:#000!important;}
.media-box.adaptive-media-box .media-inner img.media-fit-image,
.media-box.adaptive-media-box .media-inner video.media-fit-image{display:block!important;width:auto!important;max-width:min(100%,560px)!important;height:auto!important;max-height:72vh!important;object-fit:contain!important;margin:0 auto!important;background:#000!important;}
.media-box.adaptive-media-box .drive-fallback-frame{width:min(100%,560px)!important;min-height:520px!important;border:0!important;background:#000!important;}
@media (max-width:760px){
  .settings-toolbar{justify-content:stretch!important;align-items:stretch!important;}
  .settings-toolbar label,.settings-toolbar button{width:100%!important;}
  .panel-config{padding:14px!important;}
  .panel-config label{margin-bottom:7px!important;}
  .panel-config .select-entity,.panel-config .status-select{grid-template-columns:minmax(108px,38%) 1fr!important;min-height:42px!important;}
  .panel-config .entity-label{border-bottom:0!important;margin-bottom:0!important;padding:0 8px!important;min-height:42px!important;}
  .panel-config .entity-label span:not(.avatar-mini){font-size:13px!important;overflow:hidden!important;text-overflow:ellipsis!important;}
  .panel-config input,.panel-config select{font-size:14px!important;min-height:42px!important;}
  .media-box.adaptive-media-box .media-inner img.media-fit-image,
  .media-box.adaptive-media-box .media-inner video.media-fit-image{max-width:100%!important;max-height:68vh!important;}
}
`;
if (typeof document !== 'undefined') {
  let style2 = document.getElementById('argos-round40-fix');
  if (!style2) {
    style2 = document.createElement('style');
    style2.id = 'argos-round40-fix';
    document.head.appendChild(style2);
  }
  style2.textContent = ARGOS_ROUND40_FIX_CSS;
}


const ARGOS_ROUND41_STABILITY_CSS = `
/* Round 41: restaura estabilidade visual e isola listas compactas */
.arg-vs-list-v2,
.modal .arg-vs-list-v2,
.arg-linked-company-list-v2,
.modal .arg-linked-company-list-v2{
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  justify-items:start!important;
  justify-content:flex-start!important;
  gap:6px!important;
  margin:6px 0 0!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  width:auto!important;
  max-width:360px!important;
  max-height:none!important;
  overflow:visible!important;
}
.arg-vs-row-v2,
.modal .arg-vs-row-v2,
.arg-linked-company-row-v2,
.modal .arg-linked-company-row-v2{
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:7px!important;
  width:auto!important;
  min-width:0!important;
  max-width:100%!important;
  height:auto!important;
  min-height:0!important;
  margin:0!important;
  padding:2px 0!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  text-align:left!important;
  line-height:1.2!important;
}
.arg-vs-row-v2 input,
.modal .arg-vs-row-v2 input,
.arg-linked-company-row-v2 input,
.modal .arg-linked-company-row-v2 input{
  appearance:auto!important;
  -webkit-appearance:auto!important;
  position:static!important;
  display:inline-block!important;
  width:13px!important;
  height:13px!important;
  min-width:13px!important;
  max-width:13px!important;
  flex:0 0 13px!important;
  margin:0!important;
  padding:0!important;
  transform:none!important;
}
.arg-vs-dot-v2,
.modal .arg-vs-dot-v2{width:8px!important;height:8px!important;min-width:8px!important;border-radius:50%!important;display:inline-block!important;flex:0 0 8px!important;margin:0!important;}
.arg-vs-name-v2,
.modal .arg-vs-name-v2,
.arg-linked-company-row-v2 span:last-child,
.modal .arg-linked-company-row-v2 span:last-child{font-size:13px!important;font-weight:600!important;line-height:1.2!important;white-space:nowrap!important;margin:0!important;padding:0!important;}
.arg-linked-company-row-v2 .avatar-mini{width:20px!important;height:20px!important;min-width:20px!important;font-size:10px!important;}
.settings-toolbar{display:flex!important;gap:12px!important;align-items:end!important;justify-content:flex-end!important;flex-wrap:wrap!important;}
.settings-toolbar label{width:auto!important;min-width:170px!important;}
/* Configurações da tarefa: mantém alinhamento sem quebrar mobile */
.panel-config{overflow:visible!important;}
.panel-config label{margin-bottom:8px!important;}
.panel-config label>input,.panel-config label>select{min-height:42px!important;}
.panel-config .select-entity,.panel-config .status-select{display:grid!important;grid-template-columns:minmax(150px,230px) 1fr!important;align-items:center!important;width:100%!important;min-height:42px!important;box-sizing:border-box!important;}
.panel-config .entity-label{display:flex!important;align-items:center!important;gap:8px!important;min-height:42px!important;padding:0 10px!important;min-width:0!important;overflow:hidden!important;}
.panel-config .entity-label span:not(.avatar-mini){overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
.panel-config select{min-width:0!important;text-align:left!important;}
/* Preview estável: sem mini-card quando não há material, sem iframe/margem extra */
.insta{width:min(100%,520px)!important;max-width:520px!important;align-self:center!important;overflow:hidden!important;}
.insta .insta-top,.insta .insta-icons,.insta .insta-caption{width:100%!important;box-sizing:border-box!important;}
.media-box.adaptive-media-box{width:100%!important;min-height:320px!important;background:#151515!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;}
.media-box.adaptive-media-box .media-inner{width:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#151515!important;}
.media-box.adaptive-media-box .media-inner img.media-fit-image,
.media-box.adaptive-media-box .media-inner video.media-fit-image{display:block!important;width:100%!important;height:auto!important;max-height:none!important;object-fit:contain!important;margin:0!important;background:#151515!important;}
.media-box.adaptive-media-box .empty-media{width:100%!important;min-height:320px!important;display:flex!important;align-items:center!important;justify-content:center!important;color:rgba(255,255,255,.75)!important;}
.media-box.adaptive-media-box .drive-fallback-frame{width:100%!important;min-height:520px!important;border:0!important;background:#151515!important;}
@media (max-width:760px){
  .settings-toolbar{justify-content:stretch!important;align-items:stretch!important;}
  .settings-toolbar label,.settings-toolbar button{width:100%!important;min-width:0!important;}
  .panel-config{padding:14px!important;}
  .panel-config .select-entity,.panel-config .status-select{grid-template-columns:1fr!important;gap:0!important;}
  .panel-config .entity-label{border-bottom:1px solid rgba(255,255,255,.08)!important;margin:0!important;padding:0 8px!important;}
  .panel-config .select-entity select,.panel-config .status-select select{border-top-left-radius:0!important;border-top-right-radius:0!important;}
  .insta{width:100%!important;max-width:520px!important;}
  .media-box.adaptive-media-box{min-height:260px!important;}
  .media-box.adaptive-media-box .empty-media{min-height:260px!important;}
}
`;
if (typeof document !== 'undefined') {
  let style41 = document.getElementById('argos-round41-stability');
  if (!style41) {
    style41 = document.createElement('style');
    style41.id = 'argos-round41-stability';
    document.head.appendChild(style41);
  }
  style41.textContent = ARGOS_ROUND41_STABILITY_CSS;
}


const ARGOS_ROUND42_CLEAN_LAYOUT_CSS = `
/* Round 42: limpeza visual sem mexer em lógica */
/* Listas de seleção compactas em usuários/clientes */
.modal .arg-vs-list-v2,
.modal .arg-linked-company-list-v2,
.arg-vs-list-v2,
.arg-linked-company-list-v2{
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  justify-content:flex-start!important;
  gap:3px!important;
  margin:4px 0 10px!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  width:auto!important;
  max-width:420px!important;
  overflow:visible!important;
}
.modal .arg-vs-row-v2,
.modal .arg-linked-company-row-v2,
.arg-vs-row-v2,
.arg-linked-company-row-v2{
  display:inline-flex!important;
  flex-direction:row!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:7px!important;
  width:auto!important;
  max-width:none!important;
  min-width:0!important;
  height:22px!important;
  min-height:22px!important;
  max-height:22px!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  text-align:left!important;
  line-height:1!important;
}
.modal .arg-vs-row-v2 input,
.modal .arg-linked-company-row-v2 input,
.arg-vs-row-v2 input,
.arg-linked-company-row-v2 input{
  appearance:auto!important;
  -webkit-appearance:auto!important;
  position:static!important;
  display:inline-block!important;
  width:13px!important;
  height:13px!important;
  min-width:13px!important;
  max-width:13px!important;
  flex:0 0 13px!important;
  margin:0!important;
  padding:0!important;
  transform:none!important;
}
.modal .arg-vs-dot-v2,
.arg-vs-dot-v2{width:8px!important;height:8px!important;min-width:8px!important;max-width:8px!important;border-radius:999px!important;display:inline-block!important;flex:0 0 8px!important;margin:0!important;padding:0!important;}
.modal .arg-vs-name-v2,
.arg-vs-name-v2,
.modal .arg-linked-company-row-v2 span:last-child,
.arg-linked-company-row-v2 span:last-child{font-size:13px!important;font-weight:600!important;line-height:1!important;white-space:nowrap!important;margin:0!important;padding:0!important;}
.modal .arg-linked-company-row-v2 .avatar-mini,
.arg-linked-company-row-v2 .avatar-mini{width:20px!important;height:20px!important;min-width:20px!important;font-size:10px!important;}
/* Configurações da tarefa: avatar/bolinha compactos à esquerda, select com texto alinhado */
.panel-config{box-sizing:border-box!important;}
.panel-config label{display:block!important;margin:0 0 8px!important;}
.panel-config label>input,
.panel-config label>select,
.panel-config .select-entity,
.panel-config .status-select{width:100%!important;box-sizing:border-box!important;min-height:42px!important;height:42px!important;}
.panel-config .select-entity,
.panel-config .status-select{
  display:grid!important;
  grid-template-columns:42px minmax(0,1fr)!important;
  align-items:center!important;
  gap:0!important;
  padding:0!important;
  overflow:hidden!important;
}
.panel-config .entity-label{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  min-width:0!important;
  width:42px!important;
  height:42px!important;
  min-height:42px!important;
  padding:0!important;
  margin:0!important;
  border-right:1px solid rgba(255,255,255,.08)!important;
  border-bottom:0!important;
  overflow:hidden!important;
}
.panel-config .entity-label span:not(.avatar-mini){display:none!important;}
.panel-config .entity-label .avatar-mini{width:26px!important;height:26px!important;min-width:26px!important;font-size:10px!important;}
.panel-config .status-select>.status-dot{justify-self:center!important;align-self:center!important;margin:0!important;width:10px!important;height:10px!important;min-width:10px!important;}
.panel-config .select-entity select,
.panel-config .status-select select{
  width:100%!important;
  height:42px!important;
  min-height:42px!important;
  margin:0!important;
  padding:0 34px 0 12px!important;
  text-align:left!important;
  border:0!important;
  border-left:1px solid rgba(255,255,255,.08)!important;
  border-radius:0!important;
  background:transparent!important;
  line-height:42px!important;
}
.panel-config label>input{padding:0 12px!important;line-height:42px!important;}
/* Prévia do post: formato Instagram feed 4:5 */
.insta{width:min(100%,520px)!important;max-width:520px!important;align-self:center!important;overflow:hidden!important;}
.insta .insta-top,.insta .insta-icons,.insta .insta-caption{width:100%!important;box-sizing:border-box!important;}
.media-box.adaptive-media-box{
  width:100%!important;
  aspect-ratio:4/5!important;
  min-height:0!important;
  height:auto!important;
  background:#151515!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  overflow:hidden!important;
}
.media-box.adaptive-media-box .media-inner{width:100%!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#151515!important;}
.media-box.adaptive-media-box .media-inner img.media-fit-image,
.media-box.adaptive-media-box .media-inner video.media-fit-image{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;margin:0!important;background:#151515!important;display:block!important;}
.media-box.adaptive-media-box .empty-media{width:100%!important;height:100%!important;min-height:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:rgba(255,255,255,.72)!important;}
.media-box.adaptive-media-box .drive-fallback-frame{width:100%!important;height:100%!important;min-height:0!important;border:0!important;background:#151515!important;}
@media (max-width:760px){
  .panel-config{padding:14px!important;}
  .panel-config .select-entity,
  .panel-config .status-select{grid-template-columns:42px minmax(0,1fr)!important;height:42px!important;min-height:42px!important;}
  .panel-config .entity-label{border-bottom:0!important;margin:0!important;padding:0!important;height:42px!important;min-height:42px!important;}
  .panel-config .select-entity select,
  .panel-config .status-select select{border-radius:0!important;border-left:1px solid rgba(255,255,255,.08)!important;text-align:left!important;}
  .insta{width:100%!important;max-width:520px!important;}
}
`;
if (typeof document !== 'undefined') {
  let style42 = document.getElementById('argos-round42-clean-layout');
  if (!style42) {
    style42 = document.createElement('style');
    style42.id = 'argos-round42-clean-layout';
    document.head.appendChild(style42);
  }
  style42.textContent = ARGOS_ROUND42_CLEAN_LAYOUT_CSS;
}

const TASK_TYPES = ['Estático', 'Carrossel', 'Vídeo', 'Vídeo Inglês', 'Pacote de criativos', 'Outras demandas'];
const WEEK_DAYS = [
  { value:0, label:'Segunda' },
  { value:1, label:'Terça' },
  { value:2, label:'Quarta' },
  { value:3, label:'Quinta' },
  { value:4, label:'Sexta' },
  { value:5, label:'Sábado' },
  { value:6, label:'Domingo' },
];
const DEFAULT_STATUS = [
  { id:'criar', name:'Criar', color:'#9ca3af', active:true, final:false },
  { id:'copy', name:'Copy', color:'#3b82f6', active:true, final:false },
  { id:'edicao', name:'Edição', color:'#a855f7', active:true, final:false, timer:true },
  { id:'aguardando', name:'Aguardando', color:'#eab308', active:true, final:false },
  { id:'aprovacao', name:'Aprovação', color:'#f97316', active:true, final:false },
  { id:'alteracao', name:'Alteração', color:'#ef4444', active:true, final:false, timer:true },
  { id:'agendamento', name:'Agendamento', color:'#ec4899', active:true, final:true },
  { id:'pronto', name:'Pronto', color:'#22c55e', active:true, final:true },
];
const TEAM_DEFAULT = ['edicao','alteracao','aguardando'];
const CLIENT_DEFAULT = ['aguardando','aprovacao','agendamento'];
const NOTIFICATION_EVENTS = ['Comentário na tarefa','Nova tarefa atribuída','Mudança de responsável','Alteração de status','Aprovação do cliente','Solicitação de alteração','Prazo vencido','Prazo hoje','Tarefa reaberta'];
function wantsNotification(user, event, statusId){
  const prefs=user.notificationPrefs||NOTIFICATION_EVENTS;
  const statusPrefs=user.notificationStatusPrefs||{};
  if(!prefs.includes(event)) return false;
  if(event==='Alteração de status' && statusId) return (statusPrefs[statusId]??true);
  return true;
}

const seedCompanies = [
  { id:'smart', name:'SmartStore', instagram:'@smartstore', logo:'S', entryDate:'2026-06-01', active:true },
  { id:'rafa', name:'Rafael Sales', instagram:'@rafaelsales', logo:'R', entryDate:'2026-06-03', active:true },
  { id:'unik', name:'Unik Villas', instagram:'@unikvillas', logo:'U', entryDate:'2026-06-06', active:true },
];
const seedUsers = [
  { id:'admin', role:'admin', name:'Argos Admin', email:'admin@argos.local', password:'123456', active:true, avatar:'A', title:'Administrador', visibleStatuses:[] },
  { id:'admin2', role:'admin', name:'Jean Admin', email:'admin2@argos.local', password:'123456', active:true, avatar:'J', title:'Administrador', visibleStatuses:[] },
  { id:'ana', role:'team', name:'Ana Designer', email:'ana@argos.local', password:'123456', active:true, avatar:'AD', title:'Designer', visibleStatuses:TEAM_DEFAULT },
  { id:'lucas', role:'team', name:'Lucas Editor', email:'lucas@argos.local', password:'123456', active:true, avatar:'LE', title:'Editor', visibleStatuses:TEAM_DEFAULT },
  { id:'smart1', role:'client', name:'Marina Smart', email:'smart@cliente.local', password:'123456', active:true, avatar:'MS', companyIds:['smart'], visibleStatuses:CLIENT_DEFAULT },
  { id:'smart2', role:'client', name:'Bruno Smart', email:'bruno@cliente.local', password:'123456', active:true, avatar:'BS', companyIds:['smart'], visibleStatuses:CLIENT_DEFAULT },
  { id:'rafa1', role:'client', name:'Rafael Sales', email:'rafa@cliente.local', password:'123456', active:true, avatar:'RS', companyIds:['rafa'], visibleStatuses:CLIENT_DEFAULT },
  { id:'unik1', role:'client', name:'Unik Approval', email:'unik@cliente.local', password:'123456', active:true, avatar:'U', companyIds:['unik'], visibleStatuses:CLIENT_DEFAULT },
];
const rawTasks = [
  ['Post Produto | Mouse Gamer','smart','Estático','edicao','2026-06-25','2026-06-23','ana',0],
  ['Story | Setup RGB','smart','Carrossel','copy','2026-06-25','2026-06-24','ana',0],
  ['Oferta Junho','smart','Estático','aprovacao','2026-06-25','2026-06-24','lucas',1],
  ['Reels Resultado | Noiva','rafa','Vídeo','alteracao','2026-06-27','2026-06-25','lucas',2],
  ['Sales Magazine | Brilho','rafa','Estático','criar','2026-06-27','2026-06-24','ana',0],
  ['Carrossel | Perto da Disney','unik','Carrossel','copy','2026-06-29','2026-06-26','ana',0],
  ['Reels | Piscina','rafa','Vídeo Inglês','edicao','2026-06-25','2026-06-24','lucas',1],
  ['Pacote | Criativos Julho','smart','Pacote de criativos','aguardando','2026-06-25','2026-06-24','ana',1],
  ['Demanda | Ajuste Bio','unik','Outras demandas','agendamento','2026-06-30','2026-06-26','lucas',0],
  ['Post | Dica do Rafa','rafa','Estático','pronto','2026-06-25','2026-06-21','ana',0],
  ['Carrossel | 5 Motivos','smart','Carrossel','edicao','2026-06-25','2026-06-24','ana',0],
  ['Vídeo Inglês | Villa Tour','unik','Vídeo Inglês','aprovacao','2026-06-25','2026-06-23','lucas',1],
  ['Post | Última chamada','smart','Estático','alteracao','2026-06-25','2026-06-24','ana',3],
];


const EMPTY_CLOUD_STATE = {
  companies: [],
  users: [],
  statuses: DEFAULT_STATUS,
  tasks: [],
  notifications: [],
  system: { logo:'', title:'Painel de Aprovação' }
};
function initials(name){ return String(name||'A').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'A'; }
function profileToAppUser(profile, authUser){
  return {
    id: profile.id,
    role: profile.role,
    name: profile.display_name,
    email: authUser?.email || profile.username,
    username: profile.username,
    password: '',
    active: profile.active,
    avatar: profile.avatar_url || initials(profile.display_name),
    title: profile.title || (profile.role==='admin'?'Administrador':profile.role==='team'?'Equipe':'Cliente'),
    visibleStatuses: profile.visible_statuses || (profile.role==='team'?TEAM_DEFAULT:(profile.role==='client'?CLIENT_DEFAULT:[])),
    notificationPrefs: profile.notification_prefs?.events || NOTIFICATION_EVENTS,
    notificationStatusPrefs: profile.notification_prefs?.statuses || {},
    organizationId: profile.organization_id,
  };
}

function mergeProfileWithWorkspaceUser(profile, payload){
  const existing = (payload?.users||[]).find(u=>u.id===profile?.id) || {};
  const merged = {
    ...existing,
    ...profile,
    companyIds: profile?.companyIds || existing.companyIds || [],
    visibleStatuses: (profile?.visibleStatuses&&profile.visibleStatuses.length) ? profile.visibleStatuses : (existing.visibleStatuses || profile?.visibleStatuses || []),
    notificationPrefs: (profile?.notificationPrefs&&profile.notificationPrefs.length) ? profile.notificationPrefs : (existing.notificationPrefs || profile?.notificationPrefs || NOTIFICATION_EVENTS),
    notificationStatusPrefs: Object.keys(profile?.notificationStatusPrefs||{}).length ? profile.notificationStatusPrefs : (existing.notificationStatusPrefs || profile?.notificationStatusPrefs || {}),
    createdAt: existing.createdAt || profile?.createdAt || now(),
  };
  return merged;
}
async function createAuthBackedAppUser(draft){
  if(!isSupabaseConfigured) return draft;
  const payload={
    name: draft.name,
    email: draft.email,
    password: draft.password,
    role: draft.role,
    title: draft.title || '',
    active: draft.active ?? true,
    avatar: draft.avatar || '',
    companyIds: draft.companyIds || [],
    visibleStatuses: draft.visibleStatuses || [],
    notificationPrefs: draft.notificationPrefs || NOTIFICATION_EVENTS,
    notificationStatusPrefs: draft.notificationStatusPrefs || {},
  };
  const { data, error } = await supabase.functions.invoke('create-app-user', { body: payload });
  if(error) throw error;
  if(data?.error) throw new Error(data.error);
  if(!data?.user?.id) throw new Error('A função criou o usuário, mas não retornou o ID.');
  return {
    ...draft,
    ...data.user,
    email: data.user.email || draft.email,
    username: data.user.username || draft.email,
    password: '',
    companyIds: data.user.companyIds || draft.companyIds || [],
    visibleStatuses: data.user.visibleStatuses || draft.visibleStatuses || [],
    notificationPrefs: data.user.notificationPrefs || draft.notificationPrefs || NOTIFICATION_EVENTS,
    notificationStatusPrefs: data.user.notificationStatusPrefs || draft.notificationStatusPrefs || {},
    organizationId: data.user.organizationId || draft.organizationId,
    createdAt: draft.createdAt || now(),
  };
}
async function fetchCurrentProfile(session){
  if(!isSupabaseConfigured || !session?.user?.id) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if(error) throw error;
  return profileToAppUser(data, session.user);
}

const seedTasks = rawTasks.map((t,i)=>({
  id:'task'+(i+1), title:t[0], companyId:t[1], type:t[2], status:t[3], postDate:t[4], internalDate:t[5], responsibleId:t[6], alterationCount:t[7], archived:false,
  version:1, startedAt:null, totalEditSeconds: 600 + i*95, totalAlterSeconds: t[7]*420,
  copyInstructions:'Briefing para o copy, objetivo, tom, CTA e observações da produção.',
  editorInstructions:'Referências visuais, orientação de design, formatos e observações para edição.',
  copy:'Copy do post para aprovação quando necessário.',
  caption:'Legenda com quebras de linha preservadas.\n\nChamada principal aqui.\nCTA no final.',
  materialLinks:'',
  logs:[{id:'log'+i, user:'Argos Admin', userId:'admin', type:'log', visibility:'internal', at:new Date().toISOString(), text:'Tarefa criada.'}]
}));

function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function now(){ return new Date().toISOString(); }
function todayStr(){
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0,10);
}
function dObj(s){ return s ? new Date(s+'T12:00:00') : null; }
function fmtDate(s){ if(!s) return 'Sem data'; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
function fmtSec(sec){ sec=Math.max(0, Math.floor(sec||0)); const h=String(Math.floor(sec/3600)).padStart(2,'0'); const m=String(Math.floor((sec%3600)/60)).padStart(2,'0'); const s=String(sec%60).padStart(2,'0'); return `${h}:${m}:${s}`; }
function closeTimerPatch(task, endIso){
  if(!task?.startedAt) return null;
  const startedAt = new Date(task.startedAt).getTime();
  const endAt = new Date(endIso || now()).getTime();
  const elapsed = Math.max(0, Math.floor((endAt - startedAt) / 1000));
  const patch = { startedAt:null, startedById:null, timerHeartbeatAt:null };
  if(task.status === 'alteracao') patch.totalAlterSeconds = (task.totalAlterSeconds||0) + elapsed;
  else patch.totalEditSeconds = (task.totalEditSeconds||0) + elapsed;
  return patch;
}
function avg(arr){ const clean=arr.filter(n=>Number.isFinite(n)); return clean.length ? clean.reduce((a,b)=>a+b,0)/clean.length : 0; }
function slug(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function driveId(url){ const m = (url||'').match(/\/file\/d\/([^/]+)/) || (url||'').match(/[?&]id=([^&]+)/); return m ? m[1] : ''; }
function driveDirect(url){ if(String(url||'').startsWith('data:')) return url; const id=driveId(url); return id ? `https://drive.google.com/uc?export=view&id=${id}` : url; }
function drivePreview(url){ if(String(url||'').startsWith('data:')) return url; const id=driveId(url); return id ? `https://drive.google.com/file/d/${id}/preview` : url; }
function priorityClass(date){ if(!date) return 'neutral'; const diff=Math.ceil((dObj(date)-dObj(todayStr()))/86400000); if(diff < 0) return 'late'; if(diff <= 1) return 'hot'; if(diff <= 3) return 'warn'; return 'ok'; }
function priorityText(date){ const c=priorityClass(date); return c==='late'?'Atrasada':c==='hot'?'Urgente':c==='warn'?'Alta':c==='ok'?'Baixa':'Sem prazo'; }
async function uploadImageToSupabase(file, folder='uploads'){
  if(!file) return '';

  if(isSupabaseConfigured){
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });

    if(error) throw error;

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleImageUpload(e, cb, folder='uploads'){
  const file = e.target.files?.[0];
  if(!file) return;

  try{
    const url = await uploadImageToSupabase(file, folder);
    cb(url);
  }catch(err){
    console.error(err);
    alert('Não foi possível enviar a imagem: ' + (err.message || err));
  }
}
function avatarValue(value){ if(!value) return ''; if(/^https?:\/\//.test(value)) return <img src={driveDirect(value)} onError={e=>{e.currentTarget.style.display='none'}}/>; return value; }
function statusDot(status){ return <i className="status-dot" style={{background:status?.color||'#666'}}/>; }
function isFinalStatus(statuses, id){ return statuses.find(s=>s.id===id)?.final; }
function monthLabel(dateStr){ const d=dObj(dateStr)||dObj(todayStr()); return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}); }
function addDays(dateStr, amount){ const d=dObj(dateStr)||dObj(todayStr()); d.setDate(d.getDate()+amount); return d.toISOString().slice(0,10); }
function addMonths(dateStr, amount){ const d=dObj(dateStr)||dObj(todayStr()); d.setMonth(d.getMonth()+amount); return d.toISOString().slice(0,10); }
function weekStartStr(dateStr=todayStr()){ const d=dObj(dateStr)||dObj(todayStr()); const day=d.getDay(); const diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); return d.toISOString().slice(0,10); }
function weekEndStr(dateStr=todayStr()){ return addDays(weekStartStr(dateStr),6); }
function weekDayDate(weekStart, offset){ return addDays(weekStart, Number(offset)||0); }
function linkify(text){
  const tokens=String(text||'').split(/(https?:\/\/[^\s]+)/g);
  return tokens.flatMap((part,i)=>{
    if(/^https?:\/\//.test(part)) return [<a key={'u'+i} href={part} target="_blank" rel="noreferrer">{part}</a>];
    return part.split(/(\n)/g).map((chunk,j)=>chunk==='\n'?<br key={'b'+i+'-'+j}/>:chunk);
  });
}
function extractLinks(text){ return Array.from(String(text||'').matchAll(/https?:\/\/[^\s]+/g)).map(m=>m[0]); }
function periodMatch(date, period, from, to){
  if(!date) return false; const d=dObj(date); const today=dObj(todayStr());
  const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate()-today.getDay()+1);
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate()+6);
  const lastWeekStart = new Date(startOfWeek); lastWeekStart.setDate(startOfWeek.getDate()-7);
  const lastWeekEnd = new Date(endOfWeek); lastWeekEnd.setDate(endOfWeek.getDate()-7);
  if(period==='today') return date===todayStr();
  if(period==='week') return d>=startOfWeek && d<=endOfWeek;
  if(period==='lastweek') return d>=lastWeekStart && d<=lastWeekEnd;
  if(period==='month') return d.getMonth()===today.getMonth() && d.getFullYear()===today.getFullYear();
  if(period==='lastmonth'){ const m=today.getMonth()-1; const y=m<0?today.getFullYear()-1:today.getFullYear(); const mm=(m+12)%12; return d.getMonth()===mm && d.getFullYear()===y; }
  if(period==='custom') return (!from || d>=dObj(from)) && (!to || d<=dObj(to));
  return true;
}
function baseVisibleTasks(tasks, user, statuses){
  const allowed = user.role==='admin' ? statuses.map(s=>s.id) : (user.visibleStatuses||[]);
  return tasks.filter(t=>{
    if(!allowed.includes(t.status)) return false;
    if(user.role==='team' && t.responsibleId!==user.id) return false;
    if(user.role==='client' && !(user.companyIds||[]).includes(t.companyId)) return false;
    return true;
  });
}
function applyFilters(tasks, filters={}){
  return tasks.filter(t=>{
    if(filters.archivedOnly && !t.archived) return false;
    if(!filters.archivedOnly && filters.showArchived!==true && t.archived) return false;
    if(filters.company && filters.company!=='all' && t.companyId!==filters.company) return false;
    if(filters.resp && filters.resp!=='all' && t.responsibleId!==filters.resp) return false;
    if(filters.type && filters.type!=='all' && t.type!==filters.type) return false;
    if(filters.status && filters.status!=='all' && t.status!==filters.status) return false;
    if(filters.period && !periodMatch(t.postDate, filters.period, filters.from, filters.to)) return false;
    if(filters.search){ const q=filters.search.toLowerCase(); if(!(`${t.title} ${t.type} ${t.copy} ${t.caption}`.toLowerCase().includes(q))) return false; }
    return true;
  });
}

function entityCreatedValue(item, index){
  const raw = item.createdAt || item.entryDate || '';
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : index;
}
function sortEntities(items, sort='created', getName=x=>x.name){
  return items.map((item,index)=>({item,index})).sort((a,b)=>{
    const aInactive = a.item.active === false ? 1 : 0;
    const bInactive = b.item.active === false ? 1 : 0;
    if(aInactive !== bInactive) return aInactive - bInactive;
    const an = String(getName(a.item)||'').toLowerCase();
    const bn = String(getName(b.item)||'').toLowerCase();
    if(sort === 'role'){
      const order={admin:0,team:1,client:2};
      const ar=order[a.item.role] ?? 9;
      const br=order[b.item.role] ?? 9;
      if(ar !== br) return ar - br;
      return an.localeCompare(bn,'pt-BR') || a.index-b.index;
    }
    if(sort === 'name' || sort === 'company') return an.localeCompare(bn,'pt-BR') || a.index-b.index;
    if(sort === 'nameDesc') return bn.localeCompare(an,'pt-BR') || a.index-b.index;
    if(sort === 'active') return aInactive-bInactive || an.localeCompare(bn,'pt-BR');
    return entityCreatedValue(b.item,b.index) - entityCreatedValue(a.item,a.index);
  }).map(x=>x.item);
}
function SortControl({value,setValue,options=null,extraOptions=[]}){
  const baseOptions = options || [
    { value:'created', label:'Data de criação' },
    { value:'name', label:'Nome' },
    ...extraOptions
  ];
  return <label>Ordenar por<select value={value} onChange={e=>setValue(e.target.value)}>{baseOptions.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>;
}
function StatusVisibilityChecks({statuses,selected=[],onToggle}){
  return <div className="arg-vs-list-v2">
    {statuses.map(s=><label className="arg-vs-row-v2" key={s.id}>
      <input type="checkbox" checked={selected.includes(s.id)} onChange={e=>onToggle(s.id,e.target.checked)}/>
      <span className="arg-vs-dot-v2" style={{background:s.color}}></span>
      <span className="arg-vs-name-v2">{s.name}</span>
    </label>)}
  </div>
}
function App(){
  const [users,setUsersState]=useState(()=>load('argos_users_r8', seedUsers));
  const [companies,setCompaniesState]=useState(()=>load('argos_companies_r8', seedCompanies));
  const [statuses,setStatusesState]=useState(()=>load('argos_statuses_r8', DEFAULT_STATUS));
  const [tasks,setTasksState]=useState(()=>load('argos_tasks_r8', seedTasks));
  const [notifications,setNotificationsState]=useState(()=>load('argos_notifications_r9', []));
  const [auth,setAuth]=useState(null); const [viewAs,setViewAs]=useState(null); const [screen,setScreen]=useState('dashboard');
  const [selectedTask,setSelectedTask]=useState(null); const [createOpen,setCreateOpen]=useState(false); const [form,setForm]=useState(null);
  const [globalSearch,setGlobalSearch]=useState('');
  const [system,setSystemState]=useState(()=>load('argos_system_r18', { logo:'', title:'Painel de Aprovação' }));
  const [cloudLoading,setCloudLoading]=useState(isSupabaseConfigured);
  const [cloudReady,setCloudReady]=useState(!isSupabaseConfigured);
  const [cloudError,setCloudError]=useState('');

  useEffect(()=>{
    if(!isSupabaseConfigured) return;
    let alive=true;
    (async()=>{
      try{
        const { data } = await supabase.auth.getSession();
        const session=data?.session;
        if(!session){ if(alive){ setCloudLoading(false); setCloudReady(false); } return; }
        const profile=await fetchCurrentProfile(session);
        const saved=await loadWorkspaceState(profile.organizationId);
        const payload=saved || EMPTY_CLOUD_STATE;
        const mergedProfile=mergeProfileWithWorkspaceUser(profile,payload);
        if(!mergedProfile?.active){ await supabase.auth.signOut(); throw new Error('Usuário inativo.'); }
        const nextUsers=[mergedProfile, ...(payload.users||[]).filter(u=>u.id!==mergedProfile.id)];
        if(alive){
          setAuth(mergedProfile);
          setUsersState(nextUsers);
          setCompaniesState(payload.companies||[]);
          setStatusesState(payload.statuses?.length?payload.statuses:DEFAULT_STATUS);
          setTasksState(payload.tasks||[]);
          setNotificationsState(payload.notifications||[]);
          const cloudSystem = payload.system||{logo:'',title:'Painel de Aprovação'};
          setSystemState(cloudSystem);
          save('argos_system_r18', cloudSystem);
          setCloudReady(true); setCloudLoading(false); setCloudError('');
          if(!saved) await saveWorkspaceState(profile.organizationId,{...payload, users: nextUsers});
        }
      }catch(err){ console.error(err); if(alive){ setCloudError(err.message||'Erro ao carregar Supabase.'); setCloudLoading(false); } }
    })();
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId) return;
    const timer=setTimeout(()=>{
      saveWorkspaceState(auth.organizationId,{ users, companies, statuses, tasks, notifications, system })
        .catch(err=>{ console.error(err); setCloudError('Não foi possível salvar no Supabase: '+(err.message||err)); });
    },500);
    return()=>clearTimeout(timer);
  },[users,companies,statuses,tasks,notifications,system,cloudReady,auth?.organizationId]);

  const setSystem=v=>{setSystemState(v); save('argos_system_r18',v)};
  const setUsers=v=>{setUsersState(v); if(!isSupabaseConfigured) save('argos_users_r8',v)};
  const setCompanies=v=>{setCompaniesState(v); if(!isSupabaseConfigured) save('argos_companies_r8',v)};
  const setStatuses=v=>{setStatusesState(v); if(!isSupabaseConfigured) save('argos_statuses_r8',v)};
  const setTasks=v=>{setTasksState(v); if(!isSupabaseConfigured) save('argos_tasks_r8',v)};
  const setNotifications=v=>{setNotificationsState(v); if(!isSupabaseConfigured) save('argos_notifications_r9',v)};

  useEffect(()=>{
    const favicon = system?.favicon || '';
    if(favicon){
      let link = document.querySelector("link[rel~='icon']");
      if(!link){ link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = driveDirect(favicon);
    }
    if(system?.title) document.title = system.title;
  },[system?.favicon, system?.title]);

  useEffect(()=>{
    if(!cloudReady) return;
    const STALE_MS = 150000;
    const checkStaleTimers = () => {
      const current = Date.now();
      let changed = false;
      const next = tasks.map(t=>{
        if(!t.startedAt || !t.timerHeartbeatAt) return t;
        const heartbeatTime = new Date(t.timerHeartbeatAt).getTime();
        if(!Number.isFinite(heartbeatTime) || current - heartbeatTime <= STALE_MS) return t;
        const patch = closeTimerPatch(t, t.timerHeartbeatAt);
        if(!patch) return t;
        changed = true;
        return {
          ...t,
          ...patch,
          logs:[...(t.logs||[]), {id:crypto.randomUUID(), user:'Sistema Argos', userId:'system', type:'log', visibility:'internal', at:now(), text:'Timer pausado automaticamente por inatividade.'}]
        };
      });
      if(changed) setTasks(next);
    };
    checkStaleTimers();
    const interval = setInterval(checkStaleTimers, 60000);
    return ()=>clearInterval(interval);
  },[cloudReady,tasks]);

  if(cloudLoading) return <div className="login"><div className="login-card"><div className="logo">A</div><h1>Carregando Argos</h1><p>Conectando ao Supabase...</p></div></div>;
  if(isSupabaseConfigured && !auth) return <CloudLogin setAuth={setAuth} setUsersState={setUsersState} setCompaniesState={setCompaniesState} setStatusesState={setStatusesState} setTasksState={setTasksState} setNotificationsState={setNotificationsState} setSystemState={setSystemState} setCloudReady={setCloudReady} setCloudError={setCloudError} cloudError={cloudError} system={system}/>;
  if(!auth) return <SetupRequired/>;
  const authUser=users.find(u=>u.id===auth.id)||auth;
  const simulatedUser=viewAs ? (users.find(u=>u.id===viewAs.id)||viewAs) : null;
  const effectiveUser=simulatedUser||authUser; const realAdmin=authUser.role==='admin'; const isAdmin=effectiveUser.role==='admin';
  const statusById=Object.fromEntries(statuses.map(s=>[s.id,s]));
  const visibleTasks=baseVisibleTasks(tasks,effectiveUser,statuses);
  async function reset(){
    const code = prompt('ATENÇÃO: esta ação pode apagar dados locais/reais do sistema. Use apenas se tiver certeza absoluta. Digite RESETAR para confirmar.');
    if(code !== 'RESETAR') return;
    if(isSupabaseConfigured){
      await supabase.auth.signOut();
      location.reload();
    } else {
      localStorage.clear();
      location.reload();
    }
  }
  function openCreate(){ const firstResponsible=users.find(u=>u.active&&(u.role==='team'||u.role==='admin')); setForm({ title:'', companyId:companies.find(c=>c.active)?.id||'', responsibleId:firstResponsible?.id||'', type:TASK_TYPES[0], status:statuses[0]?.id||'', postDate:'', internalDate:'', copyInstructions:'', editorInstructions:'', copy:'', caption:'', materialLinks:'' }); setCreateOpen(true); }
  function createTask(){
    if(!form.title||!form.companyId||!form.responsibleId||!form.type||!form.status){ alert('Preencha os campos principais.'); return; }
    const t={ id:crypto.randomUUID(), ...form, archived:false, alterationCount:0, totalEditSeconds:0, totalAlterSeconds:0, startedAt:null, version:1, logs:[{id:crypto.randomUUID(),user:auth.name,userId:auth.id,type:'log',visibility:'internal',at:now(),text:'Tarefa criada.'}] };
    setTasks([...tasks,t]); setCreateOpen(false); setForm(null);
  }
  function notifyTask(task,text,event,statusId=null){
    if(!task) return;
    const recipients = users.filter(u=>u.active && u.role!=='client' && (u.role==='admin' || u.id===task.responsibleId))
      .filter(u=>u.id!==effectiveUser.id)
      .filter(u=>wantsNotification(u,event,statusId));
    if(recipients.length) setNotifications([...recipients.map(u=>({id:crypto.randomUUID(),taskId:task.id,userId:u.id,text:`${task.title}: ${text}`,at:now(),done:false,event,statusId})),...notifications]);
  }
  function updateTask(id, patch, logText){
    const original=tasks.find(t=>t.id===id);
    let eventText='', eventName='', eventStatus=null;

    setTasks(prevTasks=>prevTasks.map(t=>{
      if(t.id!==id) return t;

      const extraLogs = patch.extraLogs || [];
      let next={...t,...patch};
      delete next.extraLogs;

      let logs=[...(t.logs||[])];

      if(patch.logs) return {...next, logs:patch.logs};

      if(patch.responsibleId && patch.responsibleId!==t.responsibleId){
        eventText='Responsável alterado.';
        eventName='Mudança de responsável';
      }

      if(patch.status && patch.status!==t.status){
        if(patch.status==='alteracao' && t.status!=='alteracao') next.alterationCount=(t.alterationCount||0)+1;

        const statusText=`Status alterado de ${statusById[t.status]?.name||t.status} para ${statusById[patch.status]?.name||patch.status}.`;

        logs.push({
          id:crypto.randomUUID(),
          user:effectiveUser.name,
          userId:effectiveUser.id,
          type:'status',
          visibility:'internal',
          at:now(),
          text:statusText
        });

        eventText=statusText;
        eventName='Alteração de status';
        eventStatus=patch.status;
      }

      if(logText){
        logs.push({
          id:crypto.randomUUID(),
          user:effectiveUser.name,
          userId:effectiveUser.id,
          type:'log',
          visibility:'internal',
          at:now(),
          text:logText
        });
      }

      if(extraLogs.length) logs.push(...extraLogs);

      return {...next,logs};
    }));

    if(original){
      const targetTask = {...original, ...patch};

      if(eventName) notifyTask(targetTask,eventText,eventName,eventStatus);

      if(logText){
        const ev=logText.includes('aprov')
          ? 'Aprovação do cliente'
          : logText.includes('alteração')
            ? 'Solicitação de alteração'
            : logText.includes('reaberta')
              ? 'Tarefa reaberta'
              : 'Comentário na tarefa';

        notifyTask(targetTask,logText,ev,eventStatus);
      }
    }
  }

  function addLog(id,text,type='comment',visibility='internal'){
    const entry={id:crypto.randomUUID(),user:effectiveUser.name,userId:effectiveUser.id,type,visibility,at:now(),text,resolved:false};
    setTasks(tasks.map(t=>t.id===id?{...t,logs:[...(t.logs||[]),entry]}:t));
    const task=tasks.find(t=>t.id===id);
    const event = type==='change' ? 'Solicitação de alteração' : type==='approval' ? 'Aprovação do cliente' : 'Comentário na tarefa';
    notifyTask(task,text,event,task?.status);
  }

  function createWeeklyTasks(companyId, weekStart, force=false){
    const company=companies.find(c=>c.id===companyId);
    if(!company) return;
    const template=(company.weeklyTemplate||[]).filter(item=>Number(item.quantity)>0);
    if(!template.length){ alert('Este cliente ainda não tem template semanal configurado.'); return; }
    const existing=tasks.filter(t=>t.companyId===companyId && t.generatedWeek===weekStart);
    if(existing.length && !force){
      const ok=confirm(`${company.name} já tem ${existing.length} tarefa(s) geradas para esta semana. Gerar mesmo assim?`);
      if(!ok) return;
    }
    const startStatus=statuses.find(s=>s.id==='criar')?.id || statuses[0]?.id || '';
    const fallbackResponsible=users.find(u=>u.active&&(u.role==='team'||u.role==='admin'))?.id || '';
    const created=[];
    template.forEach(item=>{
      const qty=Math.max(0, Number(item.quantity)||0);
      for(let i=0;i<qty;i++){
        const postDate=weekDayDate(weekStart,item.postDay);
        const internalDate=addDays(postDate,-Math.max(0, Number(item.internalOffset)||0));
        const suffix=qty>1 ? ` ${String(i+1).padStart(2,'0')}` : '';
        created.push({
          id:crypto.randomUUID(),
          title:`${company.name} | ${item.type || TASK_TYPES[0]}${suffix} | Semana ${fmtDate(weekStart)}`,
          companyId:company.id,
          type:item.type || TASK_TYPES[0],
          status:startStatus,
          postDate,
          internalDate,
          responsibleId:item.responsibleId || fallbackResponsible,
          archived:false,
          alterationCount:0,
          totalEditSeconds:0,
          totalAlterSeconds:0,
          startedAt:null,
          startedById:null,
          timerHeartbeatAt:null,
          version:1,
          copyInstructions:item.copyInstructions || '',
          editorInstructions:item.editorInstructions || '',
          copy:'',
          caption:'',
          materialLinks:'',
          generatedWeek:weekStart,
          generatedFromTemplate:true,
          logs:[{id:crypto.randomUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'log',visibility:'internal',at:now(),text:`Tarefa gerada pelo Planejamento Semanal (${fmtDate(weekStart)} a ${fmtDate(weekEndStr(weekStart))}).`}]
        });
      }
    });
    if(!created.length){ alert('Nenhuma tarefa foi gerada. Verifique as quantidades do template.'); return; }
    setTasks([...tasks,...created]);
    alert(`${created.length} tarefa(s) gerada(s) para ${company.name}.`);
  }
  const navAdmin=[['dashboard','Dashboard'],['notifications','Notificações'],['planning','Planejamento'],['calendar','Calendário'],['kanban','Kanban'],['tasks','Tarefas'],['settings','Configurações']];
  const navTeam=[['dashboard','Dashboard'],['notifications','Notificações'],['kanban','Kanban'],['tasks','Tarefas']];
  const navClient=[['calendar','Calendário']];
  const nav=isAdmin?navAdmin:(effectiveUser.role==='team'?navTeam:navClient);
  const activeScreen = nav.some(([id])=>id===screen) ? screen : nav[0][0];
  return <div className="app">
    <Sidebar auth={auth} effectiveUser={effectiveUser} viewAs={viewAs} setViewAs={setViewAs} users={users} companies={companies} system={system} realAdmin={realAdmin} nav={nav} screen={activeScreen} setScreen={setScreen} setAuth={setAuth}/>
    <main className="main">
      {cloudError&&<div className="cloud-banner">{cloudError}</div>}
      {selectedTask ? <TaskPage task={tasks.find(t=>t.id===selectedTask)} tasks={visibleTasks} companies={companies} users={users} statuses={statuses} types={TASK_TYPES} statusById={statusById} updateTask={updateTask} addLog={addLog} back={()=>setSelectedTask(null)} open={setSelectedTask} effectiveUser={effectiveUser} isAdmin={isAdmin}/>
      : <>
        <SearchBox value={globalSearch} setValue={setGlobalSearch} tasks={visibleTasks} companies={companies} users={users} user={effectiveUser} open={setSelectedTask}/>
        {effectiveUser.role!=='client' && <button className="new-btn" onClick={openCreate}>+ Nova tarefa</button>}
        {activeScreen==='dashboard' && <Dashboard tasks={visibleTasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={effectiveUser} search=""/>}
        {activeScreen==='tasks' && <TasksPanel tasks={visibleTasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={effectiveUser} open={setSelectedTask}/>} 
        {activeScreen==='planning' && isAdmin && <PlanningPage companies={companies} setCompanies={setCompanies} users={users} tasks={tasks} createWeeklyTasks={createWeeklyTasks} open={setSelectedTask}/>} 
        {activeScreen==='calendar' && <Calendar tasks={visibleTasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={effectiveUser} open={setSelectedTask} search=""/>} 
        {activeScreen==='kanban' && <Kanban tasks={visibleTasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={effectiveUser} open={setSelectedTask} search=""/>} 
        {activeScreen==='settings' && isAdmin && <SettingsPage statuses={statuses} setStatuses={setStatuses} tasks={tasks} setTasks={setTasks} companies={companies} setCompanies={setCompanies} users={users} setUsers={setUsers} system={system} setSystem={setSystem} reset={reset} currentUser={effectiveUser}/>} 
        {activeScreen==='notifications' && effectiveUser.role!=='client' && <NotificationsPage notifications={notifications} setNotifications={setNotifications} open={setSelectedTask} tasks={tasks} user={effectiveUser} auth={auth}/>}
      </>}
    </main>
    {createOpen && <CreateModal form={form} setForm={setForm} companies={companies} users={users} statuses={statuses} types={TASK_TYPES} createTask={createTask} close={()=>setCreateOpen(false)}/>} 
  </div>
}

async function hydrateCloudSession(setAuth,setUsersState,setCompaniesState,setStatusesState,setTasksState,setNotificationsState,setSystemState,setCloudReady,setCloudError){
  const { data } = await supabase.auth.getSession();
  const profile=await fetchCurrentProfile(data.session);
  const saved=await loadWorkspaceState(profile.organizationId);
  const payload=saved || EMPTY_CLOUD_STATE;
  const mergedProfile=mergeProfileWithWorkspaceUser(profile,payload);
  const nextUsers=[mergedProfile, ...(payload.users||[]).filter(u=>u.id!==mergedProfile.id)];
  const cloudSystem = payload.system||{logo:'',title:'Painel de Aprovação'};
  setAuth(mergedProfile); setUsersState(nextUsers); setCompaniesState(payload.companies||[]); setStatusesState(payload.statuses?.length?payload.statuses:DEFAULT_STATUS); setTasksState(payload.tasks||[]); setNotificationsState(payload.notifications||[]); setSystemState(cloudSystem); save('argos_system_r18', cloudSystem); setCloudReady(true); setCloudError('');
  if(!saved) await saveWorkspaceState(mergedProfile.organizationId,{...payload, users: nextUsers});
}
function CloudLogin({setAuth,setUsersState,setCompaniesState,setStatusesState,setTasksState,setNotificationsState,setSystemState,setCloudReady,setCloudError,cloudError,system}){
  const [email,setEmail]=useState(''); const [pass,setPass]=useState(''); const [busy,setBusy]=useState(false);
  const cachedSystem = load('argos_system_r18', {});
  const loginLogo = system?.loginLogo || system?.logo || cachedSystem?.loginLogo || cachedSystem?.logo || '';
  const loginTitle = system?.loginTitle || system?.title || cachedSystem?.loginTitle || cachedSystem?.title || 'Painel de Aprovação';
  const loginSubtitle = system?.loginSubtitle || cachedSystem?.loginSubtitle || 'Entre com seu acesso.';
  async function login(){
    try{ setBusy(true); setCloudError(''); const { error } = await supabase.auth.signInWithPassword({ email, password: pass }); if(error) throw error; await hydrateCloudSession(setAuth,setUsersState,setCompaniesState,setStatusesState,setTasksState,setNotificationsState,setSystemState,setCloudReady,setCloudError); }
    catch(err){ setCloudError(err.message||'Login inválido.'); }
    finally{ setBusy(false); }
  }
  return <div className="login"><div className="login-card login-card-brand-fixed" style={{padding:'30px 32px 34px'}}><div className="login-logo-big" style={{width:260,height:150,display:'grid',placeItems:'center',border:'none',borderRadius:0,margin:'-44px auto 34px',overflow:'visible',background:'transparent',boxShadow:'none'}}>{loginLogo?<img src={driveDirect(loginLogo)} style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',display:'block'}}/>:<span>A</span>}</div><h1>{loginTitle}</h1><p>{loginSubtitle}</p>{cloudError&&<div className="cloud-error">{cloudError}</div>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="e-mail"/><input value={pass} onChange={e=>setPass(e.target.value)} placeholder="senha" type="password" onKeyDown={e=>{if(e.key==='Enter')login()}}/><button onClick={login} disabled={busy}>{busy?'Entrando...':'Entrar'}</button></div></div>
}

function SetupRequired(){
  return <div className="login"><div className="login-card"><div className="logo">A</div><h1>Configuração necessária</h1><p>O Supabase ainda não foi configurado neste projeto.</p><div className="cloud-error">Crie o arquivo <b>.env</b> na raiz do projeto com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</div><small>Depois reinicie o servidor com npm run dev.</small></div></div>
}

function Login({users,companies,setAuth}){ const [email,setEmail]=useState('admin@argos.local'); const [pass,setPass]=useState('123456');
  function login(){ const u=users.find(x=>x.email===email&&x.password===pass); if(!u) return alert('Login inválido'); if(!u.active) return alert('Usuário inativo'); if(u.role==='client' && !(u.companyIds||[]).some(id=>companies.find(c=>c.id===id)?.active)) return alert('Nenhuma empresa ativa vinculada a este usuário.'); setAuth(u); }
  return <div className="login"><div className="login-card"><div className="logo">A</div><h1>Argos Approval</h1><p>Central de produção, aprovação e operação.</p><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="login"/><input value={pass} onChange={e=>setPass(e.target.value)} placeholder="senha" type="password"/><button onClick={login}>Entrar</button></div></div>
}
function SearchBox({value,setValue,tasks,companies,users,user,open}){
  const [show,setShow]=useState(false);
  const q=(value||'').trim().toLowerCase();
  const results=q?tasks.filter(t=>{
    const company=companies.find(c=>c.id===t.companyId)?.name||'';
    const resp=users.find(u=>u.id===t.responsibleId)?.name||'';
    const visibleLogs=(t.logs||[]).filter(l=>user?.role!=='client'||l.visibility==='client'||l.userId===user.id).map(l=>l.text).join(' ');
    return `${t.title} ${company} ${resp} ${t.type} ${t.copy} ${t.caption} ${visibleLogs}`.toLowerCase().includes(q);
  }).slice(0,5):[];
  return <div className="search-wrap"><input value={value} onFocus={()=>setShow(true)} onChange={e=>{setValue(e.target.value);setShow(true)}} placeholder="Pesquisar tarefa, cliente, copy, legenda ou comentário..."/>
    {show&&q&&<div className="search-results">{results.length?results.map(t=><button key={t.id} onClick={()=>{open(t.id);setShow(false)}}><b>{t.title}</b><small>{companies.find(c=>c.id===t.companyId)?.name} • {fmtDate(t.postDate)} {t.archived?'• Arquivada':''}</small></button>):<p>Nenhuma tarefa encontrada.</p>}<button className="ghost" onClick={()=>setShow(true)}>Pesquisa restrita às tarefas permitidas</button></div>}
  </div>
}
function Sidebar({auth,effectiveUser,viewAs,setViewAs,users,companies=[],system,realAdmin,nav,screen,setScreen,setAuth}){
  const clientCompany = effectiveUser.role==='client' ? companies.find(c=>(effectiveUser.companyIds||[]).includes(c.id)) : null;
  const displayAvatar = clientCompany?.logo || effectiveUser.avatar;
  const roleLabel = viewAs ? 'Visualização simulada' : (effectiveUser.title || (effectiveUser.role==='admin'?'Administrador':effectiveUser.role==='team'?'Equipe':'Cliente'));
  return <aside className="side">
    <div className="brand brand-clean brand-logo-only">
      <div className="brand-logo">{system?.logo ? <img src={driveDirect(system.logo)}/> : <span>A</span>}</div>
      <small>{system?.title || 'Painel de Aprovação'}</small>
    </div>
    <div className="user-card user-clean"><AvatarMini value={displayAvatar} label={effectiveUser.name}/><div><b>{effectiveUser.name}</b><small>{roleLabel}</small></div></div>
    {realAdmin&&<div className="impersonate"><small>ACESSAR COMO</small><select value={viewAs?.id||''} onChange={e=>setViewAs(users.find(u=>u.id===e.target.value)||null)}><option value="">Visão admin</option>{users.filter(u=>u.role!=='admin'&&u.active).map(u=><option value={u.id} key={u.id}>{u.name} ({u.role==='client'?'cliente':'equipe'})</option>)}</select><small>Permissões reais do usuário simulado.</small></div>}
    <nav>{nav.map(([id,label])=><button key={id} onClick={()=>setScreen(id)} className={screen===id?'active':''}>{label}</button>)}</nav>
    <div className="spacer"/>
    <button onClick={async()=>{ if(isSupabaseConfigured) await supabase.auth.signOut(); setAuth(null); location.reload(); }}>Sair</button>
  </aside> 
}
function CreateModal({form,setForm,companies,users,statuses,types,createTask,close}){ const F=(k,v)=>setForm({...form,[k]:v}); const teams=users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')); return <div className="modal-bg"><div className="modal create"><button className="x" onClick={close}>×</button><h2>Nova tarefa</h2><p>Organize briefing, prazos e materiais da produção.</p><label>Nome da tarefa<input value={form.title} onChange={e=>F('title',e.target.value)} placeholder="Ex: Reels | Oferta Junho"/></label><div className="form-two"><label>Cliente / Empresa<div className="select-entity"><EntityLabel value={companies.find(c=>c.id===form.companyId)?.logo} label={companies.find(c=>c.id===form.companyId)?.name||'Empresa'}/><select value={form.companyId} onChange={e=>F('companyId',e.target.value)}>{companies.filter(c=>c.active).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div></label><label>Responsável<div className="select-entity"><EntityLabel value={teams.find(u=>u.id===form.responsibleId)?.avatar} label={teams.find(u=>u.id===form.responsibleId)?.name||'Responsável'}/><select value={form.responsibleId} onChange={e=>F('responsibleId',e.target.value)}>{teams.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></div></label></div><div className="form-two"><label>Tipo de post<select value={form.type} onChange={e=>F('type',e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></label><label>Status<div className="status-select">{statusDot(statuses.find(s=>s.id===form.status))}<select value={form.status} onChange={e=>F('status',e.target.value)}>{statuses.filter(s=>s.active).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></div></label></div><div className="form-two"><label>Data do post<input type="date" value={form.postDate} onChange={e=>F('postDate',e.target.value)}/></label><label className={'date-field '+priorityClass(form.internalDate)}>Prazo<input type="date" value={form.internalDate} onChange={e=>F('internalDate',e.target.value)}/><small>{priorityText(form.internalDate)}</small></label></div><label>Instruções ao copy<textarea value={form.copyInstructions||''} onChange={e=>F('copyInstructions',e.target.value)} placeholder="Objetivo, tom, CTA, ideias e referências para o copy..."/></label><label>Instruções ao editor<textarea value={form.editorInstructions||''} onChange={e=>F('editorInstructions',e.target.value)} placeholder="Referências visuais, formato, identidade, imagens, links e observações para edição..."/></label><label>Copy<textarea value={form.copy} onChange={e=>F('copy',e.target.value)} placeholder="Opcional. Use quando a copy precisa ser criada ou aprovada antes do design."/></label><label>Legenda<textarea value={form.caption} onChange={e=>F('caption',e.target.value)} placeholder="Opcional. Pode ser preenchida agora ou depois."/></label><label>Links do material, um por linha<textarea value={form.materialLinks} onChange={e=>F('materialLinks',e.target.value)} placeholder="Cole um link por linha. Imagem, vídeo ou Drive público."/></label><div className="modal-actions"><button onClick={close}>Cancelar</button><button className="primary" onClick={createTask}>+ Criar tarefa</button></div></div></div> }
function PeriodFilters({period,setPeriod,from,setFrom,to,setTo}){ return <><label>Período<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="month">Mês corrente</option><option value="lastmonth">Mês passado</option><option value="week">Essa semana</option><option value="lastweek">Semana passada</option><option value="today">Hoje</option><option value="custom">Personalizado</option></select></label>{period==='custom'&&<><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></>}</> }
function Dashboard({tasks,companies,users,statuses,statusById,user,search=''}){ 
  const [period,setPeriod]=useState('month'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[company,setCompany]=useState('all'),[resp,setResp]=useState('all'),[type,setType]=useState('all'); 
  const isAdmin=user.role==='admin'; 
  const activeCompanies=companies.filter(c=>c.active);
  const activeUsers=users.filter(u=>u.active&&(u.role==='team'||u.role==='admin'));
  const operationalTasks=tasks.filter(t=>activeCompanies.some(c=>c.id===t.companyId) && activeUsers.some(u=>u.id===t.responsibleId));
  const filtered=applyFilters(operationalTasks,{period,from,to,company:isAdmin?company:'all',resp:isAdmin?resp:'all',type,search,showArchived:true}); 
  const alterations=filtered.reduce((a,t)=>a+(t.alterationCount||0),0); const finalized=filtered.filter(t=>isFinalStatus(statuses,t.status)).length; const rework=filtered.length?Math.round(alterations/filtered.length*100):0; const total=filtered.reduce((a,t)=>a+(t.totalEditSeconds||0)+(t.totalAlterSeconds||0),0); 
  return <section><h1>Dashboard</h1><p>Relatório operacional com filtros aplicados em todo o painel.</p><div className="filters"><PeriodFilters period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo}/>{isAdmin&&<label>Cliente<select value={company} onChange={e=>setCompany(e.target.value)}><option value="all">Todos</option>{activeCompanies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}{isAdmin&&<label>Equipe<select value={resp} onChange={e=>setResp(e.target.value)}><option value="all">Todos</option>{activeUsers.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></label>}<label>Tipo de post<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label></div><div className="dash-zone"><div className="cards quick-cards">{isAdmin&&<Card title="Clientes ativos" value={activeCompanies.length}/>} {user.role==='team'&&<Card title="Quantidade de posts" value={filtered.length}/>}<Card title={user.role==='team'?'Posts finalizados':'Posts no período'} value={user.role==='team'?finalized:filtered.length}/><Card title="Alterações" value={alterations}/><Card title="Taxa de retrabalho" value={`${rework}%`}/></div><div className="cards time-cards"><Card title="Tempo total" value={fmtSec(total)}/><Card title="Média por post" value={fmtSec(avg(filtered.map(t=>(t.totalEditSeconds||0)+(t.totalAlterSeconds||0))))}/><Card title="Média em edição" value={fmtSec(avg(filtered.map(t=>t.totalEditSeconds||0)))}/><Card title="Média em alteração" value={fmtSec(avg(filtered.map(t=>t.totalAlterSeconds||0)))}/></div></div><div className="grid2"><Bar title="Post por Status" rows={statuses.map(s=>[s.name,filtered.filter(t=>t.status===s.id).length,s.color])}/><Bar title="Por tipo" rows={TASK_TYPES.map(tp=>[tp,filtered.filter(t=>t.type===tp).length,'#e1b12c'])}/><Bar title="Por cliente" rows={activeCompanies.map(c=>[c.name,filtered.filter(t=>t.companyId===c.id).length,'#6ee7b7',c.logo])}/>{isAdmin&&<Bar title="Por funcionário" rows={activeUsers.map(u=>[u.name,filtered.filter(t=>t.responsibleId===u.id).length,'#c084fc',u.avatar])}/>}</div></section> }
function Card({title,value}){ return <div className="card"><small>{title}</small><b>{value}</b></div> }
function Bar({title,rows}){
  const max=Math.max(1,...rows.map(r=>r[1]));
  return <div className="panel"><h2>{title}</h2>{rows.map(([label,val,color,avatar])=><div className="bar" key={label} style={{display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',columnGap:12}}><span className="bar-label" style={{display:'inline-flex',alignItems:'center',gap:8,minWidth:0}}>{avatar&&<AvatarMini value={avatar} label={label}/>}<span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span></span><b>{val}</b><i style={{gridColumn:'1 / -1'}}><em style={{width:`${val/max*100}%`,background:color}}/></i></div>)}</div>
}

function TasksPanel({tasks,companies,users,statuses,statusById,user,open}){
  const [mode,setMode]=useState('priority'),[type,setType]=useState('all');
  const filtered=tasks.filter(t=>type==='all'||t.type===type);
  const priorityOrder={late:0,hot:1,warn:2,ok:3,neutral:4};
  const groupers={
    priority:t=>priorityText(t.internalDate),
    status:t=>statusById[t.status]?.name||t.status,
    client:t=>companies.find(c=>c.id===t.companyId)?.name||'Sem cliente',
    type:t=>t.type,
    date:t=>fmtDate(t.internalDate),
    responsible:t=>users.find(u=>u.id===t.responsibleId)?.name||'Sem responsável'
  };
  const sorted=[...filtered].sort((a,b)=>priorityOrder[priorityClass(a.internalDate)]-priorityOrder[priorityClass(b.internalDate)] || String(a.internalDate||'').localeCompare(String(b.internalDate||'')) || a.title.localeCompare(b.title));
  const groups={}; sorted.forEach(t=>{const k=(groupers[mode]||groupers.priority)(t); (groups[k] ||= []).push(t)});
  return <section><h1>Tarefas</h1><p>Visão rápida das tarefas atribuídas e filtradas.</p><div className="filters"><label>Agrupar por<select value={mode} onChange={e=>setMode(e.target.value)}><option value="priority">Prioridade</option><option value="status">Status</option><option value="client">Cliente</option><option value="type">Tipo de post</option><option value="date">Prazo</option>{user.role==='admin'&&<option value="responsible">Responsável</option>}</select></label><label>Tipo de post<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label></div><div className="tasks-board" style={{display:'flex',flexDirection:'column',gap:16}}>{Object.entries(groups).map(([group,items])=><div className="panel task-group" style={{width:'100%'}} key={group}><h2>{group}<small>{items.length}</small></h2>{items.map(t=>{const c=companies.find(x=>x.id===t.companyId);const r=users.find(x=>x.id===t.responsibleId);return <button className={'task-row priority-'+priorityClass(t.internalDate)} key={t.id} onClick={()=>open(t.id)}><b>{t.title}</b><span>{c?.name} • {statusById[t.status]?.name} • Prazo: {fmtDate(t.internalDate)} • {priorityText(t.internalDate)}</span><span className="avatars"><AvatarMini value={c?.logo} label={c?.name}/><AvatarMini value={r?.avatar} label={r?.name}/></span></button>})}</div>)}</div></section>
}
function Calendar({tasks,companies,users,statuses,statusById,user,open,search=''}){ 
  const [view,setView]=useState('month'),[selectedDay,setSelectedDay]=useState(todayStr()),[company,setCompany]=useState('all'),[resp,setResp]=useState('all'),[type,setType]=useState('all'),[status,setStatus]=useState('all'),[archivedOnly,setArchivedOnly]=useState(false); 
  const isAdmin=user.role==='admin'; 
  const filtered=applyFilters(tasks,{company:isAdmin?company:'all',resp:isAdmin?resp:'all',type,status,archivedOnly,search}); 
  const current=dObj(selectedDay)||dObj(todayStr()); 
  const monthStart=new Date(current.getFullYear(),current.getMonth(),1); 
  const days=[...Array(42)].map((_,i)=>{const d=new Date(monthStart); d.setDate(1-monthStart.getDay()+i); return d;}); 
  const legendStatuses=statuses.filter(s=>user.role==='admin'||(user.visibleStatuses||[]).includes(s.id)); 
  return <section><div className="calendar-titlebar"><h1>Calendário</h1><div className="view-tabs"><button className={view==='month'?'primary':''} onClick={()=>setView('month')}>Mês</button><button className={view==='week'?'primary':''} onClick={()=>setView('week')}>Semana</button><button className={view==='day'?'primary':''} onClick={()=>setView('day')}>Dia</button></div></div><div className="calendar-layout"><aside className="legend"><h3>Filtros</h3>{isAdmin&&<label>Cliente<select value={company} onChange={e=>setCompany(e.target.value)}><option value="all">Todos</option>{companies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}{isAdmin&&<label>Responsável<select value={resp} onChange={e=>setResp(e.target.value)}><option value="all">Todos</option>{users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')).map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></label>}<label>Tipo de post<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option>{legendStatuses.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label className="check archive-check"><input type="checkbox" checked={archivedOnly} onChange={e=>setArchivedOnly(e.target.checked)}/><span>Mostrar só arquivados</span></label><h3>Legenda</h3>{legendStatuses.map(s=><button className={'legend-row '+(status===s.id?'selected':'')} key={s.id} onClick={()=>setStatus(status===s.id?'all':s.id)}><i style={{background:s.color}}/><span>{s.name}</span><b>{filtered.filter(t=>t.status===s.id).length}</b></button>)}</aside><div className="calendar-main">{view==='month'&&<MonthView selectedDay={selectedDay} setSelectedDay={setSelectedDay} days={days} tasks={filtered} companies={companies} users={users} statusById={statusById} setDay={d=>{setSelectedDay(d);setView('day')}} open={open}/>} {view==='week'&&<WeekView selectedDay={selectedDay} setSelectedDay={setSelectedDay} tasks={filtered} companies={companies} users={users} statusById={statusById} open={open}/>} {view==='day'&&<DayView day={selectedDay} setSelectedDay={setSelectedDay} tasks={filtered} companies={companies} users={users} statusById={statusById} open={open}/>}</div></div></section> }
function AvatarMini({value,label}){ const v=String(value||''); const text=String(label||value||'?').slice(0,2).toUpperCase(); return <span className="avatar-mini">{(/^https?:\/\//.test(v)||v.startsWith('data:'))?<img src={driveDirect(v)} onError={e=>{e.currentTarget.remove();}}/>:text}</span> }
function EntityLabel({value,label}){ return <span className="entity-label"><AvatarMini value={value} label={label}/><span>{label}</span></span> }
function TaskButton({t,companies,users,statusById,open}){ const company=companies.find(c=>c.id===t.companyId); const resp=users.find(u=>u.id===t.responsibleId); return <button className="mini-task" onClick={()=>open(t.id)} style={{borderLeftColor:statusById[t.status]?.color}}><b>{t.title}</b><small>{company?.name} • {resp?.name}</small></button> }
function MonthView({selectedDay,setSelectedDay,days,tasks,companies,users,statusById,setDay,open}){ const cur=dObj(selectedDay); return <div className="month"><div className="month-head"><h2>{monthLabel(selectedDay)}</h2><div className="nav-actions"><button onClick={()=>setSelectedDay(addMonths(selectedDay,-1))}>‹</button><button onClick={()=>setSelectedDay(todayStr())}>Esse mês</button><button onClick={()=>setSelectedDay(addMonths(selectedDay,1))}>›</button></div><small>{tasks.length} tarefa(s)</small></div><div className="weeknames">{['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(d=><b key={d}>{d}</b>)}</div><div className="days">{days.map(d=>{const ds=d.toISOString().slice(0,10); const list=tasks.filter(t=>t.postDate===ds); const other=d.getMonth()!==cur.getMonth(); return <div className={'day '+(other?'muted-day':'')} key={ds}><button className="day-num" onClick={()=>setDay(ds)}>{d.getDate()}</button>{list.slice(0,4).map(t=><TaskButton key={t.id} t={t} companies={companies} users={users} statusById={statusById} open={open}/>)}{list.length>4&&<button className="more" onClick={()=>setDay(ds)}>+{list.length-4} mais</button>}</div>})}</div></div> }
function WeekView({selectedDay,setSelectedDay,tasks,companies,users,statusById,open}){ const base=dObj(selectedDay); const start=new Date(base); start.setDate(base.getDate()-base.getDay()+1); const days=[...Array(7)].map((_,i)=>{const d=new Date(start); d.setDate(start.getDate()+i); return d.toISOString().slice(0,10)}); return <div><div className="month-head"><h2>Semana de {fmtDate(days[0])} a {fmtDate(days[6])}</h2><div className="nav-actions"><button onClick={()=>setSelectedDay(addDays(selectedDay,-7))}>‹</button><button onClick={()=>setSelectedDay(todayStr())}>Essa semana</button><button onClick={()=>setSelectedDay(addDays(selectedDay,7))}>›</button></div></div><div className="week-grid">{days.map(ds=>{const list=tasks.filter(t=>t.postDate===ds); return <div className="week-col" key={ds}><button className="day-num" onClick={()=>setSelectedDay(ds)}>{fmtDate(ds)}</button>{list.map(t=><TaskButton key={t.id} t={t} companies={companies} users={users} statusById={statusById} open={open}/>)}</div>})}</div></div> }
function DayView({day,setSelectedDay,tasks,companies,users,statusById,open}){ 
  const list=tasks.filter(t=>t.postDate===day); 
  return <div><div className="month-head"><h2>{fmtDate(day)}</h2><div className="nav-actions"><button onClick={()=>setSelectedDay(addDays(day,-1))}>‹</button><button onClick={()=>setSelectedDay(todayStr())}>Hoje</button><button onClick={()=>setSelectedDay(addDays(day,1))}>›</button></div><small>{list.length} tarefa(s) neste dia</small></div><div className="day-list clean-day-list">{list.map(t=><button className="day-card clean-day-card" key={t.id} onClick={()=>open(t.id)} style={{borderColor:statusById[t.status]?.color}}><b>{t.title}</b><small>Prazo: {fmtDate(t.internalDate)}</small><small>Prioridade: {priorityText(t.internalDate)}</small><span className="status-pill" style={{background:statusById[t.status]?.color}}>{statusById[t.status]?.name}</span></button>)}</div></div> 
}
function Kanban({tasks,companies,users,statuses,statusById,user,open,search=''}){ 
  const [period,setPeriod]=useState('month'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[company,setCompany]=useState('all'),[resp,setResp]=useState('all'),[type,setType]=useState('all'),[archivedOnly,setArchivedOnly]=useState(false),[sort,setSort]=useState('priority'); 
  const isAdmin=user.role==='admin'; 
  const allowed=statuses.filter(s=>user.role==='admin'||(user.visibleStatuses||[]).includes(s.id)); 
  let filtered=applyFilters(tasks,{period,from,to,company:isAdmin?company:'all',resp:isAdmin?resp:'all',type,archivedOnly,search}); 
  const priorityOrder={late:0,hot:1,warn:2,ok:3,neutral:4}; 
  function cmp(a,b){
    const pa=priorityOrder[priorityClass(a.internalDate)], pb=priorityOrder[priorityClass(b.internalDate)];
    const clientA=companies.find(c=>c.id===a.companyId)?.name||'', clientB=companies.find(c=>c.id===b.companyId)?.name||'';
    const respA=users.find(u=>u.id===a.responsibleId)?.name||'', respB=users.find(u=>u.id===b.responsibleId)?.name||'';
    if(sort==='client') return clientA.localeCompare(clientB)||pa-pb||a.title.localeCompare(b.title);
    if(sort==='type') return a.type.localeCompare(b.type)||pa-pb||clientA.localeCompare(clientB);
    if(sort==='responsible') return respA.localeCompare(respB)||pa-pb||clientA.localeCompare(clientB);
    if(sort==='postDate') return String(a.postDate||'').localeCompare(String(b.postDate||''))||pa-pb;
    if(sort==='internalDate') return String(a.internalDate||'').localeCompare(String(b.internalDate||''))||clientA.localeCompare(clientB);
    return pa-pb||clientA.localeCompare(clientB)||String(a.internalDate||'').localeCompare(String(b.internalDate||''));
  }
  filtered=[...filtered].sort(cmp); 
  return <section><h1>Kanban</h1><div className="filters"><PeriodFilters period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo}/>{isAdmin&&<label>Cliente<select value={company} onChange={e=>setCompany(e.target.value)}><option value="all">Todos</option>{companies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}{isAdmin&&<label>Responsável<select value={resp} onChange={e=>setResp(e.target.value)}><option value="all">Todos</option>{users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')).map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></label>}<label>Tipo de post<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label><label>Ordenar por<select value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">Prioridade</option><option value="client">Cliente</option><option value="type">Tipo de post</option>{isAdmin&&<option value="responsible">Responsável</option>}{isAdmin&&<option value="postDate">Data do post</option>}<option value="internalDate">Prazo</option></select></label><label className="check archive-check inline"><input type="checkbox" checked={archivedOnly} onChange={e=>setArchivedOnly(e.target.checked)}/><span>Mostrar só arquivados</span></label></div><div className="kanban">{allowed.map(s=><div className="col" key={s.id} style={{borderTopColor:s.color}}><h3><span style={{color:s.color}}>{s.name}</span><b>{filtered.filter(t=>t.status===s.id).length}</b></h3>{filtered.filter(t=>t.status===s.id).map(t=>{const company=companies.find(c=>c.id===t.companyId);const respUser=users.find(u=>u.id===t.responsibleId);return <button className={'kcard priority-'+priorityClass(t.internalDate)} key={t.id} onClick={()=>open(t.id)}><b className="k-title" title={t.title}>{t.title}</b><div className="k-meta"><small>Prazo: {fmtDate(t.internalDate)} • {priorityText(t.internalDate)}</small><span className="avatars"><AvatarMini value={company?.logo} label={company?.name}/><AvatarMini value={respUser?.avatar} label={respUser?.name}/></span></div></button>})}</div>)}</div></section> 
}
function ReadOnlyInstruction({title,text}){
  return <div className="readonly-instruction"><label>{title}</label><div className="instruction-box">{text?linkify(text):<span className="muted-note">Sem instruções.</span>}</div></div>
}

function PlanningPage({companies,setCompanies,users,tasks,createWeeklyTasks,open}){
  const [weekStart,setWeekStart]=useState(weekStartStr());
  const [editingTemplate,setEditingTemplate]=useState(null);
  const activeCompanies=companies.filter(c=>c.active);
  const weekEnd=weekEndStr(weekStart);
  const totalExpected=activeCompanies.reduce((acc,c)=>acc+(c.weeklyTemplate||[]).reduce((a,item)=>a+(Number(item.quantity)||0),0),0);
  const totalCreated=tasks.filter(t=>t.generatedWeek===weekStart).length;
  function saveTemplate(companyId, weeklyTemplate){
    setCompanies(companies.map(c=>c.id===companyId?{...c,weeklyTemplate}:c));
    setEditingTemplate(null);
  }
  function generateAll(){
    const pending=activeCompanies.filter(c=>{
      const expected=(c.weeklyTemplate||[]).reduce((a,item)=>a+(Number(item.quantity)||0),0);
      const created=tasks.filter(t=>t.companyId===c.id && t.generatedWeek===weekStart).length;
      return expected>0 && created===0;
    });
    if(!pending.length){ alert('Nenhum cliente pendente para esta semana.'); return; }
    const total=pending.reduce((acc,c)=>acc+(c.weeklyTemplate||[]).reduce((a,item)=>a+(Number(item.quantity)||0),0),0);
    if(!confirm(`Gerar ${total} tarefa(s) para ${pending.length} cliente(s) pendente(s)?`)) return;
    pending.forEach(c=>createWeeklyTasks(c.id,weekStart,false));
  }
  return <section>
    <div className="calendar-titlebar"><div><h1>Planejamento Semanal</h1><p>Gere remessas de tarefas por cliente a partir dos templates configurados.</p></div><button className="primary" onClick={generateAll}>Gerar todos pendentes</button></div>
    <div className="filters"><label>Semana começa em<input type="date" value={weekStart} onChange={e=>setWeekStart(weekStartStr(e.target.value))}/></label><div className="panel planning-summary"><small>Período</small><b>{fmtDate(weekStart)} a {fmtDate(weekEnd)}</b></div><div className="panel planning-summary"><small>Total previsto</small><b>{totalExpected}</b></div><div className="panel planning-summary"><small>Já geradas</small><b>{totalCreated}</b></div></div>
    <div className="client-grid compact-admin-grid planning-grid" style={{display:'flex',flexDirection:'column',gap:16}}>{activeCompanies.map(c=>{ const template=c.weeklyTemplate||[]; const expected=template.reduce((a,item)=>a+(Number(item.quantity)||0),0); const createdTasks=tasks.filter(t=>t.companyId===c.id && t.generatedWeek===weekStart); const created=createdTasks.length; return <div className="panel planning-card" key={c.id}><div className="mini-title"><AvatarMini value={c.logo} label={c.name}/><div><h2>{c.name}</h2><small>{expected} tarefa(s) previstas • {created} gerada(s)</small></div></div>{template.length?<div className="template-preview">{template.map(item=><small key={item.id||item.type}>{item.quantity||0}× {item.type} • {WEEK_DAYS.find(d=>d.value===Number(item.postDay))?.label||'Segunda'}</small>)}</div>:<p className="muted-note">Sem template semanal configurado.</p>}<div className="row-actions"><button className="primary" disabled={!expected} onClick={()=>createWeeklyTasks(c.id,weekStart,false)}>{created?'Gerar novamente':'Gerar semana'}</button><button onClick={()=>setEditingTemplate(c)}>{template.length?'Editar template':'Criar template'}</button>{createdTasks.length>0&&<button onClick={()=>open(createdTasks[0].id)}>Ver tarefas</button>}</div></div>})}</div>
    {editingTemplate&&<WeeklyTemplateEditor company={editingTemplate} users={users} save={saveTemplate} cancel={()=>setEditingTemplate(null)}/>} 
  </section>
}

function WeeklyTemplateEditor({company,users,save,cancel}){
  const [weeklyTemplate,setWeeklyTemplate]=useState(company.weeklyTemplate||[]);
  const teams=users.filter(u=>u.active&&(u.role==='team'||u.role==='admin'));
  function updateTemplate(id,patch){ setWeeklyTemplate(weeklyTemplate.map(item=>item.id===id?{...item,...patch}:item)); }
  function addTemplateItem(){ setWeeklyTemplate([...weeklyTemplate,{ id:crypto.randomUUID(), type:TASK_TYPES[0], quantity:1, responsibleId:teams[0]?.id||'', postDay:0, internalOffset:1, copyInstructions:'', editorInstructions:'' }]); }
  function removeTemplateItem(id){ setWeeklyTemplate(weeklyTemplate.filter(item=>item.id!==id)); }
  return <div className="modal-bg"><div className="modal company-modal"><div className="section-header"><div><h2>Template semanal</h2><p>{company.name}</p></div><button type="button" onClick={addTemplateItem}>+ Linha</button></div>{weeklyTemplate.length?weeklyTemplate.map(item=><div className="panel template-item" key={item.id}><div className="form-two"><label>Tipo<select value={item.type||TASK_TYPES[0]} onChange={e=>updateTemplate(item.id,{type:e.target.value})}>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label><label>Quantidade<input type="number" min="0" value={item.quantity??1} onChange={e=>updateTemplate(item.id,{quantity:Number(e.target.value)})}/></label></div><div className="form-two"><label>Responsável<select value={item.responsibleId||''} onChange={e=>updateTemplate(item.id,{responsibleId:e.target.value})}><option value="">Padrão do sistema</option>{teams.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Dia de postagem<select value={item.postDay??0} onChange={e=>updateTemplate(item.id,{postDay:Number(e.target.value)})}>{WEEK_DAYS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select></label></div><label>Prazo interno<input type="number" min="0" value={item.internalOffset??1} onChange={e=>updateTemplate(item.id,{internalOffset:Number(e.target.value)})}/><small>Quantos dias antes da postagem. Ex: 1 = um dia antes.</small></label><label>Instruções ao copy<textarea value={item.copyInstructions||''} onChange={e=>updateTemplate(item.id,{copyInstructions:e.target.value})} placeholder="Orientações padrão para o copy desta linha."/></label><label>Instruções ao editor<textarea value={item.editorInstructions||''} onChange={e=>updateTemplate(item.id,{editorInstructions:e.target.value})} placeholder="Orientações padrão para edição/design desta linha."/></label><div className="row-actions"><button type="button" onClick={()=>removeTemplateItem(item.id)}>Remover linha</button></div></div>):<p className="muted-note">Nenhuma linha de template. Clique em + Linha para criar a remessa semanal deste cliente.</p>}<div className="modal-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={()=>save(company.id,weeklyTemplate)}>Salvar template</button></div></div></div>
}

function TaskPage({task,tasks=[],companies,users,statuses,types,statusById,updateTask,addLog,back,open,effectiveUser,isAdmin}){ 
  if(!task) return <section><button onClick={back}>Voltar</button><h1>Tarefa não encontrada</h1></section>; 
  const company=companies.find(c=>c.id===task.companyId); 
  const clientTasks=[...(tasks||[])].filter(t=>t.companyId===task.companyId).sort((a,b)=>String(a.postDate||'').localeCompare(String(b.postDate||'')) || String(a.internalDate||'').localeCompare(String(b.internalDate||'')) || String(a.title||'').localeCompare(String(b.title||'')));
  const currentClientIndex=clientTasks.findIndex(t=>t.id===task.id);
  const previousClientTask=currentClientIndex>0?clientTasks[currentClientIndex-1]:null;
  const nextClientTask=currentClientIndex>=0&&currentClientIndex<clientTasks.length-1?clientTasks[currentClientIndex+1]:null;
  const links=(task.materialLinks||'').split('\n').map(x=>x.trim()).filter(Boolean); 
  const [slide,setSlide]=useState(0); 
  const [comment,setComment]=useState(''); 
  const [clientForm,setClientForm]=useState(null); 
  const isClient=effectiveUser.role==='client';
  const isTeam=effectiveUser.role==='team';
  const canAccess=isAdmin||task.startedAt; 
  const timeline=(task.logs||[]).filter(l=>!isClient||l.visibility==='client'||l.userId===effectiveUser.id).slice().sort((a,b)=>new Date(b.at)-new Date(a.at)); 
  const comments=timeline.filter(l=>l.type==='comment');
  const history=timeline.filter(l=>l.type!=='comment');
  const taskRef=useRef(task);
  useEffect(()=>{ taskRef.current=task; });
  function pauseTimer(logText='Timer pausado automaticamente ao sair da tarefa.'){
    const current=taskRef.current;
    if(!current?.startedAt || !isTeam || current.startedById!==effectiveUser.id) return;
    const patch=closeTimerPatch(current, now());
    if(!patch) return;
    updateTask(current.id, patch, logText);
  }
  useEffect(()=>{
    if(!isTeam || !task.startedAt || task.startedById!==effectiveUser.id) return;
    const interval=setInterval(()=>{
      updateTask(task.id,{timerHeartbeatAt:now()});
    },60000);
    const beforeUnload=()=>pauseTimer('Timer pausado automaticamente ao fechar a tela.');
    window.addEventListener('beforeunload', beforeUnload);
    return ()=>{
      clearInterval(interval);
      window.removeEventListener('beforeunload', beforeUnload);
      pauseTimer();
    };
  },[task.id, task.startedAt, task.startedById, isTeam, effectiveUser.id]);
  function handleTaskBack(){ pauseTimer('Timer pausado ao sair da tarefa.'); back(); }
  function goToClientTask(target){ if(!target) return; pauseTimer('Timer pausado ao trocar de tarefa.'); open(target.id); setSlide(0); }
  const hiddenTeam=isTeam&&!canAccess; 
  const showTeamProtected=!hiddenTeam && !isClient;
  const actionStyle=(statusId,solid=true)=>{ const color=statusById[statusId]?.color||'#e1b12c'; return solid?{background:color,borderColor:color,color:'#050505'}:{borderColor:color,color}; };
  function start(){
    const patch={startedAt:now(), startedById:effectiveUser.id, timerHeartbeatAt:now()};
    if(task.status==='aguardando'){
      const returnStatus = task.blockedFrom || task.previousWorkStatus || 'edicao';
      patch.status = returnStatus;
      patch.blockedFrom = null;
      updateTask(task.id,patch,`Tarefa reaberta para ${statusById[returnStatus]?.name||returnStatus}.`);
      return;
    }
    updateTask(task.id,patch,'Tarefa acessada.');
  } 
  function sendApproval(){ const elapsed=task.startedAt?Math.floor((Date.now()-new Date(task.startedAt).getTime())/1000):0; const patch={startedAt:null,startedById:null,timerHeartbeatAt:null,status:'aprovacao',previousWorkStatus:task.status}; if(task.status==='alteracao') patch.totalAlterSeconds=(task.totalAlterSeconds||0)+elapsed; else patch.totalEditSeconds=(task.totalEditSeconds||0)+elapsed; updateTask(task.id,patch,'Enviado para aprovação.'); } 
  function returnToCopy(){ const elapsed=task.startedAt?Math.floor((Date.now()-new Date(task.startedAt).getTime())/1000):0; const patch={startedAt:null,startedById:null,timerHeartbeatAt:null,status:'copy',previousWorkStatus:task.status}; if(task.status==='alteracao') patch.totalAlterSeconds=(task.totalAlterSeconds||0)+elapsed; else patch.totalEditSeconds=(task.totalEditSeconds||0)+elapsed; updateTask(task.id,patch,'Tarefa retornada para copy.'); } 
  function markWaiting(){
    const rawReason=prompt('Motivo do aguardando:');
    if(rawReason===null) return;

    const reason=String(rawReason||'').trim();
    const elapsed=task.startedAt?Math.floor((Date.now()-new Date(task.startedAt).getTime())/1000):0;
    const patch={startedAt:null,startedById:null,timerHeartbeatAt:null,status:'aguardando',blockedFrom:task.status};

    if(task.status==='alteracao') patch.totalAlterSeconds=(task.totalAlterSeconds||0)+elapsed;
    else patch.totalEditSeconds=(task.totalEditSeconds||0)+elapsed;

    if(reason){
      patch.extraLogs=[{
        id:crypto.randomUUID(),
        user:effectiveUser.name,
        userId:effectiveUser.id,
        type:'comment',
        visibility:'internal',
        at:now(),
        text:reason,
        resolved:false
      }];
    }

    updateTask(task.id,patch,reason?'Marcado como aguardando com comentário.':'Marcado como aguardando.');
  } 
  function approve(){ if(!clientForm?.art||!clientForm?.caption) return alert('Selecione artes/vídeos aprovados e legenda aprovada para aprovar.'); addLog(task.id,`Aprovação registrada. Artes/vídeos: ${clientForm?.art?'sim':'não'}; Legenda: ${clientForm?.caption?'sim':'não'}.`,'approval',isClient?'client':'internal'); updateTask(task.id,{status:'agendamento'},`${effectiveUser.name} aprovou. Status enviado para agendamento.`); setClientForm(null); } 
  function requestChange(){ const items=[]; if(clientForm?.artChange) items.push('Alterar arte/vídeo'); if(clientForm?.text) items.push('Alterar texto na arte/vídeo'); if(clientForm?.captionChange) items.push('Alterar legenda'); if(clientForm?.redo) items.push('Refazer o post'); if(!items.length) return alert('Selecione pelo menos uma opção de alteração.'); const desc=String(clientForm?.description||'').trim(); if(!desc) return alert('Descreva as alterações que você gostaria de aplicar.'); const text=`Solicitação de alteração\nItens marcados: ${items.join(', ')}\nDescrição: ${desc}`; const entry={id:crypto.randomUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'comment',visibility:isClient?'client':'internal',at:now(),text,resolved:false}; updateTask(task.id,{status:'alteracao',alterationCount:(task.alterationCount||0)+1,logs:[...(task.logs||[]),entry]}); setClientForm(null); }
  function reopenFromApproval(){ const nextStatus=task.previousWorkStatus||'edicao'; updateTask(task.id,{status:nextStatus,startedAt:now(),startedById:effectiveUser.id,timerHeartbeatAt:now()},`Tarefa reaberta para ${statusById[nextStatus]?.name||nextStatus}.`); }
  function reviewAgain(){ updateTask(task.id,{status:'aprovacao'},'Cliente voltou para revisão.'); } 
  function addComment(){ if(!comment.trim()) return; addLog(task.id,comment,'comment',isClient?'client':'internal'); setComment(''); }
  function resolveLog(logId){ updateTask(task.id,{logs:(task.logs||[]).map(l=>l.id===logId?{...l,resolved:!l.resolved,resolvedAt:!l.resolved?now():null,resolvedBy:!l.resolved?effectiveUser.name:null}:l)}); }
  return <section><div className="task-topbar task-topbar-split"><button onClick={handleTaskBack}>← Voltar</button><div className="task-nav-actions task-top-nav"><button disabled={!previousClientTask} onClick={()=>goToClientTask(previousClientTask)}>← Tarefa anterior</button><button disabled={!nextClientTask} onClick={()=>goToClientTask(nextClientTask)}>Próxima tarefa →</button></div></div><div className={'task-page '+(isClient?'client-task':'')}><div className="task-left"><div className="task-title">{isAdmin?<input className="task-title-input" value={task.title||''} onChange={e=>updateTask(task.id,{title:e.target.value})} aria-label="Nome da tarefa"/>:<h1>{task.title}</h1>}{!isClient&&<span style={{borderColor:statusById[task.status]?.color,color:statusById[task.status]?.color}}>{statusById[task.status]?.name}</span>}</div><div className="insta"><div className="insta-top"><AvatarMini value={company?.logo} label={company?.name}/><b>{company?.name}</b></div><div className="media-box adaptive-media-box">{links.length?<><Media url={links[Math.min(slide,links.length-1)]}/>{links.length>1&&<div className="slide-controls"><button onClick={()=>setSlide(Math.max(0,slide-1))}>‹</button><button onClick={()=>setSlide(Math.min(links.length-1,slide+1))}>›</button></div>}</>:<div className="empty-media">Sem material pronto ainda</div>}</div><InstagramIcons/><div className="insta-caption"><b>{company?.name}</b> <span>{task.caption}</span></div></div><div className="content-fields">{!isClient&&<>{isAdmin?<><label>Instruções ao copy<textarea value={task.copyInstructions||''} onChange={e=>updateTask(task.id,{copyInstructions:e.target.value})}/></label><label>Instruções ao editor<textarea value={task.editorInstructions||''} onChange={e=>updateTask(task.id,{editorInstructions:e.target.value})}/></label></>:<><ReadOnlyInstruction title="Instruções ao copy" text={task.copyInstructions||''}/><ReadOnlyInstruction title="Instruções ao editor" text={task.editorInstructions||''}/></>}</>}{(!isTeam || showTeamProtected || isClient)&&<><label>Copy<textarea disabled={isClient||isTeam} value={task.copy} onChange={e=>updateTask(task.id,{copy:e.target.value})}/></label><label>Legenda<textarea disabled={isClient||isTeam} value={task.caption} onChange={e=>updateTask(task.id,{caption:e.target.value})}/></label>{!isClient&&<label>Links de visualização<textarea disabled={false} value={task.materialLinks} onChange={e=>updateTask(task.id,{materialLinks:e.target.value})}/></label>}</>}</div></div><aside className="task-side">{!isClient&&<div className="panel panel-config"><h2>Configurações</h2><label>Cliente<div className="select-entity"><EntityLabel value={company?.logo} label={company?.name||'Empresa'}/><select disabled={!isAdmin} value={task.companyId} onChange={e=>updateTask(task.id,{companyId:e.target.value})}>{companies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div></label><label>Responsável<div className="select-entity"><EntityLabel value={users.find(u=>u.id===task.responsibleId)?.avatar} label={users.find(u=>u.id===task.responsibleId)?.name||'Responsável'}/><select disabled={!isAdmin} value={task.responsibleId} onChange={e=>updateTask(task.id,{responsibleId:e.target.value})}>{users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')).map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></div></label><label>Tipo<select disabled={!isAdmin} value={task.type} onChange={e=>updateTask(task.id,{type:e.target.value})}>{types.map(t=><option key={t}>{t}</option>)}</select></label><label>Status<div className="status-select" style={{borderColor:statusById[task.status]?.color||undefined}}>{statusDot(statusById[task.status])}<select disabled={!isAdmin} value={task.status} onChange={e=>updateTask(task.id,{status:e.target.value})}>{statuses.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></div></label><label className={'date-field '+priorityClass(task.internalDate)}>Prazo<input disabled={!isAdmin} type="date" value={task.internalDate||''} onChange={e=>updateTask(task.id,{internalDate:e.target.value})}/></label><label>Data do post<input disabled={!isAdmin} type="date" value={task.postDate||''} onChange={e=>updateTask(task.id,{postDate:e.target.value})}/></label></div>}{(isAdmin||showTeamProtected)&&<div className="panel panel-stats"><h2>Estatísticas</h2><p>Alterações: <b>{task.alterationCount||0}</b></p><p>Tempo geral: <b>{fmtSec((task.totalEditSeconds||0)+(task.totalAlterSeconds||0))}</b></p><p>Tempo em edição: <b>{fmtSec(task.totalEditSeconds)}</b></p><p>Tempo em alteração: <b>{fmtSec(task.totalAlterSeconds)}</b></p></div>}<div className="panel panel-actions"><h2>Ações</h2>{isTeam&&!canAccess&&['edicao','alteracao','aguardando'].includes(task.status)&&<button className="primary" onClick={start}>{task.status==='aguardando'?'Reabrir tarefa':'Acessar tarefa'}</button>}{isTeam&&!task.startedAt&&task.status==='aprovacao'&&<button className="primary" onClick={reopenFromApproval}>Reabrir tarefa</button>}{isTeam&&task.startedAt&&<div className="status-action-row" style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={actionStyle('copy')} onClick={returnToCopy}>Retornar ao copy</button><button style={actionStyle('aguardando')} onClick={markWaiting}>Marcar aguardando</button><button style={actionStyle('aprovacao')} onClick={sendApproval}>Enviar para aprovação</button></div>}{isAdmin&&<button onClick={()=>{ if(confirm(task.archived?'Desarquivar esta tarefa?':'Arquivar esta tarefa?')) updateTask(task.id,{archived:!task.archived}, task.archived?'Tarefa desarquivada.':'Tarefa arquivada.')}}>{task.archived?'Desarquivar':'Arquivar'}</button>}{(isClient||isAdmin)&&task.status==='aprovacao'&&<ClientApprovalForm form={clientForm} setForm={setClientForm} approve={approve} requestChange={requestChange} statusById={statusById}/>} {isClient&&['alteracao','agendamento'].includes(task.status)&&<button style={actionStyle('aprovacao')} onClick={reviewAgain}>Revisar novamente</button>} {isClient&&task.status==='aguardando'&&<p>Aguardando informações. Use os comentários se precisar responder.</p>}</div>{(!hiddenTeam||isAdmin||isClient)&&<div className="panel comments-panel"><h2>Comentários</h2><div className="comment-line"><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Adicionar comentário..."/><button onClick={addComment}>Enviar</button></div>{comments.length?comments.map(l=><div className={'log comment-log '+(l.resolved?'resolved':'')} key={l.id}><div className="log-head"><b>{l.user}</b><small>{new Date(l.at).toLocaleString('pt-BR')}</small>{!isClient&&<button onClick={()=>resolveLog(l.id)}>{l.resolved?'Reabrir':'Resolver'}</button>}</div><p>{linkify(l.text)}</p>{l.resolved&&<small className="resolved-note">Resolvido por {l.resolvedBy||'equipe'}{l.resolvedAt?' em '+new Date(l.resolvedAt).toLocaleString('pt-BR'):''}</small>}</div>):<p className="muted-note">Nenhum comentário ainda.</p>}{!isClient&&<details className="task-history"><summary>Histórico da tarefa <span>{history.length}</span></summary>{history.length?history.map(l=><div className="history-row" key={l.id}><small>{new Date(l.at).toLocaleString('pt-BR')}</small><p>{linkify(l.text)}</p><em>{l.user}</em></div>):<p className="muted-note">Nenhum histórico registrado.</p>}</details>}</div>}</aside></div></section> 
}
function InstagramIcons(){ return <div className="insta-icons insta-real-icons">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6c-1.7-1.9-4.4-2-6.2-.3L12 6.7 9.4 4.3C7.6 2.6 4.9 2.7 3.2 4.6c-1.8 2-1.6 5.1.4 7l8.4 7.8 8.4-7.8c2-1.9 2.2-5 .4-7Z"/></svg>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.7 8.2 9.2 9.2 0 0 1-3.7-.8L3 20l1.3-5.1a7.8 7.8 0 0 1-.8-3.4A8.4 8.4 0 0 1 12 3.3a8.4 8.4 0 0 1 9 8.2Z"/></svg>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 3 9.8 14.6M22 3l-7 19-5.2-7.4L2 11.2 22 3Z"/></svg>
  <svg className="save-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>
</div> }
function ClientApprovalForm({form,setForm,approve,requestChange,statusById}){ 
  const f=form||{}; 
  const F=(k,v)=>setForm({...f,[k]:v}); 
  const hasChange=!!(f.artChange||f.text||f.captionChange||f.redo);
  const buttonStyle=(statusId)=>{ const color=statusById?.[statusId]?.color||'#e1b12c'; return {background:color,borderColor:color,color:'#050505'}; };
  const canRequest=hasChange && String(f.description||'').trim().length>0;
  function toggleRedo(checked){
    if(checked){
      const ok=confirm('Tem certeza que deseja solicitar o refazimento do post? Essa opção indica uma alteração maior. Informe o motivo com detalhes na caixa de texto.');
      if(!ok) return F('redo',false);
    }
    F('redo',checked);
  }
  return <div className="client-actions"><h3>Aprovar</h3><label><input type="checkbox" checked={!!f.art} onChange={e=>F('art',e.target.checked)}/> Artes/vídeos aprovados</label><label><input type="checkbox" checked={!!f.caption} onChange={e=>F('caption',e.target.checked)}/> Legenda aprovada</label><button style={buttonStyle('agendamento')} onClick={approve}>Aprovar</button><h3>Solicitar alteração</h3><label><input type="checkbox" checked={!!f.artChange} onChange={e=>F('artChange',e.target.checked)}/> Alterar arte/vídeo</label><label><input type="checkbox" checked={!!f.text} onChange={e=>F('text',e.target.checked)}/> Alterar texto na arte/vídeo</label><label><input type="checkbox" checked={!!f.captionChange} onChange={e=>F('captionChange',e.target.checked)}/> Alterar legenda</label><label><input type="checkbox" checked={!!f.redo} onChange={e=>toggleRedo(e.target.checked)}/> <span className="danger-text">Refazer o post</span></label><textarea value={f.description||''} onChange={e=>F('description',e.target.value)} placeholder="Descreva as alterações que você gostaria de aplicar"/><button style={canRequest?buttonStyle('alteracao'):undefined} disabled={!canRequest} onClick={requestChange}>Solicitar alteração</button>{hasChange&&!canRequest&&<small>Descreva o motivo para liberar a solicitação.</small>}</div> 
}
function DriveAdaptiveMedia({url}){
  const [fallback,setFallback]=useState(false);
  if(fallback) return <iframe className="drive-fallback-frame" title="preview" src={drivePreview(url)} allow="autoplay"/>;
  return <img className="media-fit-image" src={driveDirect(url)} onError={()=>setFallback(true)} alt="Prévia do material"/>;
}
function Media({url}){ 
  const direct=driveDirect(url); const lower=(url||'').toLowerCase(); const isImg=/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower); const isVid=/\.(mp4|webm|mov)(\?|$)/.test(lower); const isDrive=(url||'').includes('drive.google.com'); 
  return <div className="media-inner">{isDrive?<DriveAdaptiveMedia url={url}/>:isVid?<><video className="media-fit-image" muted playsInline loop autoPlay src={direct}/><a className="media-open media-open-overlay" target="_blank" href={direct} aria-label="Abrir vídeo em nova aba">↗</a></>:isImg?<img className="media-fit-image" src={direct} alt="Prévia do material"/>:<a className="media-open outside" target="_blank" href={url}>Abrir material</a>}</div> 
}
function CompaniesPage({companies,setCompanies,tasks=[],setTasks=()=>{},users=[],setUsers=()=>{}}){
  const [editing,setEditing]=useState(null);
  const [sort,setSort]=useState('created');
  const [showArchived,setShowArchived]=useState(false);
  const visibleCompanies=companies.filter(c=>showArchived || c.active!==false);
  const sortedCompanies=sortEntities(visibleCompanies,sort,c=>c.name);
  function save(c){
    const exists=companies.some(x=>x.id===c.id);
    const data={...c,id:c.id||slug(c.name)||crypto.randomUUID(),createdAt:c.createdAt||now(),active:c.active!==false};
    setCompanies(exists?companies.map(x=>x.id===data.id?data:x):[...companies,data]);
    setEditing(null);
  }
  function archiveCompany(c){
    if(c.active===false){
      setCompanies(companies.map(x=>x.id===c.id?{...x,active:true}:x));
      setEditing(null);
      return;
    }
    if(!confirm(`Arquivar a empresa "${c.name}"? Ela sairá das listas padrão e do planejamento.`)) return;
    if(confirm('Arquivar também tarefas desta empresa?')) setTasks(tasks.map(t=>t.companyId===c.id?{...t,archived:true}:t));
    if(confirm('Arquivar também responsáveis vinculados a esta empresa?')) setUsers(users.map(u=>u.role==='client'&&(u.companyIds||[]).includes(c.id)?{...u,active:false}:u));
    setCompanies(companies.map(x=>x.id===c.id?{...x,active:false}:x));
    setEditing(null);
  }
  function deleteCompany(c){
    if(tasks.some(t=>t.companyId===c.id)) return alert('Esta empresa possui tarefas vinculadas. Arquive a empresa para preservar o histórico.');
    if(!confirm(`Excluir permanentemente a empresa "${c.name}"?`)) return;
    setCompanies(companies.filter(x=>x.id!==c.id));
    setEditing(null);
  }
  return <div className="settings-section"><div className="section-header"><h2>Empresas</h2><div className="settings-toolbar"><label className="toggle-archived"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Mostrar arquivadas</label><SortControl value={sort} setValue={setSort} options={[{value:'created',label:'Data de criação'},{value:'name',label:'Nome'}]}/><button className="primary" onClick={()=>setEditing({id:'',name:'',instagram:'',logo:'',entryDate:'',active:true,createdAt:now()})}>+ Nova empresa</button></div></div><div className="client-grid compact-admin-grid" style={{display:'flex',flexDirection:'column',gap:12}}>{sortedCompanies.map(c=><div className={'panel '+(c.active===false?'archived-card':'')} key={c.id}><div className="mini-title"><AvatarMini value={c.logo} label={c.name}/><div><h2>{c.name}</h2><small>{c.instagram || 'Sem Instagram'} {c.active===false?'• Arquivada':''}</small></div></div><div className="row-actions"><button onClick={()=>setEditing(c)}>Editar</button></div></div>)}</div>{editing&&<CompanyEditor c={editing} users={users} save={save} cancel={()=>setEditing(null)} onArchive={archiveCompany} onDelete={deleteCompany}/>}</div>
}
function ClientUsersPage({users,setUsers,companies,statuses}){
  const [editing,setEditing]=useState(null);
  const [sort,setSort]=useState('company');
  const [showArchived,setShowArchived]=useState(false);
  const clients=users.filter(u=>u.role==='client' && (showArchived || u.active!==false));
  const sortedClients=sortEntities(clients,sort,u=>{
    if(sort==='company') return (u.companyIds||[]).map(id=>companies.find(c=>c.id===id)?.name||'').filter(Boolean).join(' ') || 'zzzz sem empresa';
    return u.name;
  });
  function archiveClient(u){
    if(u.active===false){ setUsers(users.map(x=>x.id===u.id?{...x,active:true}:x)); setEditing(null); return; }
    if(!confirm(`Arquivar o responsável "${u.name}"?`)) return;
    setUsers(users.map(x=>x.id===u.id?{...x,active:false}:x));
    setEditing(null);
  }
  function excludeClient(u){
    if(!confirm(`Excluir permanentemente o responsável "${u.name}"? Essa ação remove o cadastro do painel.`)) return;
    setUsers(users.filter(x=>x.id!==u.id));
    setEditing(null);
  }
  async function save(u){
    const exists=users.some(x=>x.id===u.id);
    try{
      let data={...u,role:'client',createdAt:u.createdAt||now(),visibleStatuses:u.visibleStatuses||CLIENT_DEFAULT,active:u.active!==false};
      if(isSupabaseConfigured && !exists){
        data=await createAuthBackedAppUser(data);
      } else {
        data={...data,id:data.id||crypto.randomUUID()};
      }
      setUsers(exists?users.map(x=>x.id===data.id?data:x):[...users,data]);
      setEditing(null);
    }catch(err){
      console.error(err);
      alert('Não foi possível criar o acesso deste responsável: '+(err.message||err));
    }
  }
  return <div className="settings-section"><div className="section-header"><h2>Responsáveis</h2><div className="settings-toolbar"><label className="toggle-archived"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Mostrar arquivados</label><SortControl value={sort} setValue={setSort} options={[{value:'company',label:'Empresa'},{value:'name',label:'Nome'},{value:'created',label:'Data de criação'}]}/><button className="primary" onClick={()=>setEditing({role:'client',name:'',email:'',password:'123456',active:true,avatar:'',companyIds:[],visibleStatuses:CLIENT_DEFAULT,createdAt:now()})}>+ Novo responsável</button></div></div><div className="client-grid compact-admin-grid" style={{display:'flex',flexDirection:'column',gap:12}}>{sortedClients.map(u=><div className={'panel '+(u.active===false?'archived-card':'')} key={u.id}><div className="mini-title"><AvatarMini value={u.avatar} label={u.name}/><div><h2>{u.name}</h2><small className="linked-companies">{(u.companyIds||[]).map(id=>companies.find(c=>c.id===id)?.name).filter(Boolean).join(', ') || 'Sem empresa'} {u.active===false?'• Arquivado':''}</small></div></div><div className="row-actions"><button onClick={()=>setEditing(u)}>Editar</button></div></div>)}</div>{editing&&<UserEditor u={editing} companies={companies} statuses={statuses} save={save} cancel={()=>setEditing(null)} clientMode onArchive={archiveClient} onDelete={excludeClient}/>}</div>
}
function TeamPage({users,setUsers,statuses,tasks=[],currentUser=null}){
  const [editing,setEditing]=useState(null);
  const [sort,setSort]=useState('role');
  const [showArchived,setShowArchived]=useState(false);
  const [openNotif,setOpenNotif]=useState({});
  const people=users.filter(u=>(u.role==='team'||u.role==='admin') && (showArchived || u.active!==false));
  const sortedPeople=sortEntities(people,sort,u=>u.name);
  const events=NOTIFICATION_EVENTS;
  function archiveTeamUser(u){
    if(u.id===currentUser?.id) return alert('Você não pode arquivar seu próprio usuário.');
    if(u.active===false){ setUsers(users.map(x=>x.id===u.id?{...x,active:true}:x)); setEditing(null); return; }
    if(!confirm(`Arquivar o usuário "${u.name}"?`)) return;
    setUsers(users.map(x=>x.id===u.id?{...x,active:false}:x));
    setEditing(null);
  }
  function excludeTeamUser(u){
    if(u.role==='admin') return alert('Admins não podem ser excluídos. Arquive apenas se necessário.');
    if(!confirm(`Excluir permanentemente o usuário "${u.name}"? Essa ação remove o cadastro do painel.`)) return;
    setUsers(users.filter(x=>x.id!==u.id));
    setEditing(null);
  }
  function canEditNotifications(u){ return !(u.role==='admin' && currentUser?.id && u.id!==currentUser.id); }
  function toggleNotif(id){ setOpenNotif(prev=>({...prev,[id]:!prev[id]})); }
  function updateUserPrefs(userId,patch){ setUsers(users.map(x=>x.id===userId?{...x,...patch}:x)); }
  async function save(u){
    const role=u.role||'team';
    const exists=users.some(x=>x.id===u.id);
    try{
      let data={...u,role,createdAt:u.createdAt||now(),visibleStatuses:role==='admin'?[]:(u.visibleStatuses||TEAM_DEFAULT),active:u.active!==false};
      if(isSupabaseConfigured && !exists){
        data=await createAuthBackedAppUser(data);
      } else {
        data={...data,id:data.id||crypto.randomUUID()};
      }
      setUsers(exists?users.map(x=>x.id===data.id?data:x):[...users,data]);
      setEditing(null);
    }catch(err){
      console.error(err);
      alert('Não foi possível criar o acesso deste usuário: '+(err.message||err));
    }
  }
  return <div className="settings-section"><div className="section-header"><h2>Equipe e admins</h2><div className="settings-toolbar"><label className="toggle-archived"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Mostrar arquivados</label><SortControl value={sort} setValue={setSort} options={[{value:'role',label:'Tipo de usuário'},{value:'name',label:'Nome'},{value:'created',label:'Data de criação'}]}/><button className="primary" onClick={()=>setEditing({role:'team',name:'',email:'',password:'123456',active:true,avatar:'',title:'',visibleStatuses:TEAM_DEFAULT,createdAt:now()})}>+ Novo usuário</button></div></div><div className="client-grid compact-admin-grid" style={{display:'flex',flexDirection:'column',gap:12}}>{sortedPeople.map(u=>{
    const isOpen=!!openNotif[u.id];
    const canEdit=canEditNotifications(u);
    return <div className={'panel team-user-panel '+(u.active===false?'archived-card':'')} key={u.id}>
      <div className="mini-title"><AvatarMini value={u.avatar} label={u.name}/><div><h2>{u.name}</h2><small>{u.role==='admin'?'Admin':(u.title||'Equipe')} {u.active===false?'• Arquivado':''}</small></div></div>
      <div className="row-actions"><button onClick={()=>setEditing(u)}>Editar</button><button onClick={()=>toggleNotif(u.id)}>{isOpen?'Minimizar notificações':'Configurar notificações'}</button></div>
      {isOpen&&<div className="team-notification-box">
        {!canEdit&&<p className="muted admin-lock-note">Notificações de outro admin não podem ser alteradas.</p>}
        <div className="notification-prefs-grid">
          <div><h3>Eventos</h3><div className="checks one-col compact-checks-v3">{events.map(ev=>{
            const cur=u.notificationPrefs||events;
            return <label key={ev}><input type="checkbox" disabled={!canEdit} checked={cur.includes(ev)} onChange={e=>{if(!canEdit) return; const next=e.target.checked?[...new Set([...cur,ev])]:cur.filter(x=>x!==ev); updateUserPrefs(u.id,{notificationPrefs:next});}}/>{ev}</label>
          })}</div></div>
          <div><h3>Status que geram notificação</h3><div className="checks one-col status-notify-list compact-checks-v3">{statuses.map(st=><label key={st.id}><input type="checkbox" disabled={!canEdit} checked={(u.notificationStatusPrefs?.[st.id]??true)} onChange={e=>{if(!canEdit) return; const cur=u.notificationStatusPrefs||{}; updateUserPrefs(u.id,{notificationStatusPrefs:{...cur,[st.id]:e.target.checked}});}}/><span className="status-dot" style={{background:st.color}}></span>{st.name}</label>)}</div></div>
        </div>
      </div>}
    </div>
  })}</div>{editing&&<UserEditor u={editing} statuses={statuses} save={save} cancel={()=>setEditing(null)} currentUser={currentUser} onArchive={archiveTeamUser} onDelete={excludeTeamUser}/>}</div>
}
function CompanyEditor({c,users=[],save,cancel,onArchive,onDelete}){
  const [f,setF]=useState(c);
  const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
  const isExisting=!!f.id;
  return <div className="modal-bg"><div className="modal"><h2>Empresa</h2><label>Nome<input value={f.name} onChange={e=>set('name',e.target.value)}/></label><label>Instagram<input value={f.instagram} onChange={e=>set('instagram',e.target.value)}/></label><label>Logo ou link de imagem<input value={f.logo} onChange={e=>set('logo',e.target.value)} placeholder="Inicial, URL pública ou link do Drive"/><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,v=>set('logo',v),`companies/${f.id||slug(f.name)||'pending'}`)}/></label><label>Entrada<input type="date" value={f.entryDate||''} onChange={e=>set('entryDate',e.target.value)}/></label>{isExisting&&<div className="danger-zone"><h3>Zona de risco</h3><p>Use arquivar para esconder sem perder histórico. Excluir remove o cadastro do painel.</p><div className="danger-zone-actions"><button onClick={()=>onArchive?.(f)}>{f.active===false?'Restaurar empresa':'Arquivar empresa'}</button><button className="danger-button" onClick={()=>onDelete?.(f)}>Excluir empresa</button></div></div>}<div className="modal-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={async()=>await save(f)}>Salvar</button></div></div></div>
}
function UserEditor({u,companies=[],statuses,save,cancel,clientMode=false,currentUser=null,onArchive=null,onDelete=null}){
  const [f,setF]=useState(u);
  const [uploading,setUploading]=useState(false);
  const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
  const isAdminRole=f.role==='admin';
  const editingOtherAdmin = !clientMode && u?.id && u.role==='admin' && currentUser?.id && u.id!==currentUser.id;
  const isExisting=!!f.id;
  const canArchive = isExisting && (!currentUser?.id || f.id!==currentUser.id);
  const canDelete = (isExisting && clientMode) || (isExisting && f.role!=='admin');
  function toggleVisibleStatus(id,checked){
    const current=f.visibleStatuses||[];
    set('visibleStatuses', checked ? [...new Set([...current,id])] : current.filter(x=>x!==id));
  }
  async function uploadUserAvatar(e){
    const file=e.target.files?.[0];
    if(!file) return;
    try{
      setUploading(true);
      const folder=f.id?`users/${f.id}`:'users/pending';
      const url=await uploadImageToSupabase(file,folder);
      set('avatar',url);
      if(isSupabaseConfigured && f.id){
        const { error } = await supabase.from('profiles').update({ avatar_url:url }).eq('id',f.id);
        if(error) throw error;
      }
    }catch(err){
      console.error(err);
      alert('Não foi possível salvar a foto no Supabase: '+(err.message||err));
    }finally{
      setUploading(false);
    }
  }
  return <div className="modal-bg"><div className="modal"><h2>{clientMode?'Responsável':'Usuário'}</h2>
    {!clientMode&&<label>Tipo de usuário<select value={f.role||'team'} disabled={editingOtherAdmin} onChange={e=>set('role',e.target.value)}><option value="team">Equipe</option><option value="admin">Admin</option></select>{editingOtherAdmin&&<small>Permissões de outro admin não podem ser alteradas.</small>}</label>}
    <label>Nome<input value={f.name} onChange={e=>set('name',e.target.value)}/></label>
    <label>Cargo<input value={f.title||''} onChange={e=>set('title',e.target.value)} placeholder={clientMode?'Responsável':'Designer, Editor, Admin...'}/></label>
    <label>Login<input value={f.email} onChange={e=>set('email',e.target.value)}/></label>
    <label>Senha<input value={f.password} onChange={e=>set('password',e.target.value)}/></label>
    <label>Foto/avatar<input value={f.avatar} onChange={e=>set('avatar',e.target.value)} placeholder="Inicial, URL ou upload"/><input type="file" accept="image/*" onChange={uploadUserAvatar}/>{uploading&&<small>Enviando imagem...</small>}</label>
    {clientMode&&<><h3>Empresas vinculadas</h3><div className="arg-linked-company-list-v2">{companies.map(c=><label className="arg-linked-company-row-v2" key={c.id}><input type="checkbox" checked={(f.companyIds||[]).includes(c.id)} onChange={e=>set('companyIds',e.target.checked?[...(f.companyIds||[]),c.id]:(f.companyIds||[]).filter(x=>x!==c.id))}/><AvatarMini value={c.logo} label={c.name}/><span>{c.name}</span></label>)}</div></>}
    {!isAdminRole&&<><h3>Status visíveis</h3><StatusVisibilityChecks statuses={statuses} selected={f.visibleStatuses||[]} onToggle={toggleVisibleStatus}/></>}
    {isExisting&&<div className="danger-zone"><h3>Zona de risco</h3><p>Arquivar esconde o cadastro sem apagar histórico. Excluir remove do painel.</p><div className="danger-zone-actions">{canArchive?<button onClick={()=>onArchive?.(f)}>{f.active===false?'Restaurar usuário':'Arquivar usuário'}</button>:<button disabled>Arquivar usuário</button>}{canDelete?<button className="danger-button" onClick={()=>onDelete?.(f)}>Excluir usuário</button>:<button className="danger-button" disabled>Excluir usuário</button>}</div>{!canArchive&&<small>Você não pode arquivar seu próprio usuário.</small>}{isAdminRole&&<small>Admins não podem ser excluídos.</small>}</div>}
    <div className="modal-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={async()=>await save(f)}>Salvar</button></div>
  </div></div>
}
function SettingsPage({statuses,setStatuses,tasks,setTasks,companies,setCompanies,users,setUsers,system,setSystem,reset,currentUser=null}){ 
  const [tab,setTab]=useState('status'); 
  const [editing,setEditing]=useState(null); 
  function del(s){ if(tasks.some(t=>t.status===s.id)) return alert('Existem tarefas usando este status. Mova essas tarefas antes de excluir.'); setStatuses(statuses.filter(x=>x.id!==s.id)); } 
  function save(s){ const next={...s,id:s.id||slug(s.name)}; setStatuses(statuses.some(x=>x.id===next.id)?statuses.map(x=>x.id===next.id?next:x):[...statuses,next]); setEditing(null); } 
  function moveStatus(index,direction){ const target=index+direction; if(target<0||target>=statuses.length) return; const next=[...statuses]; [next[index],next[target]]=[next[target],next[index]]; setStatuses(next); } 
  const tabs=[['status','Status'],['companies','Empresas'],['clients','Responsáveis'],['team','Equipe'],['general','Geral']];
  return <section><h1>Configurações</h1><div className="settings-tabs">{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>{tab==='status'&&<div className="settings-section"><div className="section-header"><h2>Status</h2><button className="primary" onClick={()=>setEditing({id:'',name:'',color:'#ffffff',active:true,final:false})}>+ Novo status</button></div><div className="client-grid compact-admin-grid status-grid" style={{display:'flex',flexDirection:'column',gap:12}}>{statuses.map((s,i)=><div className="panel" key={s.id} style={{borderLeft:`4px solid ${s.color}`,borderTop:'1px solid rgba(225,177,44,.25)'}}><h2>{s.name}</h2><small>{tasks.filter(t=>t.status===s.id).length} tarefa(s)</small><div className="row-actions"><button onClick={()=>moveStatus(i,-1)} disabled={i===0}>↑ Subir</button><button onClick={()=>moveStatus(i,1)} disabled={i===statuses.length-1}>↓ Descer</button><button onClick={()=>setEditing(s)}>Editar</button><button onClick={()=>del(s)}>Excluir</button></div></div>)}</div>{editing&&<StatusEditor s={editing} save={save} cancel={()=>setEditing(null)}/>}</div>}{tab==='companies'&&<CompaniesPage companies={companies} setCompanies={setCompanies} tasks={tasks} setTasks={setTasks} users={users} setUsers={setUsers}/>} {tab==='clients'&&<ClientUsersPage users={users} setUsers={setUsers} companies={companies} statuses={statuses}/>} {tab==='team'&&<TeamPage users={users} setUsers={setUsers} statuses={statuses} tasks={tasks} currentUser={currentUser}/>} {tab==='general'&&<GeneralSettings system={system} setSystem={setSystem} reset={reset}/>}</section> 
}
function NotificationSettings({users,setUsers,statuses,currentUser=null}){
  const events=NOTIFICATION_EVENTS;
  const editableUsers=sortEntities(users.filter(u=>u.role!=='client'),'role',u=>u.name);
  const [openIds,setOpenIds]=useState({});
  function toggleOpen(id){ setOpenIds(prev=>({...prev,[id]:!prev[id]})); }
  function roleLabel(role){ return role==='admin'?'Admin':'Equipe'; }
  function canEditNotifications(u){ return !(u.role==='admin' && currentUser?.id && u.id!==currentUser.id); }
  return <div className="settings-section"><h2>Notificações</h2><p className="muted">Clientes não recebem notificações por enquanto. Configure apenas admins e equipe.</p><div className="client-grid compact-admin-grid notification-accordion" style={{display:'flex',flexDirection:'column',gap:12}}>{editableUsers.map(u=>{
    const isOpen=!!openIds[u.id];
    const canEdit=canEditNotifications(u);
    return <div className="panel notification-user-panel" key={u.id}>
      <div className="notification-user-head">
        <div className="mini-title"><AvatarMini value={u.avatar} label={u.name}/><div><h2>{u.name}</h2><small>{roleLabel(u.role)} {u.active===false?'• Desativado':''}</small></div></div>
        <button onClick={()=>toggleOpen(u.id)}>{isOpen?'Minimizar':'Abrir'}</button>
      </div>
      {isOpen&&<>
        {!canEdit&&<p className="muted admin-lock-note">Notificações de outro admin não podem ser alteradas.</p>}
        <div className="notification-prefs-grid" style={{display:'grid',gridTemplateColumns:'minmax(280px,1fr) minmax(280px,1fr)',gap:28,alignItems:'start'}}>
          <div><h3>Eventos</h3><div className="checks one-col">{events.map(ev=><label key={ev}><input type="checkbox" disabled={!canEdit} checked={(u.notificationPrefs||events).includes(ev)} onChange={e=>{if(!canEdit) return; const cur=u.notificationPrefs||events; const next=e.target.checked?[...new Set([...cur,ev])]:cur.filter(x=>x!==ev); setUsers(users.map(x=>x.id===u.id?{...x,notificationPrefs:next}:x));}}/>{ev}</label>)}</div></div>
          <div><h3>Status que geram notificação</h3><div className="checks one-col status-notify-list">{statuses.map(st=><label key={st.id}><input type="checkbox" disabled={!canEdit} checked={(u.notificationStatusPrefs?.[st.id]??true)} onChange={e=>{if(!canEdit) return; const cur=u.notificationStatusPrefs||{}; setUsers(users.map(x=>x.id===u.id?{...x,notificationStatusPrefs:{...cur,[st.id]:e.target.checked}}:x));}}/><span className="status-dot" style={{background:st.color}}></span>{st.name}</label>)}</div></div>
        </div>
      </>}
    </div>
  })}</div></div>
}
function StatusEditor({s,save,cancel}){ const [f,setF]=useState(s); const set=(k,v)=>setF({...f,[k]:v}); return <div className="modal-bg"><div className="modal"><h2>Status</h2><label>Nome<input value={f.name} onChange={e=>set('name',e.target.value)}/></label><label>Cor<input type="color" value={f.color} onChange={e=>set('color',e.target.value)}/></label><label><input type="checkbox" checked={f.active} onChange={e=>set('active',e.target.checked)}/> Ativo</label><label><input type="checkbox" checked={f.final} onChange={e=>set('final',e.target.checked)}/> Conta como finalizado</label><button onClick={cancel}>Cancelar</button><button className="primary" onClick={async()=>await save(f)}>Salvar</button></div></div> }

function GeneralSettings({system,setSystem,reset}){
  const [f,setF]=useState(system||{logo:'',title:'Painel de Aprovação'});
  const set=(k,v)=>setF({...f,[k]:v});
  return <div className="settings-section"><div className="panel general-panel"><h2>Geral</h2>
    <h3>Painel interno</h3>
    <label>Texto do painel<input value={f.title||''} onChange={e=>set('title',e.target.value)} placeholder="Painel de Aprovação"/></label>
    <label>Logo do sistema<input value={f.logo||''} onChange={e=>set('logo',e.target.value)} placeholder="URL, link do Drive ou upload"/><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,v=>set('logo',v),'system/logo')}/></label>
    <label>Favicon do navegador<input value={f.favicon||''} onChange={e=>set('favicon',e.target.value)} placeholder="URL, link do Drive ou upload"/><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,v=>set('favicon',v),'system/favicon')}/><small>Ícone pequeno que aparece na aba do navegador.</small></label>
    <h3>Tela de login</h3>
    <label>Título da tela de login<input value={f.loginTitle||''} onChange={e=>set('loginTitle',e.target.value)} placeholder="Painel de Aprovação"/></label>
    <label>Texto de apoio da tela de login<input value={f.loginSubtitle||''} onChange={e=>set('loginSubtitle',e.target.value)} placeholder="Entre com seu acesso."/></label>
    <label>Logo da tela de login<input value={f.loginLogo||''} onChange={e=>set('loginLogo',e.target.value)} placeholder="URL, link do Drive ou upload. Se vazio, usa a logo do sistema."/><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,v=>set('loginLogo',v),'system/login')}/></label>
    <div className="row-actions"><button onClick={()=>setF(system)}>Cancelar</button><button className="primary" onClick={()=>setSystem(f)}>Salvar configurações</button></div>
    <div className="danger-zone"><h3>Zona de risco</h3><p>Use esta opção apenas em ambiente de teste ou com certeza absoluta.</p><button onClick={reset}>Resetar demo</button></div>
  </div></div>
}

function NotificationsPage({notifications,setNotifications,open,tasks,user}){ 
  const [tab,setTab]=useState('open'); 
  const list=notifications.filter(n=>(!n.userId||n.userId===user.id)).filter(n=>tab==='done'?n.done:!n.done); 
  function done(id){ setNotifications(notifications.map(n=>n.id===id?{...n,done:true}:n)); } 
  return <section><h1>Notificações</h1><div className="filters"><button className={tab==='open'?'primary':''} onClick={()=>setTab('open')}>Pendentes</button><button className={tab==='done'?'primary':''} onClick={()=>setTab('done')}>Concluídas</button></div><div className="notifications-list">{list.length?list.map(n=><div className="panel notification-item" key={n.id}><small>{new Date(n.at).toLocaleString('pt-BR')}</small><p>{n.text}</p><div className="row-actions"><button onClick={()=>open(n.taskId)}>Abrir tarefa</button>{!n.done&&<button className="primary" onClick={()=>done(n.id)}>Concluir notificação</button>}</div></div>):<div className="panel"><p>Nenhuma notificação aqui.</p></div>}</div></section> 
}



const ARGOS_ROUND43_MOBILE_VIDEO_DATE_CSS = `
/* Round 43: polimento final mobile: vídeo sem controles nativos gigantes e datas alinhadas */
.media-box.adaptive-media-box .media-inner{position:relative!important;}
.media-box.adaptive-media-box video.media-fit-image::-webkit-media-controls,
.media-box.adaptive-media-box video.media-fit-image::-webkit-media-controls-panel,
.media-box.adaptive-media-box video.media-fit-image::-webkit-media-controls-enclosure,
.media-box.adaptive-media-box video.media-fit-image::-webkit-media-controls-overlay-play-button{
  display:none!important;
  opacity:0!important;
  pointer-events:none!important;
}
.media-box.adaptive-media-box video.media-fit-image{
  pointer-events:none!important;
}
.media-box.adaptive-media-box .media-open-overlay{
  position:absolute!important;
  right:12px!important;
  top:12px!important;
  z-index:3!important;
  width:42px!important;
  height:42px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  border-radius:6px!important;
  background:rgba(0,0,0,.62)!important;
  color:#fff!important;
  text-decoration:none!important;
  font-size:24px!important;
  line-height:1!important;
}
.panel-config label>input[type="date"]{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  height:42px!important;
  min-height:42px!important;
  max-height:42px!important;
  box-sizing:border-box!important;
  display:block!important;
  margin:0!important;
  padding:0 12px!important;
  line-height:42px!important;
  text-align:left!important;
  text-align-last:left!important;
  -webkit-appearance:none!important;
  appearance:none!important;
}
.panel-config label>input[type="date"]::-webkit-date-and-time-value{
  text-align:left!important;
  margin:0!important;
  min-height:42px!important;
  line-height:42px!important;
}
.panel-config label>input[type="date"]::-webkit-calendar-picker-indicator{
  margin-left:auto!important;
}
@media (max-width:760px){
  .panel-config label>input[type="date"]{
    width:100%!important;
    height:42px!important;
    min-height:42px!important;
    max-height:42px!important;
    padding:0 12px!important;
    text-align:left!important;
    text-align-last:left!important;
  }
  .panel-config label>input[type="date"]::-webkit-date-and-time-value{
    text-align:left!important;
    line-height:42px!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style43 = document.getElementById('argos-round43-mobile-video-date');
  if (!style43) {
    style43 = document.createElement('style');
    style43.id = 'argos-round43-mobile-video-date';
    document.head.appendChild(style43);
  }
  style43.textContent = ARGOS_ROUND43_MOBILE_VIDEO_DATE_CSS;
}


const ARGOS_ROUND44_MOBILE_POLISH_CSS = `
/* Round 44: calendário mobile + notificações responsivas */
.notification-prefs-grid{
  min-width:0!important;
}
.notification-prefs-grid > div{
  min-width:0!important;
}
.notification-prefs-grid .checks label,
.notification-prefs-grid .status-notify-list label{
  min-width:0!important;
  max-width:100%!important;
  white-space:normal!important;
  overflow-wrap:anywhere!important;
  word-break:normal!important;
}
.notification-prefs-grid h3{
  white-space:normal!important;
  overflow-wrap:anywhere!important;
}
@media (max-width:760px){
  .calendar-titlebar{
    display:flex!important;
    align-items:flex-start!important;
    justify-content:space-between!important;
    gap:12px!important;
    flex-wrap:wrap!important;
  }
  .calendar-titlebar .view-tabs{
    margin-left:auto!important;
    display:flex!important;
    gap:6px!important;
    flex-wrap:nowrap!important;
    justify-content:flex-end!important;
  }
  .calendar-layout{
    display:flex!important;
    flex-direction:column!important;
    gap:16px!important;
  }
  .calendar-layout .calendar-main{
    order:1!important;
    width:100%!important;
    min-width:0!important;
  }
  .calendar-layout .legend{
    order:2!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    overflow:visible!important;
  }
  .notification-prefs-grid{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:18px!important;
  }
  .notification-prefs-grid .checks.one-col,
  .notification-prefs-grid .status-notify-list{
    display:flex!important;
    flex-direction:column!important;
    gap:8px!important;
    width:100%!important;
  }
  .notification-prefs-grid .checks label,
  .notification-prefs-grid .status-notify-list label{
    display:flex!important;
    align-items:center!important;
    gap:8px!important;
    line-height:1.25!important;
    font-size:14px!important;
  }
}
@media (max-width:520px){
  .calendar-titlebar h1{width:100%!important;}
  .calendar-titlebar .view-tabs{
    width:100%!important;
    justify-content:flex-start!important;
    margin-left:0!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style44 = document.getElementById('argos-round44-mobile-polish');
  if (!style44) {
    style44 = document.createElement('style');
    style44.id = 'argos-round44-mobile-polish';
    document.head.appendChild(style44);
  }
  style44.textContent = ARGOS_ROUND44_MOBILE_POLISH_CSS;
}



const ARGOS_ROUND50_TEAM_NOTIFS_BRAND_CSS = `
/* Round 50: notificações dentro de Equipe + logo mais forte */
@media (min-width:761px){
  .side .brand.brand-clean{align-items:center!important; gap:10px!important; padding-bottom:12px!important;}
  .side .brand.brand-clean .brand-logo{width:42px!important;height:42px!important;min-width:42px!important;border-radius:10px!important;}
  .side .brand.brand-clean .brand-logo img{width:100%!important;height:100%!important;object-fit:contain!important;}
  .side .brand.brand-clean small{font-size:13px!important;line-height:1.15!important;max-width:96px!important;}
}
.team-user-panel .team-notification-box{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);}
.team-user-panel .notification-prefs-grid{display:grid;grid-template-columns:minmax(240px,1fr) minmax(240px,1fr);gap:24px;align-items:start;}
.team-user-panel .compact-checks-v3{display:flex!important;flex-direction:column!important;gap:8px!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;}
.team-user-panel .compact-checks-v3 label{display:flex!important;align-items:center!important;gap:9px!important;width:auto!important;min-height:0!important;height:auto!important;margin:0!important;padding:2px 0!important;border:0!important;background:transparent!important;text-align:left!important;white-space:normal!important;}
.team-user-panel .compact-checks-v3 input{width:14px!important;height:14px!important;min-width:14px!important;margin:0!important;appearance:auto!important;-webkit-appearance:auto!important;}
.team-user-panel .compact-checks-v3 .status-dot{width:8px!important;height:8px!important;border-radius:99px!important;display:inline-block!important;flex:0 0 8px!important;}
.login .login-logo-big{width:138px!important;height:138px!important;margin:0 auto 20px!important;display:grid!important;place-items:center!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important;}
.login .login-logo-big img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;}
@media (max-width:760px){
  .team-user-panel .notification-prefs-grid{display:flex!important;flex-direction:column!important;gap:18px!important;}
  .team-user-panel .compact-checks-v3 label{font-size:14px!important;}
  .login .login-logo-big{width:150px!important;height:150px!important;}
}
`;
if (typeof document !== 'undefined') {
  let style50 = document.getElementById('argos-round50-team-notifs-brand');
  if (!style50) {
    style50 = document.createElement('style');
    style50.id = 'argos-round50-team-notifs-brand';
    document.head.appendChild(style50);
  }
  style50.textContent = ARGOS_ROUND50_TEAM_NOTIFS_BRAND_CSS;
}

createRoot(document.getElementById('root')).render(<App/>);

const ARGOS_ROUND45_CALENDAR_TITLE_MOBILE_CSS = `
/* Round 45: manter botões Mês/Semana/Dia ao lado do título no mobile */
@media (max-width:760px){
  .calendar-titlebar{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:10px!important;
    flex-wrap:nowrap!important;
  }
  .calendar-titlebar h1{
    width:auto!important;
    flex:1 1 auto!important;
    min-width:0!important;
    margin:0!important;
  }
  .calendar-titlebar .view-tabs{
    width:auto!important;
    flex:0 0 auto!important;
    margin-left:auto!important;
    display:flex!important;
    justify-content:flex-end!important;
    gap:6px!important;
    flex-wrap:nowrap!important;
  }
  .calendar-titlebar .view-tabs button{
    white-space:nowrap!important;
  }
}
@media (max-width:420px){
  .calendar-titlebar h1{font-size:26px!important;}
  .calendar-titlebar .view-tabs button{padding:9px 12px!important;}
}
`;
if (typeof document !== 'undefined') {
  let style45 = document.getElementById('argos-round45-calendar-title-mobile');
  if (!style45) {
    style45 = document.createElement('style');
    style45.id = 'argos-round45-calendar-title-mobile';
    document.head.appendChild(style45);
  }
  style45.textContent = ARGOS_ROUND45_CALENDAR_TITLE_MOBILE_CSS;
}

const ARGOS_ROUND46_DESKTOP_PREVIEW_FIX_CSS = `
/* Round 46: ajuste apenas desktop da prévia do post. Mobile preservado. */
@media (min-width:761px){
  .task-page .insta{
    width:min(100%,520px)!important;
    max-width:520px!important;
    align-self:center!important;
  }
  .task-page .media-box.adaptive-media-box{
    width:100%!important;
    aspect-ratio:4/5!important;
    height:auto!important;
    min-height:0!important;
    background:#151515!important;
    overflow:hidden!important;
  }
  .task-page .media-box.adaptive-media-box .media-inner{
    width:100%!important;
    height:100%!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    background:#151515!important;
  }
  .task-page .media-box.adaptive-media-box .media-inner img.media-fit-image,
  .task-page .media-box.adaptive-media-box .media-inner video.media-fit-image{
    width:100%!important;
    height:100%!important;
    max-width:none!important;
    max-height:none!important;
    object-fit:cover!important;
    object-position:center center!important;
    display:block!important;
    margin:0!important;
    background:#151515!important;
  }
  .task-page .media-box.adaptive-media-box .drive-fallback-frame{
    width:100%!important;
    height:100%!important;
    min-height:0!important;
    border:0!important;
    background:#151515!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style46 = document.getElementById('argos-round46-desktop-preview-fix');
  if (!style46) {
    style46 = document.createElement('style');
    style46.id = 'argos-round46-desktop-preview-fix';
    document.head.appendChild(style46);
  }
  style46.textContent = ARGOS_ROUND46_DESKTOP_PREVIEW_FIX_CSS;
}


const ARGOS_ROUND47_DESKTOP_PREVIEW_ZOOM_FIX_CSS = `
/* Round 47: prévia desktop não depende mais de max-height do navegador.
   A largura do card passa a respeitar a altura útil da viewport, mantendo 4:5 sem barras internas. */
@media (min-width:761px){
  .task-page .insta{
    width:min(100%, 520px, calc((100vh - 230px) * 0.8))!important;
    min-width:360px!important;
    max-width:520px!important;
    align-self:center!important;
    overflow:hidden!important;
  }
  .task-page .media-box.adaptive-media-box{
    width:100%!important;
    aspect-ratio:4/5!important;
    height:auto!important;
    min-height:0!important;
    max-height:none!important;
    background:#151515!important;
    overflow:hidden!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
  }
  .task-page .media-box.adaptive-media-box .media-inner{
    width:100%!important;
    height:100%!important;
    max-width:none!important;
    max-height:none!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    background:#151515!important;
    overflow:hidden!important;
  }
  .task-page .media-box.adaptive-media-box .media-inner img.media-fit-image,
  .task-page .media-box.adaptive-media-box .media-inner video.media-fit-image{
    width:100%!important;
    height:100%!important;
    min-width:100%!important;
    min-height:100%!important;
    max-width:none!important;
    max-height:none!important;
    object-fit:cover!important;
    object-position:center center!important;
    display:block!important;
    margin:0!important;
    background:#151515!important;
  }
  .task-page .media-box.adaptive-media-box .drive-fallback-frame{
    width:100%!important;
    height:100%!important;
    min-height:0!important;
    max-height:none!important;
    border:0!important;
    background:#151515!important;
  }
}
@media (min-width:761px) and (max-height:760px){
  .task-page .insta{
    width:min(100%, 500px, calc((100vh - 190px) * 0.8))!important;
    min-width:340px!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style47 = document.getElementById('argos-round47-desktop-preview-zoom-fix');
  if (!style47) {
    style47 = document.createElement('style');
    style47.id = 'argos-round47-desktop-preview-zoom-fix';
    document.head.appendChild(style47);
  }
  style47.textContent = ARGOS_ROUND47_DESKTOP_PREVIEW_ZOOM_FIX_CSS;
}


const ARGOS_ROUND49_USERS_PERMISSIONS_CSS = `
.danger-button{border-color:rgba(255,76,76,.55)!important;color:#ff7b7b!important;}
.notification-user-head{display:flex;align-items:center;justify-content:space-between;gap:14px;}
.notification-user-head .mini-title{margin:0!important;}
.notification-user-panel{padding:20px!important;}
.admin-lock-note{margin:14px 0 0!important;color:#e1b12c!important;}
.notification-prefs-grid input[disabled]{opacity:.45;cursor:not-allowed;}
@media(max-width:700px){
  .notification-user-head{align-items:flex-start;}
  .notification-user-head button{white-space:nowrap;}
}
`;
(function(){
  let el=document.getElementById('argos-round49-users-permissions-css');
  if(!el){ el=document.createElement('style'); el.id='argos-round49-users-permissions-css'; document.head.appendChild(el); }
  el.textContent=ARGOS_ROUND49_USERS_PERMISSIONS_CSS;
})();


const ARGOS_ROUND52_BRAND_ARCHIVE_CSS = `
/* Round 52: topo da marca + toggle arquivados sem checkbox gigante */
.side .brand.brand-logo-only{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  min-height:68px!important;
  padding:10px 10px 16px!important;
  margin:0 0 12px!important;
  border-bottom:1px solid rgba(255,255,255,.08)!important;
  gap:0!important;
}
.side .brand.brand-logo-only .brand-logo{
  width:132px!important;
  height:58px!important;
  min-width:0!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  overflow:visible!important;
}
.side .brand.brand-logo-only .brand-logo img{
  width:100%!important;
  height:100%!important;
  object-fit:contain!important;
  display:block!important;
}
.side .brand.brand-logo-only small{display:none!important;}
.settings-toolbar{
  display:flex!important;
  align-items:flex-end!important;
  justify-content:flex-end!important;
  gap:10px!important;
  flex-wrap:wrap!important;
}
.settings-toolbar .toggle-archived,
label.toggle-archived{
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:8px!important;
  width:auto!important;
  max-width:none!important;
  min-width:0!important;
  height:38px!important;
  min-height:38px!important;
  margin:0!important;
  padding:0 4px!important;
  border:0!important;
  background:transparent!important;
  text-align:left!important;
  white-space:nowrap!important;
  line-height:1!important;
  flex:0 0 auto!important;
}
.settings-toolbar .toggle-archived input,
label.toggle-archived input{
  appearance:auto!important;
  -webkit-appearance:auto!important;
  display:inline-block!important;
  position:static!important;
  width:14px!important;
  height:14px!important;
  min-width:14px!important;
  max-width:14px!important;
  margin:0!important;
  padding:0!important;
  flex:0 0 14px!important;
  transform:none!important;
}
.settings-toolbar .toggle-archived span,
label.toggle-archived span,
.settings-toolbar .toggle-archived{font-size:13px!important;color:#b8ad9a!important;}
@media (max-width:760px){
  .side .brand.brand-logo-only{
    justify-content:flex-start!important;
    min-height:62px!important;
    padding:10px 12px 14px!important;
    gap:10px!important;
  }
  .side .brand.brand-logo-only .brand-logo{
    width:44px!important;
    height:44px!important;
    min-width:44px!important;
  }
  .side .brand.brand-logo-only small{
    display:block!important;
    font-size:13px!important;
    line-height:1.15!important;
    font-weight:800!important;
    color:#f5efdf!important;
    max-width:130px!important;
  }
  .settings-section .section-header{
    display:flex!important;
    flex-direction:column!important;
    align-items:stretch!important;
    gap:12px!important;
  }
  .settings-toolbar{
    display:flex!important;
    flex-direction:column!important;
    align-items:stretch!important;
    justify-content:flex-start!important;
    gap:10px!important;
    width:100%!important;
  }
  .settings-toolbar .toggle-archived,
  label.toggle-archived{
    width:100%!important;
    flex:0 0 auto!important;
    height:auto!important;
    min-height:24px!important;
    justify-content:flex-start!important;
    align-self:flex-start!important;
    padding:0!important;
  }
  .settings-toolbar label:not(.toggle-archived){width:100%!important;flex:0 0 auto!important;}
  .settings-toolbar .primary{width:100%!important;flex:0 0 auto!important;}
  .login .login-logo-big{width:150px!important;height:110px!important;margin:0 auto 20px!important;}
}
`;
if (typeof document !== 'undefined') {
  let style52 = document.getElementById('argos-round52-brand-archive');
  if (!style52) {
    style52 = document.createElement('style');
    style52.id = 'argos-round52-brand-archive';
    document.head.appendChild(style52);
  }
  style52.textContent = ARGOS_ROUND52_BRAND_ARCHIVE_CSS;
}


const ARGOS_ROUND53_BRAND_TUNING_CSS = `
/* Round 53: marca do sistema proporcional horizontal + toggle arquivados compacto */
.side .brand.brand-logo-only{
  min-height:92px!important;
  height:92px!important;
  padding:12px 10px 18px!important;
  margin:0 0 14px!important;
  justify-content:center!important;
}
.side .brand.brand-logo-only .brand-logo{
  width:min(156px, calc(100% - 18px))!important;
  height:78px!important;
  min-width:0!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  overflow:visible!important;
}
.side .brand.brand-logo-only .brand-logo img{
  width:100%!important;
  height:100%!important;
  object-fit:contain!important;
}
.side .brand.brand-logo-only small{display:none!important;}

.settings-toolbar .toggle-archived,
label.toggle-archived{
  display:inline-flex!important;
  flex-direction:row!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:8px!important;
  height:38px!important;
  min-height:0!important;
  padding:0 2px!important;
  margin:0!important;
  border:0!important;
  background:transparent!important;
  width:auto!important;
  min-width:0!important;
  max-width:none!important;
  white-space:nowrap!important;
  text-align:left!important;
  line-height:1!important;
}
.settings-toolbar .toggle-archived input,
label.toggle-archived input{
  appearance:auto!important;
  -webkit-appearance:auto!important;
  width:14px!important;
  height:14px!important;
  min-width:14px!important;
  max-width:14px!important;
  flex:0 0 14px!important;
  display:inline-block!important;
  position:static!important;
  margin:0!important;
  padding:0!important;
  transform:none!important;
}
.settings-toolbar .toggle-archived,
.settings-toolbar .toggle-archived span,
label.toggle-archived,
label.toggle-archived span{
  font-size:13px!important;
  color:#b8ad9a!important;
  font-weight:600!important;
}

.login .login-logo-big{
  width:220px!important;
  height:110px!important;
  margin:0 auto 20px!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  overflow:visible!important;
}
.login .login-logo-big img{
  width:100%!important;
  height:100%!important;
  object-fit:contain!important;
}

@media (max-width:760px){
  .side .brand.brand-logo-only{
    min-height:68px!important;
    height:auto!important;
    padding:12px 12px 14px!important;
    margin:0 0 12px!important;
    display:flex!important;
    flex-direction:row!important;
    align-items:center!important;
    justify-content:center!important;
    gap:10px!important;
  }
  .side .brand.brand-logo-only .brand-logo{
    width:92px!important;
    height:46px!important;
    min-width:92px!important;
    flex:0 0 92px!important;
  }
  .side .brand.brand-logo-only small{
    display:block!important;
    flex:1 1 auto!important;
    text-align:center!important;
    font-size:17px!important;
    line-height:1.15!important;
    font-weight:900!important;
    color:#f5efdf!important;
    max-width:none!important;
    margin-right:92px!important;
  }
  .settings-toolbar{
    display:flex!important;
    flex-direction:column!important;
    align-items:stretch!important;
    gap:10px!important;
    width:100%!important;
  }
  .settings-toolbar .toggle-archived,
  label.toggle-archived{
    width:auto!important;
    align-self:flex-start!important;
    height:auto!important;
    min-height:20px!important;
    padding:0!important;
  }
  .settings-toolbar label:not(.toggle-archived),
  .settings-toolbar .primary{
    width:100%!important;
  }
  .login .login-logo-big{
    width:190px!important;
    height:96px!important;
    margin:0 auto 18px!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style53 = document.getElementById('argos-round53-brand-tuning');
  if (!style53) {
    style53 = document.createElement('style');
    style53.id = 'argos-round53-brand-tuning';
    document.head.appendChild(style53);
  }
  style53.textContent = ARGOS_ROUND53_BRAND_TUNING_CSS;
}


const ARGOS_ROUND54_DESKTOP_LOGO_HORIZONTAL_CSS = `
/* Round 54: logo desktop realmente horizontal e maior no topo da sidebar.
   Mobile fica preservado, porque já estava fechado. */
@media (min-width:761px){
  .side .brand.brand-logo-only{
    min-height:118px!important;
    height:118px!important;
    padding:14px 12px 20px!important;
    margin:0 0 16px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    border-bottom:1px solid rgba(255,255,255,.08)!important;
    overflow:visible!important;
  }

  .side .brand.brand-logo-only .brand-logo{
    width:154px!important;
    height:77px!important;
    min-width:154px!important;
    max-width:154px!important;
    aspect-ratio:2/1!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    overflow:visible!important;
  }

  .side .brand.brand-logo-only .brand-logo img{
    width:100%!important;
    height:100%!important;
    display:block!important;
    object-fit:contain!important;
    object-position:center!important;
    transform:scale(2.05)!important;
    transform-origin:center!important;
    max-width:none!important;
    max-height:none!important;
  }

  .side .brand.brand-logo-only .brand-logo span{
    font-size:28px!important;
    font-weight:900!important;
  }

  .side .brand.brand-logo-only small{
    display:none!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style54 = document.getElementById('argos-round54-desktop-logo-horizontal');
  if (!style54) {
    style54 = document.createElement('style');
    style54.id = 'argos-round54-desktop-logo-horizontal';
    document.head.appendChild(style54);
  }
  style54.textContent = ARGOS_ROUND54_DESKTOP_LOGO_HORIZONTAL_CSS;
}


const ARGOS_ROUND55_DESKTOP_LOGO_FIT_CSS = `
/* Round 55: corrige logo desktop para ficar grande, horizontal e sem extrapolar a sidebar */
@media (min-width:761px){
  .side .brand.brand-logo-only{
    min-height:106px!important;
    height:106px!important;
    padding:16px 12px 18px!important;
    margin:0 0 14px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    border-bottom:1px solid rgba(255,255,255,.08)!important;
    overflow:hidden!important;
  }

  .side .brand.brand-logo-only .brand-logo{
    width:142px!important;
    height:70px!important;
    min-width:142px!important;
    max-width:142px!important;
    aspect-ratio:2/1!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    overflow:hidden!important;
  }

  .side .brand.brand-logo-only .brand-logo img{
    width:100%!important;
    height:100%!important;
    max-width:100%!important;
    max-height:100%!important;
    display:block!important;
    object-fit:contain!important;
    object-position:center!important;
    transform:none!important;
  }

  .side .brand.brand-logo-only .brand-logo span{
    font-size:24px!important;
    font-weight:900!important;
  }

  .side .brand.brand-logo-only small{
    display:none!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style55 = document.getElementById('argos-round55-desktop-logo-fit');
  if (!style55) {
    style55 = document.createElement('style');
    style55.id = 'argos-round55-desktop-logo-fit';
    document.head.appendChild(style55);
  }
  style55.textContent = ARGOS_ROUND55_DESKTOP_LOGO_FIT_CSS;
}


const ARGOS_ROUND56_LOGIN_CENTERED_BRAND_CSS = `
/* Round 56: melhora o painel de login.
   Centraliza tudo, dá respiro entre logo e título e deixa a logo mais elegante. */
.login-card,
.auth-card,
.login-panel,
[class*="login"] .card,
[class*="auth"] .card {
  text-align:center!important;
}

.login-card form,
.auth-card form,
.login-panel form,
[class*="login"] form,
[class*="auth"] form {
  text-align:left!important;
}

.login-card h1,
.auth-card h1,
.login-panel h1,
[class*="login"] h1,
[class*="auth"] h1 {
  text-align:center!important;
  margin-top:16px!important;
  margin-bottom:14px!important;
  line-height:1.05!important;
}

.login-card p,
.auth-card p,
.login-panel p,
[class*="login"] p,
[class*="auth"] p {
  text-align:center!important;
  margin-bottom:26px!important;
}

.login-card input,
.auth-card input,
.login-panel input,
[class*="login"] input,
[class*="auth"] input {
  text-align:left!important;
}

.login-card button,
.auth-card button,
.login-panel button,
[class*="login"] button,
[class*="auth"] button {
  text-align:center!important;
}

.login-logo,
.auth-logo,
.login-brand-logo,
[class*="login"] img,
[class*="auth"] img {
  display:block!important;
  margin-left:auto!important;
  margin-right:auto!important;
  object-fit:contain!important;
}

/* Logo no topo do card de login */
.login-card .brand-logo,
.auth-card .brand-logo,
.login-panel .brand-logo,
[class*="login"] .brand-logo,
[class*="auth"] .brand-logo {
  margin:0 auto 18px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  width:150px!important;
  max-width:70%!important;
  height:auto!important;
  min-height:72px!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  overflow:visible!important;
}

.login-card .brand-logo img,
.auth-card .brand-logo img,
.login-panel .brand-logo img,
[class*="login"] .brand-logo img,
[class*="auth"] .brand-logo img {
  width:150px!important;
  max-width:100%!important;
  height:auto!important;
  max-height:92px!important;
  object-fit:contain!important;
  object-position:center!important;
}

/* Quando a logo vier como img direta dentro do painel */
.login-card > img:first-child,
.auth-card > img:first-child,
.login-panel > img:first-child,
[class*="login"] > img:first-child,
[class*="auth"] > img:first-child {
  width:150px!important;
  max-width:70%!important;
  height:auto!important;
  max-height:92px!important;
  margin:0 auto 18px!important;
}

/* Fallback com letra quando não existe logo */
.login-card .brand-logo span,
.auth-card .brand-logo span,
.login-panel .brand-logo span,
[class*="login"] .brand-logo span,
[class*="auth"] .brand-logo span {
  font-size:30px!important;
  font-weight:900!important;
}

/* Mobile: mantém centralizado e com logo confortável */
@media (max-width:760px){
  .login-card,
  .auth-card,
  .login-panel,
  [class*="login"] .card,
  [class*="auth"] .card {
    text-align:center!important;
  }

  .login-card .brand-logo,
  .auth-card .brand-logo,
  .login-panel .brand-logo,
  [class*="login"] .brand-logo,
  [class*="auth"] .brand-logo {
    width:138px!important;
    max-width:76%!important;
    min-height:68px!important;
    margin-bottom:16px!important;
  }

  .login-card .brand-logo img,
  .auth-card .brand-logo img,
  .login-panel .brand-logo img,
  [class*="login"] .brand-logo img,
  [class*="auth"] .brand-logo img {
    width:138px!important;
    max-height:84px!important;
  }

  .login-card h1,
  .auth-card h1,
  .login-panel h1,
  [class*="login"] h1,
  [class*="auth"] h1 {
    text-align:center!important;
    margin-top:14px!important;
    margin-bottom:12px!important;
  }

  .login-card p,
  .auth-card p,
  .login-panel p,
  [class*="login"] p,
  [class*="auth"] p {
    text-align:center!important;
    margin-bottom:24px!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style56 = document.getElementById('argos-round56-login-centered-brand');
  if (!style56) {
    style56 = document.createElement('style');
    style56.id = 'argos-round56-login-centered-brand';
    document.head.appendChild(style56);
  }
  style56.textContent = ARGOS_ROUND56_LOGIN_CENTERED_BRAND_CSS;
}


const ARGOS_ROUND57_LOGIN_LOGO_BIGGER_CSS = `
/* Round 57: aumenta a logo do login sem bagunçar o resto */
.login-card .brand-logo,
.auth-card .brand-logo,
.login-panel .brand-logo,
[class*="login"] .brand-logo,
[class*="auth"] .brand-logo {
  width:220px!important;
  max-width:82%!important;
  min-height:110px!important;
  margin:0 auto 20px!important;
}

.login-card .brand-logo img,
.auth-card .brand-logo img,
.login-panel .brand-logo img,
[class*="login"] .brand-logo img,
[class*="auth"] .brand-logo img {
  width:220px!important;
  max-width:100%!important;
  max-height:120px!important;
  object-fit:contain!important;
  object-position:center!important;
}

.login-card > img:first-child,
.auth-card > img:first-child,
.login-panel > img:first-child,
[class*="login"] > img:first-child,
[class*="auth"] > img:first-child {
  width:220px!important;
  max-width:82%!important;
  max-height:120px!important;
  margin:0 auto 20px!important;
}

@media (max-width:760px){
  .login-card .brand-logo,
  .auth-card .brand-logo,
  .login-panel .brand-logo,
  [class*="login"] .brand-logo,
  [class*="auth"] .brand-logo {
    width:190px!important;
    max-width:82%!important;
    min-height:96px!important;
    margin-bottom:18px!important;
  }

  .login-card .brand-logo img,
  .auth-card .brand-logo img,
  .login-panel .brand-logo img,
  [class*="login"] .brand-logo img,
  [class*="auth"] .brand-logo img {
    width:190px!important;
    max-height:104px!important;
  }

  .login-card > img:first-child,
  .auth-card > img:first-child,
  .login-panel > img:first-child,
  [class*="login"] > img:first-child,
  [class*="auth"] > img:first-child {
    width:190px!important;
    max-width:82%!important;
    max-height:104px!important;
    margin-bottom:18px!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style57 = document.getElementById('argos-round57-login-logo-bigger');
  if (!style57) {
    style57 = document.createElement('style');
    style57.id = 'argos-round57-login-logo-bigger';
    document.head.appendChild(style57);
  }
  style57.textContent = ARGOS_ROUND57_LOGIN_LOGO_BIGGER_CSS;
}


const ARGOS_ROUND58_LOGIN_LOGO_RESTORE_SIZE_CSS = `
/* Round 58: volta a sensação de tamanho da logo anterior.
   O problema era o respiro interno da imagem, então aqui aumentamos visualmente com scale
   e apenas damos mais distância do título. */
.login-card .brand-logo,
.auth-card .brand-logo,
.login-panel .brand-logo,
[class*="login"] .brand-logo,
[class*="auth"] .brand-logo {
  width:230px!important;
  max-width:86%!important;
  height:120px!important;
  min-height:120px!important;
  margin:0 auto 38px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  overflow:visible!important;
  border:0!important;
  background:transparent!important;
  box-shadow:none!important;
}

.login-card .brand-logo img,
.auth-card .brand-logo img,
.login-panel .brand-logo img,
[class*="login"] .brand-logo img,
[class*="auth"] .brand-logo img {
  width:230px!important;
  max-width:100%!important;
  height:auto!important;
  max-height:120px!important;
  object-fit:contain!important;
  object-position:center!important;
  transform:scale(1.72)!important;
  transform-origin:center center!important;
}

.login-card h1,
.auth-card h1,
.login-panel h1,
[class*="login"] h1,
[class*="auth"] h1 {
  margin-top:0!important;
  margin-bottom:16px!important;
  text-align:center!important;
}

.login-card p,
.auth-card p,
.login-panel p,
[class*="login"] p,
[class*="auth"] p {
  text-align:center!important;
  margin-bottom:28px!important;
}

@media (max-width:760px){
  .login-card .brand-logo,
  .auth-card .brand-logo,
  .login-panel .brand-logo,
  [class*="login"] .brand-logo,
  [class*="auth"] .brand-logo {
    width:210px!important;
    max-width:86%!important;
    height:110px!important;
    min-height:110px!important;
    margin-bottom:34px!important;
  }

  .login-card .brand-logo img,
  .auth-card .brand-logo img,
  .login-panel .brand-logo img,
  [class*="login"] .brand-logo img,
  [class*="auth"] .brand-logo img {
    width:210px!important;
    max-height:110px!important;
    transform:scale(1.72)!important;
  }
}
`;

if (typeof document !== 'undefined') {
  let style58 = document.getElementById('argos-round58-login-logo-restore-size');
  if (!style58) {
    style58 = document.createElement('style');
    style58.id = 'argos-round58-login-logo-restore-size';
    document.head.appendChild(style58);
  }
  style58.textContent = ARGOS_ROUND58_LOGIN_LOGO_RESTORE_SIZE_CSS;
}


const ARGOS_ROUND59_LOGIN_LOGO_REAL_FIX_CSS = `
/* Round 59: correção real da logo no login.
   Mira no card de login e em qualquer imagem/brand visual no topo.
   Objetivo: logo grande como antes, mas com respiro do título. */

/* Card de login centralizado */
.login-card,
.auth-card,
.login-panel,
[class*="login"] .card,
[class*="auth"] .card {
  text-align:center!important;
}

/* Qualquer container visual de marca dentro da tela de login */
.login-card .brand,
.auth-card .brand,
.login-panel .brand,
.login-card .brand-logo,
.auth-card .brand-logo,
.login-panel .brand-logo,
.login-card [class*="logo"],
.auth-card [class*="logo"],
.login-panel [class*="logo"],
[class*="login"] .brand,
[class*="auth"] .brand,
[class*="login"] .brand-logo,
[class*="auth"] .brand-logo,
[class*="login"] [class*="logo"],
[class*="auth"] [class*="logo"] {
  width:260px!important;
  max-width:86%!important;
  height:118px!important;
  min-height:118px!important;
  margin:0 auto 34px!important;
  padding:0!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
  overflow:visible!important;
}

/* Imagem da logo dentro do login, independente da classe */
.login-card img,
.auth-card img,
.login-panel img,
[class*="login"] img,
[class*="auth"] img {
  width:240px!important;
  max-width:86%!important;
  height:auto!important;
  max-height:118px!important;
  min-height:auto!important;
  display:block!important;
  object-fit:contain!important;
  object-position:center!important;
  margin:0 auto!important;
  transform:scale(1.45)!important;
  transform-origin:center center!important;
}

/* Título mais separado da logo */
.login-card h1,
.auth-card h1,
.login-panel h1,
[class*="login"] h1,
[class*="auth"] h1 {
  margin-top:10px!important;
  margin-bottom:18px!important;
  text-align:center!important;
  line-height:1.05!important;
}

/* Texto de apoio */
.login-card p,
.auth-card p,
.login-panel p,
[class*="login"] p,
[class*="auth"] p {
  text-align:center!important;
  margin-bottom:30px!important;
}

/* Inputs continuam normais */
.login-card input,
.auth-card input,
.login-panel input,
[class*="login"] input,
[class*="auth"] input {
  text-align:left!important;
}

/* Mobile */
@media (max-width:760px){
  .login-card .brand,
  .auth-card .brand,
  .login-panel .brand,
  .login-card .brand-logo,
  .auth-card .brand-logo,
  .login-panel .brand-logo,
  .login-card [class*="logo"],
  .auth-card [class*="logo"],
  .login-panel [class*="logo"],
  [class*="login"] .brand,
  [class*="auth"] .brand,
  [class*="login"] .brand-logo,
  [class*="auth"] .brand-logo,
  [class*="login"] [class*="logo"],
  [class*="auth"] [class*="logo"] {
    width:230px!important;
    max-width:88%!important;
    height:104px!important;
    min-height:104px!important;
    margin-bottom:30px!important;
  }

  .login-card img,
  .auth-card img,
  .login-panel img,
  [class*="login"] img,
  [class*="auth"] img {
    width:215px!important;
    max-width:88%!important;
    max-height:104px!important;
    transform:scale(1.45)!important;
  }
}
`;

if (typeof document !== 'undefined') {
  let style59 = document.getElementById('argos-round59-login-logo-real-fix');
  if (!style59) {
    style59 = document.createElement('style');
    style59.id = 'argos-round59-login-logo-real-fix';
    document.head.appendChild(style59);
  }
  style59.textContent = ARGOS_ROUND59_LOGIN_LOGO_REAL_FIX_CSS;
}


const ARGOS_ROUND60_LOGIN_LOGO_CROP_SCALE_CSS = `
/* Round 60: aumenta o DESENHO visível da logo no login.
   A imagem tem respiro/transparência interna, então aumentar só width não resolve.
   Aqui o container corta esse respiro e a imagem é ampliada dentro dele. */

.login-card .brand-logo,
.auth-card .brand-logo,
.login-panel .brand-logo,
[class*="login"] .brand-logo,
[class*="auth"] .brand-logo {
  width:220px!important;
  height:92px!important;
  min-height:92px!important;
  max-height:92px!important;
  margin:0 auto 34px!important;
  padding:0!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  overflow:hidden!important;
  background:transparent!important;
  border:0!important;
  border-radius:0!important;
  box-shadow:none!important;
}

/* Mira a imagem real da logo dentro do bloco */
.login-card .brand-logo img,
.auth-card .brand-logo img,
.login-panel .brand-logo img,
[class*="login"] .brand-logo img,
[class*="auth"] .brand-logo img {
  width:220px!important;
  height:220px!important;
  max-width:none!important;
  max-height:none!important;
  min-width:220px!important;
  min-height:220px!important;
  object-fit:contain!important;
  object-position:center!important;
  transform:none!important;
  margin:0!important;
  display:block!important;
}

/* Caso o login use imagem direta fora de .brand-logo */
.login-card > img:first-child,
.auth-card > img:first-child,
.login-panel > img:first-child,
[class*="login"] > img:first-child,
[class*="auth"] > img:first-child {
  width:220px!important;
  height:92px!important;
  object-fit:contain!important;
  object-position:center!important;
  margin:0 auto 34px!important;
  display:block!important;
}

/* Título e apoio continuam centralizados, só com respiro decente */
.login-card h1,
.auth-card h1,
.login-panel h1,
[class*="login"] h1,
[class*="auth"] h1 {
  text-align:center!important;
  margin-top:0!important;
  margin-bottom:16px!important;
  line-height:1.05!important;
}

.login-card p,
.auth-card p,
.login-panel p,
[class*="login"] p,
[class*="auth"] p {
  text-align:center!important;
  margin-bottom:28px!important;
}

@media (max-width:760px){
  .login-card .brand-logo,
  .auth-card .brand-logo,
  .login-panel .brand-logo,
  [class*="login"] .brand-logo,
  [class*="auth"] .brand-logo {
    width:205px!important;
    height:86px!important;
    min-height:86px!important;
    max-height:86px!important;
    margin-bottom:30px!important;
  }

  .login-card .brand-logo img,
  .auth-card .brand-logo img,
  .login-panel .brand-logo img,
  [class*="login"] .brand-logo img,
  [class*="auth"] .brand-logo img {
    width:205px!important;
    height:205px!important;
    min-width:205px!important;
    min-height:205px!important;
    max-width:none!important;
    max-height:none!important;
  }

  .login-card > img:first-child,
  .auth-card > img:first-child,
  .login-panel > img:first-child,
  [class*="login"] > img:first-child,
  [class*="auth"] > img:first-child {
    width:205px!important;
    height:86px!important;
    margin-bottom:30px!important;
  }
}
`;

if (typeof document !== 'undefined') {
  let style60 = document.getElementById('argos-round60-login-logo-crop-scale');
  if (!style60) {
    style60 = document.createElement('style');
    style60.id = 'argos-round60-login-logo-crop-scale';
    document.head.appendChild(style60);
  }
  style60.textContent = ARGOS_ROUND60_LOGIN_LOGO_CROP_SCALE_CSS;
}


const ARGOS_ROUND61_LOGIN_LOGO_INLINE_FIX_CSS = `
/* Round 61: ajuste direto no elemento real .login-logo-big */
.login .login-card .login-logo-big{
  width:260px!important;
  height:150px!important;
  margin:0 auto 34px!important;
  display:grid!important;
  place-items:center!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  overflow:visible!important;
}
.login .login-card .login-logo-big img{
  width:100%!important;
  height:100%!important;
  max-width:100%!important;
  max-height:100%!important;
  object-fit:contain!important;
  object-position:center!important;
  display:block!important;
  transform:none!important;
}
.login .login-card h1{
  text-align:center!important;
  margin-top:0!important;
  margin-bottom:16px!important;
}
.login .login-card p{
  text-align:center!important;
  margin-bottom:28px!important;
}
@media(max-width:760px){
  .login .login-card .login-logo-big{
    width:230px!important;
    height:132px!important;
    margin-bottom:30px!important;
  }
}
`;
if (typeof document !== 'undefined') {
  let style61 = document.getElementById('argos-round61-login-logo-inline-fix');
  if (!style61) {
    style61 = document.createElement('style');
    style61.id = 'argos-round61-login-logo-inline-fix';
    document.head.appendChild(style61);
  }
  style61.textContent = ARGOS_ROUND61_LOGIN_LOGO_INLINE_FIX_CSS;
}


const ARGOS_ROUND62_LOGIN_TOP_SPACING_CSS = `
/* Round 62: mantém a logo grande, mas reduz o espaço morto no topo do card de login */
.login .login-card{
  padding-top:34px!important;
  padding-bottom:34px!important;
}

.login .login-card .login-logo-big{
  width:260px!important;
  height:150px!important;
  margin:0 auto 22px!important;
  display:grid!important;
  place-items:center!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  overflow:visible!important;
}

.login .login-card .login-logo-big img{
  width:100%!important;
  height:100%!important;
  max-width:100%!important;
  max-height:100%!important;
  object-fit:contain!important;
  object-position:center!important;
  display:block!important;
  transform:none!important;
}

.login .login-card h1{
  margin-top:0!important;
  margin-bottom:14px!important;
  text-align:center!important;
}

.login .login-card p{
  margin-bottom:26px!important;
  text-align:center!important;
}

@media(max-width:760px){
  .login .login-card{
    padding-top:32px!important;
    padding-bottom:32px!important;
  }

  .login .login-card .login-logo-big{
    width:230px!important;
    height:132px!important;
    margin-bottom:20px!important;
  }
}
`;

if (typeof document !== 'undefined') {
  let style62 = document.getElementById('argos-round62-login-top-spacing');
  if (!style62) {
    style62 = document.createElement('style');
    style62.id = 'argos-round62-login-top-spacing';
    document.head.appendChild(style62);
  }
  style62.textContent = ARGOS_ROUND62_LOGIN_TOP_SPACING_CSS;
}


const ARGOS_ROUND63_LOGIN_LOGO_TOP_PULL_CSS = `
/* Round 63: correção direta.
   O espaço vinha do padding do card + caixa alta da logo.
   Aqui o card fica com padding menor e a logo sobe sem perder tamanho. */
.login .login-card.login-card-brand-fixed{
  padding:30px 32px 34px!important;
}

.login .login-card.login-card-brand-fixed .login-logo-big{
  width:260px!important;
  height:150px!important;
  margin:-44px auto 34px!important;
}

.login .login-card.login-card-brand-fixed .login-logo-big img{
  width:100%!important;
  height:100%!important;
  object-fit:contain!important;
  object-position:center!important;
  transform:none!important;
}

.login .login-card.login-card-brand-fixed h1{
  margin-top:0!important;
  margin-bottom:14px!important;
}

.login .login-card.login-card-brand-fixed p{
  margin-bottom:26px!important;
}

@media(max-width:760px){
  .login .login-card.login-card-brand-fixed{
    padding:28px 26px 32px!important;
  }

  .login .login-card.login-card-brand-fixed .login-logo-big{
    width:230px!important;
    height:132px!important;
    margin:-34px auto 28px!important;
  }
}
`;

if (typeof document !== 'undefined') {
  let style63 = document.getElementById('argos-round63-login-logo-top-pull');
  if (!style63) {
    style63 = document.createElement('style');
    style63.id = 'argos-round63-login-logo-top-pull';
    document.head.appendChild(style63);
  }
  style63.textContent = ARGOS_ROUND63_LOGIN_LOGO_TOP_PULL_CSS;
}


const ARGOS_ROUND64_LOGIN_LOGO_BALANCE_CSS = `
/* Round 64: equilíbrio visual do login.
   Logo mais próxima da borda superior e mais afastada do título. */
.login .login-card.login-card-brand-fixed{
  padding:30px 32px 34px!important;
}

.login .login-card.login-card-brand-fixed .login-logo-big{
  width:260px!important;
  height:150px!important;
  margin:-44px auto 34px!important;
}

.login .login-card.login-card-brand-fixed h1{
  margin-top:0!important;
  margin-bottom:14px!important;
  text-align:center!important;
}

.login .login-card.login-card-brand-fixed p{
  margin-bottom:26px!important;
  text-align:center!important;
}

@media(max-width:760px){
  .login .login-card.login-card-brand-fixed{
    padding:28px 26px 32px!important;
  }

  .login .login-card.login-card-brand-fixed .login-logo-big{
    width:230px!important;
    height:132px!important;
    margin:-34px auto 28px!important;
  }
}
`;

if (typeof document !== 'undefined') {
  let style64 = document.getElementById('argos-round64-login-logo-balance');
  if (!style64) {
    style64 = document.createElement('style');
    style64.id = 'argos-round64-login-logo-balance';
    document.head.appendChild(style64);
  }
  style64.textContent = ARGOS_ROUND64_LOGIN_LOGO_BALANCE_CSS;
}


const ARGOS_ROUND65_LOGIN_INPUTS_CENTERED_CSS = `
/* Round 65: centraliza placeholder e texto digitado nos campos do login */
.login .login-card.login-card-brand-fixed input,
.login .login-card input,
.login-card input,
.auth-card input,
.login-panel input {
  text-align:center!important;
}

.login .login-card.login-card-brand-fixed input::placeholder,
.login .login-card input::placeholder,
.login-card input::placeholder,
.auth-card input::placeholder,
.login-panel input::placeholder {
  text-align:center!important;
  opacity:.72!important;
}

/* Mantém o botão centralizado também */
.login .login-card.login-card-brand-fixed button,
.login .login-card button,
.login-card button,
.auth-card button,
.login-panel button {
  text-align:center!important;
}
`;

if (typeof document !== 'undefined') {
  let style65 = document.getElementById('argos-round65-login-inputs-centered');
  if (!style65) {
    style65 = document.createElement('style');
    style65.id = 'argos-round65-login-inputs-centered';
    document.head.appendChild(style65);
  }
  style65.textContent = ARGOS_ROUND65_LOGIN_INPUTS_CENTERED_CSS;
}

