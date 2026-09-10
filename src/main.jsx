import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { loadWorkspaceRecord, saveWorkspaceState } from './services/workspaceStateService';
import { bootstrapTasksFromTables, loadTaskRecords, syncTaskListDelta } from './services/taskTableService';
import { bootstrapNotificationsFromTable, loadNotificationRecords, syncNotificationListDelta } from './services/notificationTableService';
import { loadOrganizationProfiles, updateProfilePresence, updateProfileSocial, updateProfileNotificationPrefs } from './services/profileTableService';
import { loadPublicPortfolio, loadPublicPortfolioSettings, savePublicPortfolioSettings } from './services/publicPortfolioService';
import { loadApprovalReminderSettings, saveApprovalReminderSettings } from './services/approvalReminderSettingsService';
import {
  CALENDAR_PERMISSION_ITEMS,
  CREATE_TASK_FIELDS,
  DASHBOARD_WIDGETS,
  DEFAULT_SIDEBAR_PANEL_ORDER,
  DOCUMENT_PERMISSION_ITEMS,
  KANBAN_PERMISSION_ITEMS,
  NOTIFICATION_PANEL_PERMISSION_ITEMS,
  PANEL_CATALOG,
  PLANNING_PERMISSION_ITEMS,
  PORTFOLIO_PERMISSION_ITEMS,
  ROUTE_SCREEN_ALIASES,
  SCREEN_TO_ROUTE,
  SIDEBAR_PANEL_CATALOG,
  TASKS_LIST_PERMISSION_ITEMS,
  TASK_DETAIL_FIELDS,
  accessDefaultForRole,
  applySidebarPanelOrder,
  builtInAccessDefaultForRole,
  builtInCalendarPermissionsForRole,
  builtInDocumentPermissionsForRole,
  builtInKanbanPermissionsForRole,
  builtInNotificationPanelPermissionsForRole,
  builtInPlanningPermissionsForRole,
  builtInPortfolioPermissionsForRole,
  builtInTaskDetailPermissionsForRole,
  builtInTaskPermissionsForRole,
  builtInTasksListPermissionsForRole,
  collapseTaskPanelsInNavigation,
  defaultPanelNavigationForRole,
  fullDashboardVisibility,
  panelNavigationForUser,
  parseAppRoute,
  parsePublicPortfolioRoute,
  resolveUserAccess,
  safeUUID,
  setAppRoute,
  sidebarPanelOrder,
  sortMembersAdminFirst,
  taskShareUrl,
  taskTabsFromNavigation,
  userSortName,
  TASK_TYPES,
  TEAM_DEFAULT,
  CLIENT_DEFAULT,
  CLIENT_REQUEST_NOTIFICATION_EVENT,
  BASE_NOTIFICATION_VISIBLE_EVENTS,
  NOTIFICATION_VISIBLE_EVENTS,
  defaultNotificationPrefsForRole
} from './services/panelAccess';

const APP_ENV = String(import.meta.env.VITE_APP_ENV || 'production').toLowerCase();
const IS_LOCAL_DEV = APP_ENV === 'localdev';
const DISABLE_POLLING = String(import.meta.env.VITE_DISABLE_POLLING || '').toLowerCase() === 'true';

const ARGOS_ENVIRONMENT_CSS = `
.argos-environment-banner{
  position:fixed;
  top:0;
  left:0;
  right:0;
  z-index:99999;
  min-height:28px;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:5px 44px;
  box-sizing:border-box;
  background:#8a5a00;
  color:#fff4d4;
  border-bottom:1px solid rgba(255,255,255,.2);
  font-size:11px;
  font-weight:800;
  letter-spacing:.09em;
  text-transform:uppercase;
  box-shadow:0 5px 18px rgba(0,0,0,.28);
}
.argos-environment-banner + .app{
  padding-top:28px;
}
@media(max-width:760px){
  .argos-environment-banner{
    min-height:34px;
    padding:6px 12px;
    font-size:10px;
    text-align:center;
  }
  .argos-environment-banner + .app{
    padding-top:34px;
  }
}
`;

if(typeof document!=='undefined' && IS_LOCAL_DEV){
  let environmentStyle=document.getElementById('argos-environment-style');
  if(!environmentStyle){
    environmentStyle=document.createElement('style');
    environmentStyle.id='argos-environment-style';
    document.head.appendChild(environmentStyle);
  }
  environmentStyle.textContent=ARGOS_ENVIRONMENT_CSS;
}



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
const NOTIFICATION_EVENTS = NOTIFICATION_VISIBLE_EVENTS;
const BLOCKED_NOTIFICATION_EVENTS = new Set(['Nova tarefa atribuída','Mudança de responsável','Alteração de status','Aprovação do cliente','Solicitação de alteração','Tarefa reaberta']);
const SYSTEM_NOISE_PATTERNS = [/timer/i,/tarefa acessada/i,/inatividade/i,/fechar a tela/i,/sair da tarefa/i,/trocar de tarefa/i];
function isSystemNoise(text=''){ return SYSTEM_NOISE_PATTERNS.some(rx=>rx.test(String(text||''))); }
const LOG_NOISE_PATTERNS = [/timer/i,/tarefa acessada/i,/inatividade/i,/fechar a tela/i,/sair da tarefa/i,/trocar de tarefa/i,/campo/i,/copy/i,/legenda/i,/links? de visualiza/i,/instruções/i,/instrucoes/i];
function isLogNoise(text=''){ return LOG_NOISE_PATTERNS.some(rx=>rx.test(String(text||''))); }
function wantsNotification(user, event, statusId){
  if(!user?.active || user.role==='client') return false;
  const statusPrefs=user.notificationStatusPrefs||{};
  if(event==='Status da tarefa'){
    return !!statusId && (statusPrefs[statusId]??true);
  }
  if(BLOCKED_NOTIFICATION_EVENTS.has(event)) return false;
  if(!NOTIFICATION_VISIBLE_EVENTS.includes(event)) return false;
  const prefs=Array.isArray(user.notificationPrefs)?user.notificationPrefs:defaultNotificationPrefsForRole(user.role);
  return prefs.includes(event);
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
  documents: [],
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
    notificationPrefs: profile.notification_prefs?.events || undefined,
    notificationStatusPrefs: profile.notification_prefs?.statuses || undefined,
    notificationPrefsFromProfile: !!profile.notification_prefs,
    organizationId: profile.organization_id,
    companyIds: profile.company_ids || [],
    socialInstagram: profile.social_instagram || '',
    socialStatus: profile.social_status || '',
    lastSeenAt: profile.last_seen_at || '',
  };
}

function mergeProfileWithWorkspaceUser(profile, payload){
  const existing = (payload?.users||[]).find(u=>u.id===profile?.id) || {};
  const merged = {
    ...profile,
    ...existing,
    id: profile?.id || existing.id,
    organizationId: profile?.organizationId || existing.organizationId,
    companyIds: existing.companyIds || profile?.companyIds || [],
    // Permissões de status personalizadas pertencem ao workspace. Um refresh de profiles
    // não pode recolocar visible_statuses antigos por cima da configuração individual salva.
    visibleStatuses: existing?.accessInheritance?.statuses==='custom'
      ? (existing.visibleStatuses || [])
      : ((profile?.visibleStatuses&&profile.visibleStatuses.length) ? profile.visibleStatuses : (existing.visibleStatuses || [])),
    notificationPrefs: profile?.notificationPrefsFromProfile ? (profile.notificationPrefs || defaultNotificationPrefsForRole(profile?.role)) : (existing.notificationPrefs || profile?.notificationPrefs || defaultNotificationPrefsForRole(profile?.role)),
    notificationStatusPrefs: profile?.notificationPrefsFromProfile ? (profile.notificationStatusPrefs || {}) : (existing.notificationStatusPrefs || profile?.notificationStatusPrefs || {}),
    socialInstagram: profile?.socialInstagram ?? existing.socialInstagram ?? '',
    socialStatus: profile?.socialStatus ?? existing.socialStatus ?? '',
    lastSeenAt: profile?.lastSeenAt || existing.lastSeenAt || '',
    createdAt: existing.createdAt || profile?.createdAt || now(),
  };
  return merged;
}

function clonePayload(payload){
  try{ return JSON.parse(JSON.stringify(payload || EMPTY_CLOUD_STATE)); }
  catch(e){ return {...EMPTY_CLOUD_STATE}; }
}

function userForWorkspace(user){
  // Round108: dados voláteis/individuais agora vivem em profiles.
  // Não gravamos presença, recado, @instagram nem preferências de notificação no workspace_state,
  // para uma aba antiga não reverter essas informações.
  const copy = { ...(user || {}) };
  delete copy.lastSeenAt;
  delete copy.last_seen_at;
  delete copy.socialInstagram;
  delete copy.socialStatus;
  delete copy.socialUsername;
  delete copy.instagramUsername;
  delete copy.statusMessage;
  delete copy.notificationPrefs;
  delete copy.notificationStatusPrefs;
  return copy;
}

function normalizeWorkspacePayload(payload){
  const p = payload || EMPTY_CLOUD_STATE;
  return {
    users: Array.isArray(p.users) ? p.users : [],
    companies: Array.isArray(p.companies) ? p.companies : [],
    statuses: Array.isArray(p.statuses) && p.statuses.length ? p.statuses : DEFAULT_STATUS,
    tasks: Array.isArray(p.tasks) ? p.tasks : [],
    notifications: Array.isArray(p.notifications) ? p.notifications : [],
    documents: Array.isArray(p.documents) ? p.documents : [],
    system: p.system || { logo:'', title:'Painel de Aprovação' },
  };
}

function workspacePayloadForSave(payload){
  const p = normalizeWorkspacePayload(payload);
  // Round157A: notificações vivem em app_notifications.
  // Mantemos o campo vazio no JSON legado para impedir que notificações concluídas reapareçam.
  return { ...p, notifications:[], users: (p.users || []).map(userForWorkspace) };
}

function payloadSignature(payload){
  try{ return JSON.stringify(normalizeWorkspacePayload(payload)); }
  catch(e){ return String(Date.now()); }
}
function mergeLogs(baseLogs=[], localLogs=[], remoteLogs=[]){
  const byId = new Map();
  [...(baseLogs||[]), ...(remoteLogs||[]), ...(localLogs||[])].forEach((log,idx)=>{
    if(!log) return;
    const id = log.id || `log-${log.at||''}-${log.userId||''}-${idx}`;
    byId.set(id, {...(byId.get(id)||{}), ...log, id});
  });
  return [...byId.values()].sort((a,b)=>new Date(a.at||0)-new Date(b.at||0));
}
function mergeItem(base={}, local={}, remote={}){
  const merged = {...remote};
  const keys = new Set([...Object.keys(base||{}), ...Object.keys(remote||{}), ...Object.keys(local||{})]);
  keys.forEach(key=>{
    if(key === 'logs'){
      merged.logs = mergeLogs(base?.logs||[], local?.logs||[], remote?.logs||[]);
      return;
    }
    const b = JSON.stringify(base?.[key] ?? null);
    const l = JSON.stringify(local?.[key] ?? null);
    const r = JSON.stringify(remote?.[key] ?? null);
    const localChanged = l !== b;
    const remoteChanged = r !== b;
    if(localChanged && !remoteChanged) merged[key] = local?.[key];
    else if(!localChanged && remoteChanged) merged[key] = remote?.[key];
    else if(localChanged && remoteChanged) merged[key] = local?.[key];
    else merged[key] = remote?.[key] ?? local?.[key] ?? base?.[key];
  });
  return merged;
}
function mergeArrayById(baseArr=[], localArr=[], remoteArr=[], kind='items'){
  const baseMap = new Map((baseArr||[]).filter(x=>x?.id).map(x=>[x.id,x]));
  const localMap = new Map((localArr||[]).filter(x=>x?.id).map(x=>[x.id,x]));
  const remoteMap = new Map((remoteArr||[]).filter(x=>x?.id).map(x=>[x.id,x]));
  const ids = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
  const result=[];
  ids.forEach(id=>{
    const b=baseMap.get(id), l=localMap.get(id), r=remoteMap.get(id);
    const lExists=localMap.has(id), rExists=remoteMap.has(id), bExists=baseMap.has(id);
    const lChanged = JSON.stringify(l ?? null) !== JSON.stringify(b ?? null);
    const rChanged = JSON.stringify(r ?? null) !== JSON.stringify(b ?? null);
    if(!bExists){
      if(lExists && rExists) result.push(mergeItem({},l,r));
      else if(lExists) result.push(l);
      else if(rExists) result.push(r);
      return;
    }
    if(!lExists && !rExists) return;
    if(!lExists && rExists){
      // Se local apagou e remoto também mudou, preserva remoto para evitar perda acidental.
      if(rChanged) result.push(r);
      return;
    }
    if(lExists && !rExists){
      // Se remoto apagou e local mudou, preserva local; se local não mudou, respeita remoção remota.
      if(lChanged) result.push(l);
      return;
    }
    if(lChanged && rChanged) result.push(mergeItem(b,l,r));
    else if(lChanged) result.push(l);
    else if(rChanged) result.push(r);
    else result.push(r || l || b);
  });
  const orderSource = localArr?.length ? localArr : remoteArr;
  const order = new Map((orderSource||[]).map((x,i)=>[x?.id,i]));
  return result.sort((a,b)=>(order.get(a.id)??999999)-(order.get(b.id)??999999));
}
function mergeWorkspacePayload(basePayload, localPayload, remotePayload){
  const base=normalizeWorkspacePayload(basePayload);
  const local=normalizeWorkspacePayload(localPayload);
  const remote=normalizeWorkspacePayload(remotePayload);
  return {
    users: mergeArrayById(base.users, local.users, remote.users, 'users'),
    companies: mergeArrayById(base.companies, local.companies, remote.companies, 'companies'),
    statuses: mergeArrayById(base.statuses, local.statuses, remote.statuses, 'statuses'),
    tasks: mergeArrayById(base.tasks, local.tasks, remote.tasks, 'tasks'),
    notifications: mergeArrayById(base.notifications, local.notifications, remote.notifications, 'notifications'),
    documents: mergeArrayById(base.documents, local.documents, remote.documents, 'documents'),
    system: mergeItem(base.system || {}, local.system || {}, remote.system || {}),
  };
}

function mergeProfileRowsIntoUsers(currentUsers=[], profileUsers=[]){
  if(!Array.isArray(profileUsers) || !profileUsers.length) return currentUsers || [];
  const profileMap = new Map(profileUsers.filter(Boolean).map(p=>[p.id,p]));
  const seen = new Set();
  const merged = (currentUsers || []).map(user=>{
    const profile = profileMap.get(user.id);
    if(!profile) return user;
    seen.add(user.id);
    return mergeProfileWithWorkspaceUser(profile, { users:[user] });
  });
  profileUsers.forEach(profile=>{
    if(profile?.id && !seen.has(profile.id)) merged.push(mergeProfileWithWorkspaceUser(profile, { users:[] }));
  });
  return sortMembersAdminFirst(merged);
}

function applyWorkspacePayload(payload, setters, options={}){
  const p=normalizeWorkspacePayload(payload);
  setters.setUsersState(p.users||[]);
  setters.setCompaniesState(p.companies||[]);
  setters.setStatusesState((p.statuses&&p.statuses.length)?p.statuses:DEFAULT_STATUS);
  setters.setTasksState(p.tasks||[]);
  setters.setNotificationsState(p.notifications||[]);
  if(setters.setDocumentsState) setters.setDocumentsState(p.documents||[]);
  setters.setSystemState(p.system||{logo:'',title:'Painel de Aprovação'});
  if(!options.skipSystemCache) save('argos_system_r18', p.system||{logo:'',title:'Painel de Aprovação'});
}
async function createAuthBackedAppUser(draft){
  // Compatibilidade interna: versões antigas chamavam create-app-user.
  // A partir da round87, toda criação passa pela manage-app-user.
  return createManagedAppUser(draft);
}


async function updateAuthBackedAppUserProfile(draft){
  // Melhor esforço: o workspace é a fonte principal do painel.
  // O update direto em profiles pode falhar por RLS ao editar outros usuários,
  // então nunca deixamos isso quebrar a tela de usuários.
  if(!isSupabaseConfigured || !draft?.id) return draft;
  try{
    const patch={
      display_name: draft.name || '',
      role: draft.role || 'team',
      title: draft.title || '',
      active: draft.active !== false,
      avatar_url: draft.avatar || '',
      visible_statuses: draft.visibleStatuses || [],
      notification_prefs: {
        events: draft.notificationPrefs || NOTIFICATION_EVENTS,
        statuses: draft.notificationStatusPrefs || {}
      }
    };
    // Evita mexer em username/email aqui. Alterar login/senha de usuário Auth
    // deve ser outra rotina administrativa, não edição simples do card.
    const { error } = await supabase.from('profiles').update(patch).eq('id', draft.id);
    if(error) console.warn('Profile update ignored:', error.message || error);
  }catch(err){
    console.warn('Profile update ignored:', err?.message || err);
  }
  return draft;
}


async function manageAppUser(action, payload={}){
  if(!isSupabaseConfigured) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.functions.invoke('manage-app-user', { body:{ action, ...payload } });
  if(error) throw error;
  if(data?.error) throw new Error(data.error);
  return data;
}

async function createManagedAppUser(draft){
  if(!isSupabaseConfigured) return {...draft,id:draft.id||safeUUID()};
  const payload={
    email:String(draft.email||'').trim(),
    password:String(draft.password||'').trim(),
    name:draft.name||draft.email,
    role:draft.role||'team',
    title:draft.title||'',
    companyIds:draft.companyIds||[],
    avatar:draft.avatar||'',
    active:draft.active!==false,
    visibleStatuses:draft.visibleStatuses||[],
    notificationPrefs:draft.notificationPrefs||NOTIFICATION_EVENTS,
    notificationStatusPrefs:draft.notificationStatusPrefs||{}
  };
  if(!payload.email) throw new Error('Informe o login/e-mail do usuário.');
  if(!payload.password) throw new Error('Informe a senha inicial do usuário.');

  const result=await manageAppUser('create', { user:payload });
  return result.user || payload;
}

async function deleteManagedAppUser(user){
  if(!isSupabaseConfigured || !user?.id) return true;
  const result=await manageAppUser('delete', { user:{ id:user.id, email:user.email } });
  return result?.ok!==false;
}

async function resetManagedAppUserPassword(user, password){
  if(!isSupabaseConfigured || !user?.id) return true;
  const clean=String(password||'').trim();
  if(!clean) throw new Error('Informe uma nova senha.');
  const result=await manageAppUser('reset_password', { user:{ id:user.id, email:user.email, password:clean } });
  return result?.ok!==false;
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
  usefulLinks:'',
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
function driveDownload(url){ if(String(url||'').startsWith('data:')) return url; const id=driveId(url); return id ? `https://drive.google.com/uc?export=download&id=${id}` : url; }
function drivePreview(url){ if(String(url||'').startsWith('data:')) return url; const id=driveId(url); return id ? `https://drive.google.com/file/d/${id}/preview` : url; }
function driveThumb(url){ if(String(url||'').startsWith('data:')) return url; const id=driveId(url); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w2000` : driveDirect(url); }
// Round95: restaura drivePreview usado no fallback de prévia das tarefas.
// Sem logo genérica embutida: usa apenas logos configuradas no sistema.
function argosLogoSrc(value){ return value ? driveDirect(value) : ''; }
function priorityClass(date){ if(!date) return 'neutral'; const diff=Math.ceil((dObj(date)-dObj(todayStr()))/86400000); if(diff < 0) return 'late'; if(diff <= 1) return 'hot'; if(diff <= 3) return 'warn'; return 'ok'; }
function priorityText(date){ const c=priorityClass(date); return c==='late'?'Atrasada':c==='hot'?'Urgente':c==='warn'?'Alta':c==='ok'?'Baixa':'Sem prazo'; }
function imageFileToDataUrl(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function isMissingStorageBucketError(error){
  const message=String(error?.message||error||'').toLowerCase();
  const status=Number(error?.statusCode||error?.status||0);
  return message.includes('bucket not found') || message.includes('bucket does not exist') || (status===404 && message.includes('bucket'));
}
async function uploadImageToSupabase(file, folder='uploads'){
  if(!file) return '';

  if(isSupabaseConfigured){
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${folder}/${safeUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });

    if(error){
      // Local/Dev pode estar conectado ao Supabase sem possuir o bucket de imagens.
      // Nesse único caso usamos data URL para permitir testar a aparência sem tocar no Alfa.
      if(isMissingStorageBucketError(error)){
        console.warn('Storage bucket "avatars" ausente; usando imagem local para teste.', error);
        return imageFileToDataUrl(file);
      }
      throw error;
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  return imageFileToDataUrl(file);
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
function nextWeekStartStr(dateStr=todayStr()){ return addDays(weekStartStr(dateStr), 7); }
function weekEndStr(dateStr=todayStr()){ return addDays(weekStartStr(dateStr),6); }
function weekDayDate(weekStart, offset){ return addDays(weekStart, Number(offset)||0); }
function linkify(text){
  const tokens=String(text||'').split(/(https?:\/\/[^\s]+)/g);
  return tokens.flatMap((part,i)=>{
    if(/^https?:\/\//.test(part)) return [<a key={'u'+i} href={part} target="_blank" rel="noreferrer">{part}</a>];
    return part.split(/(\n)/g).map((chunk,j)=>chunk==='\n'?<br key={'b'+i+'-'+j}/>:chunk);
  });
}
const RICH_TEXT_PREFIX='__ARGOS_RICH_TEXT_V1__';
function isRichTextValue(value){ return String(value||'').startsWith(RICH_TEXT_PREFIX); }
function richTextHtml(value){
  const text=String(value||'');
  if(isRichTextValue(text)) return text.slice(RICH_TEXT_PREFIX.length);
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}
function sanitizeRichText(html){
  if(typeof document==='undefined') return '';
  const source=document.createElement('div');
  source.innerHTML=String(html||'');
  const allowed=new Set(['BR','B','STRONG','I','EM','U','H3','UL','OL','LI','P','DIV','A']);
  const cleanNode=node=>{
    Array.from(node.childNodes).forEach(child=>{
      if(child.nodeType===Node.COMMENT_NODE){ child.remove(); return; }
      if(child.nodeType!==Node.ELEMENT_NODE) return;
      if(!allowed.has(child.tagName)){
        cleanNode(child);
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      const originalHref=child.tagName==='A'?String(child.getAttribute('href')||'').trim():'';
      Array.from(child.attributes).forEach(attribute=>child.removeAttribute(attribute.name));
      if(child.tagName==='A'){
        const href=originalHref||String(child.textContent||'').trim();
        if(/^https?:\/\/[^\s]+$/i.test(href)){
          child.setAttribute('href',href);
          child.setAttribute('target','_blank');
          child.setAttribute('rel','noreferrer');
        }else child.replaceWith(...Array.from(child.childNodes));
      }
      cleanNode(child);
    });
  };
  cleanNode(source);
  Array.from(source.querySelectorAll('h3 h3')).reverse().forEach(nestedTitle=>{
    nestedTitle.replaceWith(...Array.from(nestedTitle.childNodes));
  });
  return source.innerHTML;
}
function richTextPlainText(value){
  if(!isRichTextValue(value)) return String(value||'');
  if(typeof document==='undefined') return String(value||'').slice(RICH_TEXT_PREFIX.length).replace(/<[^>]+>/g,' ');
  const box=document.createElement('div');
  box.innerHTML=richTextHtml(value).replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|h3|li)>/gi,'\n');
  return String(box.textContent||'').replace(/\n{3,}/g,'\n\n').trim();
}
function cleanExportUrl(value){
  return String(value||'').trim().replace(/[),.;:!?]+$/,'');
}
function readyFolderLink(task){
  const instructionFields=[task?.copyInstructions,task?.editorInstructions,task?.usefulLinks];
  for(const field of instructionFields){
    const text=richTextPlainText(field);
    const readyMatch=/\bpronto\b/i.exec(text);
    if(!readyMatch) continue;
    const link=String(text.slice(readyMatch.index+readyMatch[0].length)).match(/https?:\/\/[^\s<>"']+/i)?.[0];
    if(link) return cleanExportUrl(link);
  }
  return cleanExportUrl(taskMaterialLinks(task)[0]||'');
}
function excelXmlEscape(value){
  return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function exportCalendarTasksToExcel(tasks,selectedDay,view='month'){
  const current=dObj(selectedDay)||dObj(todayStr());
  const start=new Date(current), end=new Date(current);
  if(view==='month'){
    start.setDate(1); start.setHours(0,0,0,0);
    end.setFullYear(current.getFullYear(), current.getMonth()+1, 0); end.setHours(23,59,59,999);
  }else if(view==='week'){
    const day=current.getDay();
    const diffToMonday=day===0?-6:1-day;
    start.setDate(current.getDate()+diffToMonday); start.setHours(0,0,0,0);
    end.setTime(start.getTime()); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
  }else{
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
  }
  const rows=(tasks||[])
    .filter(task=>{const date=dObj(task?.postDate); return date&&date>=start&&date<=end;})
    .sort((a,b)=>String(a.postDate||'').localeCompare(String(b.postDate||''))||String(a.title||'').localeCompare(String(b.title||''),'pt-BR'));
  const periodLabel=view==='month'?'neste mês':view==='week'?'nesta semana':'neste dia';
  if(!rows.length){ alert(`Não há tarefas ${periodLabel} para exportar.`); return; }
  const cell=(value,style='Text',href='')=>`<Cell ss:StyleID="${style}"${href?` ss:HRef="${excelXmlEscape(href)}"`:''}><Data ss:Type="String">${excelXmlEscape(value)}</Data></Cell>`;
  const tableRows=rows.map(task=>{
    const link=readyFolderLink(task);
    return `<Row ss:AutoFitHeight="1">${cell(fmtDate(task.postDate),'Date')}${cell(task.title||'')}${cell(richTextPlainText(task.copy||''),'LongText')}${cell(richTextPlainText(task.caption||''),'LongText')}${cell(link,link?'Link':'Text',link)}</Row>`;
  }).join('');
  const xml=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top"/><Font ss:FontName="Aptos" ss:Size="10"/><Interior/><NumberFormat/><Protection/></Style>
<Style ss:ID="Header"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos Display" ss:Size="11" ss:Bold="1" ss:Color="#111111"/><Interior ss:Color="#E1B12C" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#A47B10"/></Borders></Style>
<Style ss:ID="Text"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Aptos" ss:Size="10"/></Style>
<Style ss:ID="LongText"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Aptos" ss:Size="10"/></Style>
<Style ss:ID="Date"><Alignment ss:Vertical="Top"/><Font ss:FontName="Aptos" ss:Size="10"/></Style>
<Style ss:ID="Link"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Aptos" ss:Size="10" ss:Color="#0563C1" ss:Underline="Single"/></Style>
</Styles>
<Worksheet ss:Name="Posts"><Table ss:ExpandedColumnCount="5" ss:ExpandedRowCount="${rows.length+1}" x:FullColumns="1" x:FullRows="1"><Column ss:Width="82"/><Column ss:Width="190"/><Column ss:Width="330"/><Column ss:Width="330"/><Column ss:Width="260"/><Row ss:Height="24">${cell('Data do post','Header')}${cell('Título','Header')}${cell('Copy','Header')}${cell('Legenda','Header')}${cell('Pasta Pronto','Header')}</Row>${tableRows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Selected/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions><AutoFilter x:Range="R1C1:R${rows.length+1}C5" xmlns="urn:schemas-microsoft-com:office:excel"/></Worksheet>
</Workbook>`;
  const blob=new Blob(['﻿',xml],{type:'application/vnd.ms-excel;charset=utf-8'});
  const url=URL.createObjectURL(blob), anchor=document.createElement('a');
  const safeStamp=(view==='month'
    ? monthLabel(selectedDay)
    : view==='week'
      ? `semana_${fmtDate(dateKeyLocal(start)).replace(/\//g,'-')}_a_${fmtDate(dateKeyLocal(end)).replace(/\//g,'-')}`
      : fmtDate(selectedDay).replace(/\//g,'-')
    ).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_|_$/g,'').toLowerCase();
  anchor.href=url; anchor.download=`posts_${safeStamp}.xls`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function RichTextDisplay({value,className=''}){
  if(!isRichTextValue(value)) return <span className={className}>{linkify(value)}</span>;
  return <div className={'rich-text-display '+className} dangerouslySetInnerHTML={{__html:sanitizeRichText(richTextHtml(value))}}/>;
}
function extractLinks(text){ return Array.from(String(text||'').matchAll(/https?:\/\/[^\s]+/g)).map(m=>m[0]); }
function periodMatch(date, period, from, to){
  if(!date) return false; const d=dObj(date); const today=dObj(todayStr());
  const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate()-today.getDay()+1);
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate()+6);
  const lastWeekStart = new Date(startOfWeek); lastWeekStart.setDate(startOfWeek.getDate()-7);
  const lastWeekEnd = new Date(endOfWeek); lastWeekEnd.setDate(endOfWeek.getDate()-7);
  if(period==='current'){ const currentStart=new Date(today); currentStart.setDate(today.getDate()-30); return d>=currentStart; }
  if(period==='today') return date===todayStr();
  if(period==='week') return d>=startOfWeek && d<=endOfWeek;
  if(period==='lastweek') return d>=lastWeekStart && d<=lastWeekEnd;
  if(period==='month') return d.getMonth()===today.getMonth() && d.getFullYear()===today.getFullYear();
  if(period==='lastmonth'){ const m=today.getMonth()-1; const y=m<0?today.getFullYear()-1:today.getFullYear(); const mm=(m+12)%12; return d.getMonth()===mm && d.getFullYear()===y; }
  if(period==='custom') return (!from || d>=dObj(from)) && (!to || d<=dObj(to));
  return true;
}
function companyApprovers(companyId, users){
  return (users||[]).filter(u=>u.active!==false && u.role==='client' && (u.companyIds||[]).includes(companyId));
}
const CUSTOM_ACCESS_SECTION_LABELS={
  statuses:'Status visíveis', types:'Tipos visíveis', notifications:'Notificações',
  dashboard:'Dashboard', actions:'Ações da tarefa', tasks:'Tarefa (ações e campos)',
  taskDetail:'Tarefa aberta', kanban:'Kanban', calendar:'Calendário',
  portfolio:'Portfólio', planning:'Planejamento', documents:'Documentos', tasksList:'Listas'
};
function userHasCustomAccess(user){
  if(!user) return false;
  if(user.panelPermissions?.mode==='custom') return true;
  const inh=user.accessInheritance||{};
  return Object.values(inh).some(v=>v==='custom');
}
function userCustomAccessLabels(user){
  const labels=[];
  if(user?.panelPermissions?.mode==='custom') labels.push('Painéis do menu');
  const inh=user?.accessInheritance||{};
  const seen=new Set();
  for(const key in inh){
    if(inh[key]!=='custom') continue;
    const label=CUSTOM_ACCESS_SECTION_LABELS[key];
    if(label && !seen.has(label)){ labels.push(label); seen.add(label); }
  }
  return labels;
}
function canUserAccessTask(task, user, statuses, users){
  if(!task || !user) return false;
  if(task.archived) return user.role === 'admin';
  if(user.role === 'admin') return true;
  const allowedStatuses = user.visibleStatuses || [];
  const creatorId=task.logs?.[0]?.userId;
  const creator=creatorId&&users?users.find(u=>u.id===creatorId):null;
  const isCompanyClientRequest = user.role==='client' && creator?.role==='client' && (user.companyIds||[]).includes(task.companyId);
  if(!allowedStatuses.includes(task.status) && !isCompanyClientRequest) return false;
  const allowedTypes = Array.isArray(user.visibleTypes) ? user.visibleTypes : TASK_TYPES;
  if(!allowedTypes.includes(task.type)) return false;
  if(user.role === 'team') return task.responsibleId === user.id;
  if(user.role === 'client') return (user.companyIds || []).includes(task.companyId);
  return false;
}
function baseVisibleTasks(tasks, user, statuses, users){
  return tasks.filter(t=>canUserAccessTask(t, user, statuses, users));
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
function taskLinkList(task,field){
  return String(task?.[field]||'').split('\n').map(x=>x.trim()).filter(Boolean);
}
function taskMaterialLinks(task){
  const legacyReady=taskLinkList(task,'materialLinks');
  if(legacyReady.length) return legacyReady;
  // Compatibilidade temporária com a Round156A, caso algum link tenha sido salvo em readyLinks.
  return taskLinkList(task,'readyLinks');
}
function isUserOnline(user, thresholdMs=150000){
  const ts = user?.lastSeenAt || user?.last_seen_at || '';
  const time = ts ? new Date(ts).getTime() : NaN;
  return Number.isFinite(time) && Date.now() - time <= thresholdMs;
}
function activeTimerTaskForUser(tasks, user){
  if(!user || user.role === 'admin') return null;
  return (tasks||[]).find(t=>t.startedAt && (t.startedById===user.id || (!t.startedById && t.responsibleId===user.id))) || null;
}
function isPortfolioTask(task, statuses){
  if(!task || task.archived) return false;
  const status = (statuses||[]).find(s=>s.id===task.status);
  const finalStatus = !!status?.final || ['agendamento','pronto','finalizado'].includes(task.status);
  return finalStatus && taskMaterialLinks(task).length > 0;
}

function normalizedStatusText(task, statuses){
  const status=(statuses||[]).find(s=>s.id===task?.status);
  return `${task?.status||''} ${status?.name||''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}
function isScheduledTask(task, statuses){
  return normalizedStatusText(task,statuses).includes('agend');
}
function isFinishedTask(task, statuses){
  if(isScheduledTask(task,statuses)) return false;
  const txt=normalizedStatusText(task,statuses);
  return !!isFinalStatus(statuses, task?.status) || txt.includes('pronto') || txt.includes('finaliz');
}

function taskPriorityClass(task,statuses){
  if(isScheduledTask(task,statuses) || isFinishedTask(task,statuses)) return 'done';
  return priorityClass(task?.internalDate);
}
function taskPriorityGroup(task,statuses){
  if(isScheduledTask(task,statuses)) return 'Agendada';
  if(isFinishedTask(task,statuses)) return 'Concluída';
  return priorityText(task?.internalDate);
}
function taskDeadlineColor(task,statuses,statusById){
  if(isFinishedTask(task,statuses)) return statusById?.[task?.status]?.color || '#22c55e';
  const cls=priorityClass(task?.internalDate);
  if(cls==='late') return '#ef4444';
  if(cls==='hot') return '#f97316';
  if(cls==='warn') return '#eab308';
  if(cls==='ok') return '#22c55e';
  return '#9ca3af';
}
function memberWorkStats(tasks, member, statuses){
  const assigned=(tasks||[]).filter(t=>!t.archived && t.responsibleId===member?.id);
  return {
    assigned: assigned.length,
    scheduled: assigned.filter(t=>isScheduledTask(t,statuses)).length,
    finished: assigned.filter(t=>isFinishedTask(t,statuses)).length,
  };
}
function portfolioDateValue(task){
  const raw = task?.postDate || task?.createdAt || task?.internalDate || '';
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}
function socialUsernameLabel(user){
  const raw = String(user?.socialInstagram || user?.instagramUsername || user?.socialUsername || '').trim();
  if(!raw) return '';
  return raw.startsWith('@') ? raw : '@' + raw;
}

function looksLikeEmail(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim());
}
function safeMemberName(user){
  const candidates = [user?.name, user?.display_name, user?.displayName, user?.role==='admin'?'Admin':'Membro'];
  const found = candidates.map(x=>String(x||'').trim()).find(x=>x && !looksLikeEmail(x));
  return found || (user?.role==='admin'?'Admin':'Membro');
}
function safeMemberSubtitle(user){
  return socialUsernameLabel(user) || user?.title || (user?.role==='admin'?'Administrador':'Membro');
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
  return <label className="toolbar-sort-control">Ordenar por<select value={value} onChange={e=>setValue(e.target.value)}>{baseOptions.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>;
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
function TaskTypeVisibilityChecks({types=TASK_TYPES,selected=[],onToggle}){
  return <div className="arg-vs-list-v2">
    {types.map(type=><label className="arg-vs-row-v2" key={type}>
      <input type="checkbox" checked={selected.includes(type)} onChange={e=>onToggle(type,e.target.checked)}/>
      <span className="arg-vs-dot-v2" style={{background:'var(--accent)'}}></span>
      <span className="arg-vs-name-v2">{type}</span>
    </label>)}
  </div>
}

function PublicSocialIcon({type}){
  const common={viewBox:'0 0 24 24',width:20,height:20,fill:'none','aria-hidden':true};
  if(type==='whatsapp') return <svg {...common}><path fill="currentColor" d="M12.04 2C6.51 2 2 6.49 2 12c0 1.77.46 3.5 1.33 5.02L2 22l5.12-1.34A10.1 10.1 0 0 0 12.04 22C17.57 22 22 17.51 22 12S17.57 2 12.04 2Zm5.83 14.12c-.25.7-1.46 1.34-2.02 1.42-.52.08-1.18.12-1.9-.12-.44-.14-1-.32-1.72-.63-3.03-1.3-5-4.35-5.15-4.55-.15-.2-1.23-1.64-1.23-3.12 0-1.48.78-2.21 1.05-2.51.27-.3.6-.37.8-.37h.58c.18 0 .43-.07.67.51.25.6.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.18-.32.39-.45.52-.15.15-.3.3-.13.6.18.3.8 1.32 1.72 2.14 1.18 1.05 2.18 1.38 2.48 1.53.3.15.48.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.68-.15.27.1 1.75.82 2.05.97.3.15.5.23.58.35.07.13.07.73-.18 1.43Z"/></svg>;
  if(type==='instagram') return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><circle cx="17.4" cy="6.7" r="1.1" fill="currentColor"/></svg>;
  if(type==='youtube') return <svg {...common}><path fill="currentColor" d="M21.58 7.19a2.97 2.97 0 0 0-2.1-2.1C17.63 4.59 12 4.59 12 4.59s-5.63 0-7.48.5a2.97 2.97 0 0 0-2.1 2.1C1.92 9.04 1.92 12 1.92 12s0 2.96.5 4.81a2.97 2.97 0 0 0 2.1 2.1c1.85.5 7.48.5 7.48.5s5.63 0 7.48-.5a2.97 2.97 0 0 0 2.1-2.1c.5-1.85.5-4.81.5-4.81s0-2.96-.5-4.81ZM10 15.46V8.54L16 12l-6 3.46Z"/></svg>;
  if(type==='tiktok') return <svg {...common}><path fill="currentColor" d="M14.3 3c.22 1.88 1.27 3.38 3.2 4.1v2.55a7.28 7.28 0 0 1-3.18-.8v6.08A5.93 5.93 0 1 1 9.2 9.05v2.72a3.32 3.32 0 1 0 2.45 3.16V3h2.65Z"/></svg>;
  if(type==='linkedin') return <svg {...common}><path fill="currentColor" d="M6.94 8.5H3.56V19h3.38V8.5ZM5.25 3A1.96 1.96 0 1 0 5.25 6.92 1.96 1.96 0 0 0 5.25 3ZM20.44 12.98c0-3.16-1.69-4.63-3.95-4.63-1.82 0-2.63 1-3.08 1.7V8.5h-3.38c.04 1.03 0 10.5 0 10.5h3.38v-5.86c0-.31.02-.63.11-.85.25-.63.82-1.28 1.78-1.28 1.26 0 1.76.96 1.76 2.37V19h3.38v-6.02Z"/></svg>;
  if(type==='facebook') return <svg {...common}><path fill="currentColor" d="M13.5 21v-8h2.68l.4-3.13H13.5v-2c0-.91.25-1.53 1.55-1.53H16.7V3.56c-.29-.04-1.27-.12-2.41-.12-2.39 0-4.03 1.46-4.03 4.14v2.29H7.56V13h2.7v8h3.24Z"/></svg>;
  return <svg {...common}><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 14 21 3m0 0h-7m7 0v7M14 10v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3h8Z"/></svg>;
}

function PublicPortfolioTile({item,onReady,onUnavailable}){
  const cardRef=useRef(null);
  const materials=useMemo(()=>{
    const all=[item?.previewUrl,...(Array.isArray(item?.materials)?item.materials:[])];
    return [...new Set(all.map(value=>String(value||'').trim()).filter(Boolean))];
  },[item]);
  const [slide,setSlide]=useState(0);
  const [nearViewport,setNearViewport]=useState(false);
  const [fullyVisible,setFullyVisible]=useState(false);
  const [mediaActivated,setMediaActivated]=useState(false);
  const [thumbFailed,setThumbFailed]=useState(false);
  const reportedRef=useRef('');
  const index=Math.min(slide,Math.max(0,materials.length-1));
  const source=materials[index]||'';
  const type=String(item?.type||'').toLowerCase();
  const lower=String(source||'').toLowerCase();
  const videoLike=type.includes('vídeo')||type.includes('video')||type.includes('reels')||/\.(mp4|webm|mov)(\?|$)/i.test(lower);

  useEffect(()=>{
    const node=cardRef.current;
    if(!node||typeof IntersectionObserver==='undefined'){
      setNearViewport(true); setFullyVisible(true); return;
    }
    const nearObserver=new IntersectionObserver(([entry])=>{if(entry.isIntersecting)setNearViewport(true);},{rootMargin:'500px 0px',threshold:.01});
    const visibleObserver=new IntersectionObserver(([entry])=>{
      const visible=entry.isIntersecting&&entry.intersectionRatio>=.55;
      setFullyVisible(visible);
      if(!visible)setMediaActivated(false);
    },{threshold:[0,.25,.55,.8]});
    nearObserver.observe(node); visibleObserver.observe(node);
    return()=>{nearObserver.disconnect();visibleObserver.disconnect();};
  },[]);

  useEffect(()=>{setThumbFailed(false);setMediaActivated(false);},[source]);
  useEffect(()=>{if(source&&reportedRef.current!=='ready'){reportedRef.current='ready';onReady?.(item.id);}},[source,item.id,onReady]);
  useEffect(()=>{if(materials.length||reportedRef.current==='unavailable')return;reportedRef.current='unavailable';onUnavailable?.(item.id);},[materials.length,item.id,onUnavailable]);
  if(!source)return null;
  function goTo(nextIndex){setSlide(Math.max(0,Math.min(materials.length-1,nextIndex)));setMediaActivated(false);}
  const showRealMedia=nearViewport&&(!videoLike||mediaActivated);

  return <article ref={cardRef} className="public-portfolio-tile is-ready" aria-label={item?.title||'Trabalho da Argos'}>
    <div className={'public-portfolio-optimized-media '+(fullyVisible?'is-centered':'')}>
      {showRealMedia
        ? <div className={'public-portfolio-real-layer '+(fullyVisible?'is-interactive':'')}><Media url={source}/></div>
        : !thumbFailed
          ? <img className="public-portfolio-optimized-thumb" src={driveThumb(source)} alt={item?.title||'Trabalho da Argos'} loading="lazy" decoding="async" onError={()=>setThumbFailed(true)}/>
          : <div className="public-portfolio-optimized-placeholder"><span>ARGOS</span></div>}
      {videoLike&&!mediaActivated&&nearViewport&&<button type="button" className="public-portfolio-activate-video" onClick={()=>setMediaActivated(true)} aria-label="Ativar vídeo">▶</button>}
      {materials.length>1&&<div className="public-portfolio-paged-arrows">
        <button type="button" onClick={()=>goTo(index-1)} disabled={index<=0} aria-label="Material anterior">‹</button>
        <button type="button" onClick={()=>goTo(index+1)} disabled={index>=materials.length-1} aria-label="Próximo material">›</button>
      </div>}
      {materials.length>1&&<span className="public-portfolio-paged-counter">{index+1}/{materials.length}</span>}
    </div>
    <div className="public-portfolio-mobile-actions" aria-hidden="true"><InstagramIcons/></div>
  </article>;
}

function BackToTopGlyph(){ return <svg className="back-top-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 15.5 12 8.5l7 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

function PublicPortfolioPage({slug='argos'}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [visibleIds,setVisibleIds]=useState(()=>new Set());
  const [portfolioPage,setPortfolioPage]=useState(0);
  const [showBackToTop,setShowBackToTop]=useState(false);
  const portfolioGridRef=useRef(null);

  useEffect(()=>{
    const html=document.documentElement;
    const body=document.body;
    const root=document.getElementById('root');
    html.classList.add('public-portfolio-scroll-root');
    body.classList.add('public-portfolio-scroll-root');
    root?.classList.add('public-portfolio-scroll-root');

    const updateBackToTop=()=>setShowBackToTop(window.scrollY>520);
    updateBackToTop();
    window.addEventListener('scroll',updateBackToTop,{passive:true});

    return()=>{
      window.removeEventListener('scroll',updateBackToTop);
      html.classList.remove('public-portfolio-scroll-root');
      body.classList.remove('public-portfolio-scroll-root');
      root?.classList.remove('public-portfolio-scroll-root');
    };
  },[]);

  useEffect(()=>{
    let alive=true;
    setVisibleIds(new Set());
    setPortfolioPage(0);
    document.title='Portfólio Argos';
    (async()=>{
      try{
        setLoading(true);
        setError('');
        const result=await loadPublicPortfolio(slug);
        if(alive) setData(result);
      }catch(err){
        if(alive) setError(err.message||'Não foi possível carregar o portfólio.');
      }finally{
        if(alive) setLoading(false);
      }
    })();
    return()=>{alive=false};
  },[slug]);

  if(loading) return <main className="public-portfolio-page public-portfolio-state"><div className="public-portfolio-loader"/><p>Carregando portfólio...</p></main>;
  if(error) return <main className="public-portfolio-page public-portfolio-state"><h1>Portfólio indisponível</h1><p>{error}</p></main>;
  if(!data) return <main className="public-portfolio-page public-portfolio-state"><h1>Portfólio indisponível</h1><p>Esta página não está ativa no momento.</p></main>;

  const profile=data.profile||{};
  const items=Array.isArray(data.items)?data.items:[];
  const pageSize=12;
  const pageCount=Math.max(1,Math.ceil(items.length/pageSize));
  const safePage=Math.min(portfolioPage,pageCount-1);
  const pageItems=items.slice(safePage*pageSize,(safePage+1)*pageSize);
  const username=String(profile.username||'').trim();
  const socialLinks=profile.socialLinks&&typeof profile.socialLinks==='object'?profile.socialLinks:{};
  const socialDefinitions=[
    ['whatsapp','WhatsApp'],
    ['instagram','Instagram'],
    ['youtube','YouTube'],
    ['tiktok','TikTok'],
    ['linkedin','LinkedIn'],
    ['facebook','Facebook'],
    ['site','Site'],
  ];
  const activeSocials=socialDefinitions
    .map(([key,label])=>({key,label,url:String(socialLinks[key]||'').trim()}))
    .filter(item=>item.url);

  function changePortfolioPage(nextPage){
    const page=Math.max(0,Math.min(pageCount-1,nextPage));
    setPortfolioPage(page);
    setVisibleIds(new Set());
    requestAnimationFrame(()=>{
      portfolioGridRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }
  const ctaUrl=String(profile.ctaUrl||'').trim();

  function markVisible(id){
    setVisibleIds(prev=>{
      if(prev.has(id)) return prev;
      const next=new Set(prev);
      next.add(id);
      return next;
    });
  }

  function markUnavailable(id){
    setVisibleIds(prev=>{
      if(!prev.has(id)) return prev;
      const next=new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const visibleCount=visibleIds.size;

  return <main className="public-portfolio-page">
    <section className="public-portfolio-shell">
      <header className="public-portfolio-header">
        <div className="public-portfolio-avatar">
          {profile.avatarUrl
            ? <img src={driveDirect(profile.avatarUrl)} alt={profile.name||'Argos'}/>
            : <span>A</span>}
        </div>
        <div className="public-portfolio-profile">
          <div className="public-portfolio-title-row">
            <div>
              <h1>{profile.name||'Argos'}</h1>
              {username&&<span>{username.startsWith('@')?username:`@${username}`}</span>}
            </div>
            {activeSocials.length>0&&<div className="public-portfolio-socials">
              {activeSocials.map(social=><a key={social.key} className={`social-${social.key}`} href={social.url} target="_blank" rel="noreferrer" aria-label={social.label} title={social.label}><PublicSocialIcon type={social.key}/></a>)}
            </div>}
          </div>
          {profile.bio&&<p className="public-portfolio-bio">{profile.bio}</p>}
        </div>
        {ctaUrl&&<a className="public-portfolio-cta public-portfolio-cta-wide" href={ctaUrl} target="_blank" rel="noreferrer">{profile.ctaText||'Solicitar orçamento'}</a>}
      </header>

      <div className="public-portfolio-divider"><span>PORTFÓLIO</span></div>

      {items.length
        ? <>
            <section ref={portfolioGridRef} className="public-portfolio-grid">{pageItems.map(item=><PublicPortfolioTile key={item.id} item={item} onReady={markVisible} onUnavailable={markUnavailable}/>)}</section>
            {pageCount>1&&<nav className="public-portfolio-pagination" aria-label="Páginas do portfólio">
              <button type="button" onClick={()=>changePortfolioPage(safePage-1)} disabled={safePage<=0}>Anterior</button>
              <span>Página {safePage+1} de {pageCount}</span>
              <button type="button" onClick={()=>changePortfolioPage(safePage+1)} disabled={safePage>=pageCount-1}>Próxima</button>
            </nav>}
          </>
        : <section className="public-portfolio-empty"><h2>Novos trabalhos em breve</h2><p>O portfólio está sendo atualizado.</p></section>}
    </section>
    {showBackToTop&&<button type="button" className="public-portfolio-back-top" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="Voltar ao topo" title="Voltar ao topo"><BackToTopGlyph/></button>}
  </main>;
}

function RootApp(){
  const [publicRoute,setPublicRoute]=useState(()=>parsePublicPortfolioRoute());
  useEffect(()=>{
    const update=()=>setPublicRoute(parsePublicPortfolioRoute());
    window.addEventListener('hashchange',update);
    window.addEventListener('popstate',update);
    return()=>{
      window.removeEventListener('hashchange',update);
      window.removeEventListener('popstate',update);
    };
  },[]);
  useEffect(()=>{
    if(!publicRoute?.legacy) return;
    const cleanPath=`/portfolio/${encodeURIComponent(publicRoute.slug||'argos')}`;
    window.history.replaceState(null,'',cleanPath);
    setPublicRoute({...publicRoute,legacy:false});
  },[publicRoute]);
  return publicRoute?<PublicPortfolioPage slug={publicRoute.slug}/>:<App/>;
}


function normalizeAccentColor(value){
  const raw=String(value||'').trim();
  return /^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():'#cbae6c';
}
function accentRgb(value){
  const hex=normalizeAccentColor(value).slice(1);
  return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
}
function accentVariant(value,amount=.14){
  const rgb=accentRgb(value);
  const mixed=rgb.map(channel=>Math.round(channel+(255-channel)*amount));
  return '#'+mixed.map(channel=>channel.toString(16).padStart(2,'0')).join('');
}
function accentDarkVariant(value,amount=.34){
  const rgb=accentRgb(value);
  const mixed=rgb.map(channel=>Math.round(channel*(1-amount)));
  return '#'+mixed.map(channel=>channel.toString(16).padStart(2,'0')).join('');
}
function accentContrast(value){
  const [r,g,b]=accentRgb(value).map(v=>v/255);
  const linear=[r,g,b].map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));
  const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  return luminance>.48?'#080808':'#ffffff';
}
function applySystemAccent(value){
  if(typeof document==='undefined') return;
  const accent=normalizeAccentColor(value);
  const [r,g,b]=accentRgb(accent);
  const root=document.documentElement;
  root.style.setProperty('--accent',accent);
  root.style.setProperty('--accent-rgb',`${r},${g},${b}`);
  root.style.setProperty('--gold',accent);
  root.style.setProperty('--gold-2',accentVariant(accent));
  root.style.setProperty('--accent-dark',accentDarkVariant(accent));
  root.style.setProperty('--accent-pale',accentVariant(accent,.52));
  root.style.setProperty('--accent-contrast',accentContrast(accent));
}

// ---- Push notification (web push) ----------------------------------------
// VAPID pública: é seguro embutir no bundle, só a privada (no servidor) importa.
const VAPID_PUBLIC_KEY = 'BBOwZgCFZpfB55QaC2XNUMy5VzC9cJ6Jr5AQtcxeBm1Du8QHYqxCqZIdm9uf9WFtrhVmZEsvhlOahi5O_Yv_pj0';

function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4 - base64String.length % 4) % 4);
  const base64=(base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData=window.atob(base64);
  const outputArray=new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;++i) outputArray[i]=rawData.charCodeAt(i);
  return outputArray;
}



function App(){
  const [users,setUsersState]=useState(()=>load('argos_users_r8', seedUsers));
  const [companies,setCompaniesState]=useState(()=>load('argos_companies_r8', seedCompanies));
  const [statuses,setStatusesState]=useState(()=>load('argos_statuses_r8', DEFAULT_STATUS));
  const [tasks,setTasksState]=useState(()=>load('argos_tasks_r8', seedTasks));
  const [notifications,setNotificationsState]=useState(()=>load('argos_notifications_r9', []));
  const [documents,setDocumentsState]=useState(()=>load('argos_documents_r1', []));
  const initialRoute=parseAppRoute();
  const [auth,setAuth]=useState(null); const [viewAs,setViewAs]=useState(null); const [screen,setScreen]=useState(initialRoute.screen || 'dashboard');
  const [selectedTask,setSelectedTask]=useState(initialRoute.taskId || null); const [createOpen,setCreateOpen]=useState(false); const [form,setForm]=useState(null);
  const [globalSearch,setGlobalSearch]=useState('');
  const [system,setSystemState]=useState(()=>load('argos_system_r18', { logo:'', title:'Painel de Aprovação', accentColor:'#cbae6c' }));
  useEffect(()=>{applySystemAccent(system?.accentColor);},[system?.accentColor]);
  const [cloudLoading,setCloudLoading]=useState(isSupabaseConfigured);
  const [cloudReady,setCloudReady]=useState(!isSupabaseConfigured);
  const [cloudError,setCloudError]=useState('');
  const [saveTick,setSaveTick]=useState(0);
  const [saveStatus,setSaveStatus]=useState('');
  const [realtimeConflict,setRealtimeConflict]=useState(null);
  const [dismissCloudAlert,setDismissCloudAlert]=useState(false);
  const [dismissRealtimeAlert,setDismissRealtimeAlert]=useState(false);
  const [taskTablesReady,setTaskTablesReady]=useState(false);
  const [notificationTablesReady,setNotificationTablesReady]=useState(false);
  const taskTablesReadyRef=useRef(false);
  const notificationTablesReadyRef=useRef(false);
  const taskSyncBusyRef=useRef(0);
  useEffect(()=>{ if(cloudError) setDismissCloudAlert(false); },[cloudError]);
  useEffect(()=>{ if(realtimeConflict) setDismissRealtimeAlert(false); },[realtimeConflict?.taskId,realtimeConflict?.field]);
  const taskSyncQueueRef=useRef(Promise.resolve());
  const taskSyncBaseRef=useRef(null);
  const taskSyncDesiredRef=useRef(null);
  const taskSyncRunningRef=useRef(false);
  const notificationSyncQueueRef=useRef(Promise.resolve());
  const notificationAlertBaselineRef=useRef(null);
  const notificationAudioContextRef=useRef(null);
  const [notificationAlertsEnabled,setNotificationAlertsEnabled]=useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>typeof localStorage!=='undefined' && localStorage.getItem('argos_sidebar_collapsed')==='1');
  useEffect(()=>{
    if(typeof localStorage==='undefined') return;
    localStorage.setItem('argos_sidebar_collapsed', sidebarCollapsed?'1':'0');
  },[sidebarCollapsed]);
  const [notificationPermission,setNotificationPermission]=useState(()=>typeof Notification==='undefined'?'unsupported':Notification.permission);
  const taskOpenSessionRef=useRef({});
  const workspaceMetaRef=useRef({updatedAt:null, basePayload:null, lastSavedSignature:null, applyingRemote:false});
  const saveRetryRef=useRef(null);
  const realtimeRefreshTimerRef=useRef(null);
  const pendingTaskFieldsRef=useRef(new Map());
  const pendingTaskLogsRef=useRef(new Map());
  const pendingTaskCreatesRef=useRef(new Map());
  const pendingTaskDeletesRef=useRef(new Set());

  const sameSyncValue=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

  useEffect(()=>{
    const warnBeforeUnload=(event)=>{
      const hasPending=taskSyncBusyRef.current>0 || !!taskSyncBaseRef.current || !!taskSyncDesiredRef.current || pendingTaskFieldsRef.current.size>0 || pendingTaskLogsRef.current.size>0 || pendingTaskCreatesRef.current.size>0 || pendingTaskDeletesRef.current.size>0;
      if(!hasPending) return;
      event.preventDefault();
      event.returnValue='';
    };
    window.addEventListener('beforeunload',warnBeforeUnload);
    return()=>window.removeEventListener('beforeunload',warnBeforeUnload);
  },[]);

  function captureTaskMutationProtection(prev=[],next=[]){
    const previousById=new Map((prev||[]).map(task=>[String(task.id),task]));
    const nextById=new Map((next||[]).map(task=>[String(task.id),task]));
    const protection={fields:new Map(),logs:new Map(),created:new Set(),deleted:new Set()};

    for(const [taskId,nextTask] of nextById){
      const previousTask=previousById.get(taskId);
      if(!previousTask){
        pendingTaskCreatesRef.current.set(taskId,nextTask);
        protection.created.add(taskId);
        const createdLogs=new Map((nextTask.logs||[]).filter(log=>log?.id).map(log=>[String(log.id),log]));
        if(createdLogs.size){
          pendingTaskLogsRef.current.set(taskId,createdLogs);
          protection.logs.set(taskId,new Set(createdLogs.keys()));
        }
        continue;
      }

      const changedFields=new Map();
      const keys=new Set([...Object.keys(previousTask||{}),...Object.keys(nextTask||{})]);
      keys.delete('logs');
      keys.forEach(field=>{
        if(!sameSyncValue(previousTask?.[field],nextTask?.[field])) changedFields.set(field,nextTask?.[field]);
      });
      if(changedFields.size){
        let pendingFields=pendingTaskFieldsRef.current.get(taskId);
        if(!pendingFields){ pendingFields=new Map(); pendingTaskFieldsRef.current.set(taskId,pendingFields); }
        changedFields.forEach((value,field)=>pendingFields.set(field,value));
        protection.fields.set(taskId,changedFields);
      }

      const previousLogsById=new Map((previousTask.logs||[]).filter(log=>log?.id).map(log=>[String(log.id),log]));
      const changedLogs=(nextTask.logs||[]).filter(log=>log?.id && !sameSyncValue(previousLogsById.get(String(log.id)),log));
      if(changedLogs.length){
        let pendingLogs=pendingTaskLogsRef.current.get(taskId);
        if(!pendingLogs){ pendingLogs=new Map(); pendingTaskLogsRef.current.set(taskId,pendingLogs); }
        const protectedIds=new Set();
        changedLogs.forEach(log=>{ const logId=String(log.id); pendingLogs.set(logId,log); protectedIds.add(logId); });
        protection.logs.set(taskId,protectedIds);
      }
    }

    for(const taskId of previousById.keys()){
      if(nextById.has(taskId)) continue;
      pendingTaskDeletesRef.current.add(taskId);
      protection.deleted.add(taskId);
    }
    return protection;
  }

  function releaseTaskMutationProtection(protection){
    for(const [taskId,fields] of protection.fields){
      const pendingFields=pendingTaskFieldsRef.current.get(taskId);
      if(!pendingFields) continue;
      fields.forEach((value,field)=>{ if(sameSyncValue(pendingFields.get(field),value)) pendingFields.delete(field); });
      if(!pendingFields.size) pendingTaskFieldsRef.current.delete(taskId);
    }
    for(const [taskId,logIds] of protection.logs){
      const pendingLogs=pendingTaskLogsRef.current.get(taskId);
      if(!pendingLogs) continue;
      logIds.forEach(logId=>pendingLogs.delete(logId));
      if(!pendingLogs.size) pendingTaskLogsRef.current.delete(taskId);
    }
    protection.created.forEach(taskId=>pendingTaskCreatesRef.current.delete(taskId));
    protection.deleted.forEach(taskId=>pendingTaskDeletesRef.current.delete(taskId));
  }

  async function syncTaskDeltaReliably(organizationId,prev,next){
    let attempt=0;
    for(;;){
      try{
        await syncTaskListDelta(organizationId,prev,next);
        if(attempt>0){
          setCloudError(current=>String(current||'').startsWith('Não foi possível salvar tarefa')?'':current);
        }
        return;
      }catch(err){
        attempt+=1;
        console.error(`task table sync failed (tentativa ${attempt})`,err);
        const waitMs=Math.min(10000,1200*Math.pow(1.7,Math.min(attempt-1,5)));
        setCloudError(`Não foi possível salvar tarefa(s). A alteração continua protegida e será reenviada automaticamente. Tentativa ${attempt}: ${err.message||err}`);
        await new Promise(resolve=>setTimeout(resolve,waitMs));
      }
    }
  }

  async function drainTaskSync(organizationId){
    if(taskSyncRunningRef.current) return taskSyncQueueRef.current;
    taskSyncRunningRef.current=true;
    taskSyncBusyRef.current=1;

    const run=(async()=>{
      try{
        while(taskSyncBaseRef.current && taskSyncDesiredRef.current){
          const base=taskSyncBaseRef.current;
          const desired=taskSyncDesiredRef.current;

          if(sameSyncValue(base,desired)){
            if(taskSyncDesiredRef.current===desired){
              taskSyncBaseRef.current=null;
              taskSyncDesiredRef.current=null;
              break;
            }
            continue;
          }

          await syncTaskDeltaReliably(organizationId,base,desired);
          taskSyncBaseRef.current=desired;

          // Se houve novas digitações enquanto a gravação estava em andamento,
          // não reproduzimos versões intermediárias: partimos da versão confirmada
          // diretamente para o snapshot local mais recente.
          if(taskSyncDesiredRef.current!==desired) continue;

          try{
            const latest=await loadTaskRecords(organizationId);
            applyRemoteTasks(latest);
          }catch(err){
            console.warn('task post-save confirmation refresh failed',err);
          }

          // Uma alteração pode chegar durante a leitura de confirmação.
          // Nesse caso, preservamos a base confirmada e continuamos o ciclo.
          if(taskSyncDesiredRef.current!==desired) continue;

          taskSyncBaseRef.current=null;
          taskSyncDesiredRef.current=null;
          setRealtimeConflict(null);
          break;
        }
      }finally{
        taskSyncRunningRef.current=false;
        taskSyncBusyRef.current=0;
      }
    })();

    taskSyncQueueRef.current=run.catch(err=>{
      console.error('task sync drain failed',err);
    });
    return run;
  }

  function applyRemoteTasks(latest){
    setTasksState(current=>{
      const currentById=new Map((current||[]).map(item=>[String(item.id),item]));
      const remoteIds=new Set((latest||[]).map(item=>String(item.id)));
      const merged=[];

      for(const remoteTask of (latest||[])){
        const taskId=String(remoteTask.id);
        if(pendingTaskDeletesRef.current.has(taskId)) continue;

        const localTask=currentById.get(taskId);
        const pendingFields=pendingTaskFieldsRef.current.get(taskId);
        const pendingLogs=pendingTaskLogsRef.current.get(taskId);
        let mergedTask=remoteTask;

        if(pendingFields?.size){
          for(const [field,pendingValue] of [...pendingFields.entries()]){
            if(sameSyncValue(remoteTask[field],pendingValue)){
              pendingFields.delete(field);
              continue;
            }
            mergedTask={...mergedTask,[field]:pendingValue};
          }
          if(!pendingFields.size) pendingTaskFieldsRef.current.delete(taskId);
        }

        if(pendingLogs?.size){
          const remoteLogsById=new Map((remoteTask.logs||[]).filter(log=>log?.id).map(log=>[String(log.id),log]));
          for(const [logId,pendingLog] of [...pendingLogs.entries()]){
            if(remoteLogsById.has(logId)){
              pendingLogs.delete(logId);
              continue;
            }
            remoteLogsById.set(logId,pendingLog);
          }
          mergedTask={...mergedTask,logs:[...remoteLogsById.values()].sort((a,b)=>new Date(a.at||0)-new Date(b.at||0))};
          if(!pendingLogs.size) pendingTaskLogsRef.current.delete(taskId);
        }

        if(pendingTaskCreatesRef.current.has(taskId)) pendingTaskCreatesRef.current.delete(taskId);
        merged.push(localTask?mergedTask:remoteTask);
      }

      for(const [taskId,pendingTask] of [...pendingTaskCreatesRef.current.entries()]){
        if(remoteIds.has(taskId) || pendingTaskDeletesRef.current.has(taskId)) continue;
        merged.push(currentById.get(taskId)||pendingTask);
      }

      for(const taskId of [...pendingTaskDeletesRef.current]){
        if(!remoteIds.has(taskId)) pendingTaskDeletesRef.current.delete(taskId);
      }

      return merged;
    });
  }

  useEffect(()=>{
    const syncRoute=()=>{
      const route=parseAppRoute();
      if(route.taskId){
        setSelectedTask(route.taskId);
        return;
      }
      setScreen(route.screen || 'dashboard');
      setSelectedTask(null);
    };
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('pageshow', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return ()=>{
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('pageshow', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  },[]);

  useEffect(()=>{
    if(!isSupabaseConfigured) return;
    let alive=true;
    (async()=>{
      try{
        const { data } = await supabase.auth.getSession();
        const session=data?.session;
        if(!session){ if(alive){ setCloudLoading(false); setCloudReady(false); } return; }
        const profile=await fetchCurrentProfile(session);
        const record=await loadWorkspaceRecord(profile.organizationId);
        const payload=normalizeWorkspacePayload(record.payload || EMPTY_CLOUD_STATE);
        const mergedProfile=mergeProfileWithWorkspaceUser(profile,payload);
        if(!mergedProfile?.active){ await supabase.auth.signOut(); throw new Error('Usuário inativo.'); }
        let profileUsers=[];
        try{ profileUsers = await loadOrganizationProfiles(profile.organizationId); }
        catch(profileErr){ console.warn('profiles refresh ignored:', profileErr?.message || profileErr); }
        const nextUsers = mergeProfileRowsIntoUsers([mergedProfile, ...(payload.users||[]).filter(u=>u.id!==mergedProfile.id)], profileUsers);
        const nextPayload={...payload, users:nextUsers};
        const currentAuth = nextUsers.find(u=>u.id===mergedProfile.id) || mergedProfile;
        if(alive){
          setAuth(currentAuth);
          workspaceMetaRef.current={updatedAt:record.updatedAt, basePayload:clonePayload(workspacePayloadForSave(nextPayload)), lastSavedSignature:payloadSignature(workspacePayloadForSave(nextPayload)), applyingRemote:true};
          applyWorkspacePayload(nextPayload,{setUsersState,setCompaniesState,setStatusesState,setTasksState,setNotificationsState,setDocumentsState,setSystemState});
          workspaceMetaRef.current.applyingRemote=false;
          setCloudReady(true); setCloudLoading(false); setCloudError(''); setSaveStatus('Sincronizado');
          if(!record.payload){
            const savedRecord=await saveWorkspaceState(profile.organizationId,workspacePayloadForSave(nextPayload),null);
            workspaceMetaRef.current={updatedAt:savedRecord.updatedAt, basePayload:clonePayload(savedRecord.payload||workspacePayloadForSave(nextPayload)), lastSavedSignature:payloadSignature(savedRecord.payload||workspacePayloadForSave(nextPayload)), applyingRemote:false};
          }
        }
      }catch(err){ console.error(err); if(alive){ setCloudError(err.message||'Erro ao carregar Supabase.'); setCloudLoading(false); } }
    })();
    return()=>{alive=false};
  },[]);

  useEffect(()=>{ taskTablesReadyRef.current = taskTablesReady; },[taskTablesReady]);
  useEffect(()=>{ notificationTablesReadyRef.current = notificationTablesReady; },[notificationTablesReady]);

  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId) return;
    let alive=true;
    (async()=>{
      try{
        const fromTables = await bootstrapTasksFromTables(auth.organizationId, tasks);
        if(!alive) return;
        setTasksState(fromTables);
        setTaskTablesReady(true);
        setCloudError('');
      }catch(err){
        if(!alive) return;
        setTaskTablesReady(false);
        setCloudError(`Tabelas de tarefas ainda não estão prontas: ${err.message||err}`);
      }
    })();
    return ()=>{ alive=false; };
  },[cloudReady, auth?.organizationId]);

  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId) return;
    let alive=true;
    (async()=>{
      try{
        const fromTable=await bootstrapNotificationsFromTable(auth.organizationId, notifications);
        if(!alive) return;
        setNotificationsState(fromTable);
        setNotificationTablesReady(true);
        setCloudError('');
      }catch(err){
        if(!alive) return;
        setNotificationTablesReady(false);
        setCloudError(`Tabela de notificações ainda não está pronta: ${err.message||err}`);
      }
    })();
    return()=>{ alive=false; };
  },[cloudReady,auth?.organizationId]);

  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId || !notificationTablesReady) return;
    let alive=true;
    let refreshInFlight=false;

    async function refreshNotifications(){
      if(!alive || refreshInFlight) return;
      refreshInFlight=true;
      try{
        const latest=await loadNotificationRecords(auth.organizationId);
        if(alive) setNotificationsState(latest);
      }catch(err){
        console.warn('notification table refresh failed',err);
      }finally{
        refreshInFlight=false;
      }
    }

    function refreshWhenVisible(){
      if(document.visibilityState==='visible') refreshNotifications();
    }

    const interval=setInterval(refreshNotifications,15000);
    window.addEventListener('focus',refreshNotifications);
    document.addEventListener('visibilitychange',refreshWhenVisible);
    return()=>{
      alive=false;
      clearInterval(interval);
      window.removeEventListener('focus',refreshNotifications);
      document.removeEventListener('visibilitychange',refreshWhenVisible);
    };
  },[cloudReady,auth?.organizationId,notificationTablesReady]);

  useEffect(()=>{
    notificationAlertBaselineRef.current=null;
    const enabled=!!auth?.id && localStorage.getItem(`argos_notification_alerts_${auth.id}`)==='enabled';
    setNotificationAlertsEnabled(enabled);
    setNotificationPermission(typeof Notification==='undefined'?'unsupported':Notification.permission);
  },[auth?.id]);

  useEffect(()=>{
    if(!notificationAlertsEnabled) return;
    const unlockAudio=async()=>{
      try{
        const AudioContextClass=window.AudioContext||window.webkitAudioContext;
        if(!AudioContextClass) return;
        const audioContext=notificationAudioContextRef.current||new AudioContextClass();
        notificationAudioContextRef.current=audioContext;
        if(audioContext.state==='suspended') await audioContext.resume();
      }catch(err){ console.warn('notification audio unlock failed',err); }
    };
    window.addEventListener('pointerdown',unlockAudio,{once:true});
    window.addEventListener('keydown',unlockAudio,{once:true});
    return()=>{
      window.removeEventListener('pointerdown',unlockAudio);
      window.removeEventListener('keydown',unlockAudio);
    };
  },[notificationAlertsEnabled]);

  useEffect(()=>{
    if(!notificationTablesReady || !auth?.id) return;
    const scoped=(notifications||[]).filter(n=>n?.userId===auth.id);
    const currentIds=new Set(scoped.map(n=>String(n.id)));
    const previousIds=notificationAlertBaselineRef.current;
    notificationAlertBaselineRef.current=currentIds;
    if(previousIds===null || !notificationAlertsEnabled) return;
    const fresh=scoped.filter(n=>!n.done && !previousIds.has(String(n.id)));
    if(!fresh.length) return;

    try{
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      const audioContext=notificationAudioContextRef.current;
      if(AudioContextClass&&audioContext?.state==='running'){
        const oscillator=audioContext.createOscillator();
        const gain=audioContext.createGain();
        oscillator.type='sine';
        oscillator.frequency.setValueAtTime(880,audioContext.currentTime);
        gain.gain.setValueAtTime(0.0001,audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12,audioContext.currentTime+0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001,audioContext.currentTime+0.32);
        oscillator.connect(gain); gain.connect(audioContext.destination);
        oscillator.start(); oscillator.stop(audioContext.currentTime+0.34);
      }
    }catch(err){ console.warn('notification sound failed',err); }

    if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&document.visibilityState!=='visible'){
      const first=fresh[0];
      const task=tasks.find(t=>t.id===first.taskId);
      const extra=fresh.length>1?` (+${fresh.length-1})`:'';
      const taskTitle=task?.title||'Tarefa não identificada';
      const actorName=first.actorName||first.payload?.actorName||'Sistema Argos';
      const notificationContent=String(first.text||'Você recebeu uma nova notificação.')
        .replace(`${taskTitle}:`,'')
        .trim();
      const browserNotification=new Notification('Argos',{
        body:`${taskTitle}${extra}\n${actorName}\n${notificationContent}`,
        tag:`argos-${first.id}`
      });
      browserNotification.onclick=()=>{ window.focus(); if(first.taskId) openTaskRoute(first.taskId); browserNotification.close(); };
    }
  },[notifications,notificationTablesReady,auth?.id,notificationAlertsEnabled,tasks]);

  async function enableNotificationAlerts(){
    if(!auth?.id) return;
    if(typeof Notification==='undefined'){
      setNotificationPermission('unsupported');
      alert('Este navegador não oferece notificações do sistema.');
      return;
    }
    let permission=Notification.permission;
    if(permission==='default') permission=await Notification.requestPermission();
    setNotificationPermission(permission);
    if(permission==='denied'){
      alert('As notificações estão bloqueadas no navegador. Libere a permissão nas configurações do site.');
      return;
    }
    try{
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(AudioContextClass){
        const audioContext=notificationAudioContextRef.current||new AudioContextClass();
        notificationAudioContextRef.current=audioContext;
        if(audioContext.state==='suspended') await audioContext.resume();
      }
    }catch(err){ console.warn('notification audio activation failed',err); }
    localStorage.setItem(`argos_notification_alerts_${auth.id}`,'enabled');
    notificationAlertBaselineRef.current=new Set((notifications||[]).filter(n=>n?.userId===auth.id).map(n=>String(n.id)));
    setNotificationAlertsEnabled(true);
  }

  function disableNotificationAlerts(){
    if(auth?.id) localStorage.removeItem(`argos_notification_alerts_${auth.id}`);
    setNotificationAlertsEnabled(false);
  }

  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId || !taskTablesReady || DISABLE_POLLING) return;
    let alive=true;
    let refreshInFlight=false;

    async function refreshTasks(){
      if(!alive || document.visibilityState==='hidden' || taskSyncBusyRef.current>0 || refreshInFlight) return;
      refreshInFlight=true;
      try{
        const latest=await loadTaskRecords(auth.organizationId);
        if(alive) applyRemoteTasks(latest);
      }catch(err){
        console.warn('task table refresh failed',err);
      }finally{
        refreshInFlight=false;
      }
    }

    function refreshWhenVisible(){
      if(document.visibilityState==='visible') refreshTasks();
    }

    const interval=setInterval(refreshTasks,60000);
    window.addEventListener('focus',refreshTasks);
    document.addEventListener('visibilitychange',refreshWhenVisible);

    return()=>{
      alive=false;
      clearInterval(interval);
      window.removeEventListener('focus',refreshTasks);
      document.removeEventListener('visibilitychange',refreshWhenVisible);
    };
  },[cloudReady,auth?.organizationId,taskTablesReady]);

  // Sincronização seletiva das tabelas de tarefa.
  // Campos locais pendentes ficam protegidos até o banco confirmar o mesmo valor.
  // Os demais campos da tarefa continuam recebendo atualizações em tempo real.
  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId || !taskTablesReady) return;
    let alive=true;
    let refreshInFlight=false;
    let refreshAgain=false;

    async function refreshChangedTasks(){
      if(!alive){ return; }
      if(taskSyncBusyRef.current>0){ refreshAgain=true; return; }
      if(refreshInFlight){ refreshAgain=true; return; }
      refreshInFlight=true;
      try{
        const latest=await loadTaskRecords(auth.organizationId);
        if(!alive) return;

        applyRemoteTasks(latest);
      }catch(err){
        console.warn('task realtime refresh failed',err);
      }finally{
        refreshInFlight=false;
        if(refreshAgain && taskSyncBusyRef.current===0){ refreshAgain=false; refreshChangedTasks(); }
      }
    }

    function scheduleRefresh(){
      if(realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current=setTimeout(refreshChangedTasks,120);
    }

    const channel=supabase
      .channel(`argos-task-realtime-${auth.organizationId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'app_tasks',filter:`organization_id=eq.${auth.organizationId}`},scheduleRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'app_task_logs'},scheduleRefresh)
      .subscribe(status=>{
        if(status==='CHANNEL_ERROR' || status==='TIMED_OUT') console.warn('task realtime subscription unavailable:',status);
      });

    return()=>{
      alive=false;
      if(realtimeRefreshTimerRef.current){ clearTimeout(realtimeRefreshTimerRef.current); realtimeRefreshTimerRef.current=null; }
      supabase.removeChannel(channel);
    };
  },[cloudReady,auth?.organizationId,taskTablesReady]);

  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId) return;
    let alive=true;
    let refreshInFlight=false;

    async function refreshProfiles(){
      if(!alive || document.visibilityState==='hidden' || refreshInFlight) return;
      refreshInFlight=true;
      try{
        const profileUsers=await loadOrganizationProfiles(auth.organizationId);
        if(!alive || !profileUsers.length) return;
        setUsersState(prev=>mergeProfileRowsIntoUsers(prev,profileUsers));
        const freshAuth=profileUsers.find(u=>u.id===auth.id);
        if(freshAuth) setAuth(prev=>prev&&prev.id===freshAuth.id?mergeProfileWithWorkspaceUser(freshAuth,{users:[prev]}):prev);
      }catch(err){
        console.warn('profile refresh ignored:',err?.message||err);
      }finally{
        refreshInFlight=false;
      }
    }

    function refreshWhenVisible(){
      if(document.visibilityState==='visible') refreshProfiles();
    }

    refreshProfiles();

    if(DISABLE_POLLING){
      return()=>{ alive=false; };
    }

    const interval=setInterval(refreshProfiles,120000);
    window.addEventListener('focus',refreshProfiles);
    document.addEventListener('visibilitychange',refreshWhenVisible);

    return()=>{
      alive=false;
      clearInterval(interval);
      window.removeEventListener('focus',refreshProfiles);
      document.removeEventListener('visibilitychange',refreshWhenVisible);
    };
  },[cloudReady,auth?.organizationId,auth?.id]);

  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId) return;
    if(workspaceMetaRef.current.applyingRemote) return;
    const localPayload=workspacePayloadForSave({ users, companies, statuses, tasks: taskTablesReady ? [] : tasks, notifications:[], documents, system });
    const localSignature=payloadSignature(localPayload);
    if(localSignature === workspaceMetaRef.current.lastSavedSignature) return;
    if(saveRetryRef.current) clearTimeout(saveRetryRef.current);
    const timer=setTimeout(async()=>{
      try{
        setSaveStatus('Salvando...');
        const result=await saveWorkspaceState(auth.organizationId, localPayload, workspaceMetaRef.current.updatedAt);
        if(result?.conflict){
          // Round106: não fazemos mais merge automático do workspace_state.
          // O merge do JSON gigante era a causa de tarefas deletadas voltando, tarefas novas sumindo
          // e preferências antigas sobrepondo alterações recentes.
          // Em conflito, bloqueamos a gravação local para não sobrescrever dados novos do banco.
          throw new Error('Outra pessoa/aba salvou alterações antes de você. Recarregue a página antes de continuar para evitar perda de dados.');
        }
        const savedPayload=normalizeWorkspacePayload(result?.payload || localPayload);
        workspaceMetaRef.current={updatedAt:result?.updatedAt || workspaceMetaRef.current.updatedAt, basePayload:clonePayload(savedPayload), lastSavedSignature:payloadSignature(savedPayload), applyingRemote:false};
        setCloudError(''); setSaveStatus('Salvo');
      }catch(err){
        console.error(err);
        setSaveStatus('Erro ao salvar. Tentando novamente...');
        setCloudError('Não foi possível salvar no Supabase. Suas alterações serão reenviadas automaticamente: '+(err.message||err));
        saveRetryRef.current=setTimeout(()=>setSaveTick(x=>x+1),3000);
      }
    },650);
    return()=>clearTimeout(timer);
  },[users,companies,statuses,documents,system,cloudReady,auth?.organizationId,saveTick,taskTablesReady]);

  // Round106: o polling/merge remoto do workspace_state foi desativado.
  // Motivo: o workspace ainda é um JSON grande. Sincronizar e mesclar esse JSON em abas antigas
  // pode ressuscitar tarefas apagadas, remover tarefas novas e reverter checkboxes.
  // A presença online continua funcionando abaixo via profiles.last_seen.
  // Próximo passo estrutural: migrar tarefas/comentários/materiais para tabelas separadas.


  const setSystem=v=>{setSystemState(v); save('argos_system_r18',v)};
  const setUsers=v=>{
    const next = typeof v === 'function' ? v(users) : v;
    setUsersState(next);
    const updatedAuth = next.find(u=>u.id===auth?.id);
    if(updatedAuth) setAuth(prev=>prev && prev.id===updatedAuth.id ? {...prev,...updatedAuth} : prev);
    if(!isSupabaseConfigured) save('argos_users_r8',next);
  };
  const setCompanies=v=>{setCompaniesState(v); if(!isSupabaseConfigured) save('argos_companies_r8',v)};
  const setStatuses=v=>{setStatusesState(v); if(!isSupabaseConfigured) save('argos_statuses_r8',v)};
  const setTasks=v=>{
    setTasksState(prev=>{
      const next = typeof v === 'function' ? v(prev) : v;
      if(isSupabaseConfigured && taskTablesReadyRef.current && auth?.organizationId){
        // Proteção permanece até o próprio banco devolver o valor gravado.
        // Não liberamos mais uma alteração apenas porque a chamada HTTP terminou.
        captureTaskMutationProtection(prev,next);

        if(!taskSyncBaseRef.current) taskSyncBaseRef.current=prev;
        taskSyncDesiredRef.current=next;

        if(!taskSyncRunningRef.current){
          drainTaskSync(auth.organizationId).catch(err=>console.error('task sync start failed',err));
        }
      } else if(!isSupabaseConfigured){
        save('argos_tasks_r8', next);
      }
      return next;
    });
  };
  const setNotifications=v=>{
    setNotificationsState(prev=>{
      const next = typeof v === 'function' ? v(prev) : v;
      if(isSupabaseConfigured && notificationTablesReadyRef.current && auth?.organizationId){
        notificationSyncQueueRef.current = notificationSyncQueueRef.current
          .catch(()=>{})
          .then(()=>taskSyncQueueRef.current)
          .then(()=>syncNotificationListDelta(auth.organizationId,prev,next))
          .catch(err=>{
            console.error('notification table sync failed',err);
            setCloudError(`Não foi possível salvar notificações: ${err.message||err}`);
          });
      }else if(!isSupabaseConfigured){
        save('argos_notifications_r9',next);
      }
      return next;
    });
  };
  const setDocuments=v=>{
    setDocumentsState(prev=>{
      const next = typeof v === 'function' ? v(prev) : v;
      if(!isSupabaseConfigured) save('argos_documents_r1',next);
      return next;
    });
  };

  useEffect(()=>{
    const favicon = system?.favicon || '';
    if(favicon){
      const faviconUrl = driveDirect(favicon);
      let link = document.querySelector("link[rel~='icon']");
      if(!link){ link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = faviconUrl;
      // iOS/iPadOS lê o apple-touch-icon (não o manifest.json) ao "Adicionar à Tela de Início".
      let appleLink = document.querySelector("link[rel='apple-touch-icon']");
      if(!appleLink){ appleLink = document.createElement('link'); appleLink.rel = 'apple-touch-icon'; document.head.appendChild(appleLink); }
      appleLink.href = faviconUrl;
    }
    if(system?.title) document.title = system.title;
  },[system?.favicon, system?.title]);

  useEffect(()=>{
    if(!cloudReady || !auth?.id || !['admin','team'].includes(auth.role) || IS_LOCAL_DEV) return;
    const touchPresence = () => {
      const stamp = now();
      // Round108: presença é volátil. Atualiza local + profiles, nunca workspace_state.
      setUsersState(prev=>prev.map(u=>u.id===auth.id?{...u,lastSeenAt:stamp}:u));
      setAuth(prev=>prev && prev.id===auth.id ? {...prev,lastSeenAt:stamp} : prev);
      if(isSupabaseConfigured){
        updateProfilePresence(auth.id, stamp).catch(err=>console.warn('presence update ignored:', err?.message || err));
      }
    };
    touchPresence();
    const interval = setInterval(touchPresence, 60000);
    return ()=>clearInterval(interval);
  },[cloudReady, auth?.id, auth?.role]);

  if(cloudLoading) return <div className="login"><div className="login-card"><div className="logo">A</div><h1>Carregando Argos</h1><p>Conectando ao Supabase...</p></div></div>;
  if(isSupabaseConfigured && !auth) return <CloudLogin setAuth={setAuth} setUsersState={setUsersState} setCompaniesState={setCompaniesState} setStatusesState={setStatusesState} setTasksState={setTasksState} setNotificationsState={setNotificationsState} setDocumentsState={setDocumentsState} setSystemState={setSystemState} setCloudReady={setCloudReady} setCloudError={setCloudError} setWorkspaceMeta={(meta)=>{workspaceMetaRef.current=meta}} cloudError={cloudError} system={system}/>;
  if(!auth) return <SetupRequired/>;
  const authUser=users.find(u=>u.id===auth.id)||auth;
  const simulatedUser=viewAs ? (users.find(u=>u.id===viewAs.id)||viewAs) : null;
  const rawEffectiveUser=simulatedUser||authUser;
  const effectiveUser=resolveUserAccess(rawEffectiveUser,system);
  const realAdmin=authUser.role==='admin'; const isAdmin=effectiveUser.role==='admin';
  const statusById=Object.fromEntries(statuses.map(s=>[s.id,s]));
  const visibleTasks=baseVisibleTasks(tasks,effectiveUser,statuses,users);
  const effectiveTaskTypes=effectiveUser.role==='admin'?TASK_TYPES:(Array.isArray(effectiveUser.visibleTypes)?effectiveUser.visibleTypes:TASK_TYPES);
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
  function openCreate(){
    const permissions=effectiveUser.taskPermissions||builtInTaskPermissionsForRole(effectiveUser.role);
    if(!permissions.canCreate) return;
    setForm({ title:'', companyId:'', responsibleId:'', type:TASK_TYPES[0], status:statuses[0]?.id||'', postDate:'', internalDate:'', copyInstructions:'', editorInstructions:'', usefulLinks:'', copy:'', caption:'', materialLinks:'' });
    setCreateOpen(true);
  }
  function openCreateForDate(dateStr){
    const permissions=effectiveUser.taskPermissions||builtInTaskPermissionsForRole(effectiveUser.role);
    if(!permissions.canCreate) return;
    setForm({ title:'', companyId:'', responsibleId:'', type:TASK_TYPES[0], status:statuses[0]?.id||'', postDate:dateStr, internalDate:dateStr, copyInstructions:'', editorInstructions:'', usefulLinks:'', copy:'', caption:'', materialLinks:'' });
    setCreateOpen(true);
  }
  function createTask(){
    const permissions=effectiveUser.taskPermissions||builtInTaskPermissionsForRole(effectiveUser.role);
    const fields=permissions.createFields||{};
    if(!form?.title || (fields.companyId&&!form.companyId) || (fields.responsibleId&&!form.responsibleId) || (fields.type&&!form.type) || (fields.status&&!form.status)){
      alert('Preencha os campos principais disponíveis.');
      return;
    }

    const eventAt=now();
    const creationLog={
      id:safeUUID(),
      user:effectiveUser.name,
      userId:effectiveUser.id,
      type:'log',
      visibility:'internal',
      at:eventAt,
      text:'Tarefa criada.',
      resolved:false
    };

    const t={
      id:safeUUID(),
      ...form,
      archived:false,
      alterationCount:0,
      totalEditSeconds:0,
      totalAlterSeconds:0,
      startedAt:null,
      version:1,
      createdAt:eventAt,
      logs:[creationLog]
    };

    setTasks(prev=>[...prev,t]);

    const initialStatusId=t.status||null;
    if(initialStatusId){
      const initialStatusName=statusById[initialStatusId]?.name||initialStatusId;
      notifyTask(
        t,
        `Tarefa criada diretamente no status ${initialStatusName}.`,
        'Status da tarefa',
        initialStatusId,
        effectiveUser.id,
        {
          actorName:effectiveUser.name,
          logId:creationLog.id,
          fromStatus:null,
          toStatus:initialStatusId,
          at:eventAt
        }
      );
    }

    setCreateOpen(false);
    setForm(null);
    openTaskRoute(t.id);
  }
  function notifyTask(task,text,event,statusId=null,actorId=effectiveUser?.id,meta={}){
    if(!task || isSystemNoise(text)) return;
    const actorName=meta.actorName||effectiveUser?.name||'';
    const recipients = users
      .filter(u=>u.active && u.role!=='client' && (u.role==='admin' || u.id===task.responsibleId))
      .filter(u=>u.id!==actorId)
      .filter(u=>wantsNotification(u,event,statusId));
    if(!recipients.length) return;
    const stamp=meta.at||now();
    const created=recipients.map(u=>({
      id:safeUUID(),
      taskId:task.id,
      userId:u.id,
      text:`${task.title}: ${text}`,
      at:stamp,
      done:false,
      event,
      statusId,
      actorId:actorId||null,
      actorName,
      logId:meta.logId||null,
      payload:{
        actorId:actorId||null,
        actorName,
        logId:meta.logId||null,
        fromStatus:meta.fromStatus||null,
        toStatus:meta.toStatus||null
      }
    }));
    setNotifications(prev=>[...created,...(Array.isArray(prev)?prev:[])]);
  }
  function updateTask(id, patch, logText){
    if(realtimeConflict?.taskId===id && Object.prototype.hasOwnProperty.call(patch,realtimeConflict.field)){
      setRealtimeConflict(null);
    }
    const original=tasks.find(t=>t.id===id);
    const transientPatchFields=new Set(['extraLogs','statusLogText','suppressStatusLog']);
    const statusChanged=!!(original && patch.status && patch.status!==original.status);
    const nextStatusId=statusChanged ? patch.status : null;
    const extraLogs=Array.isArray(patch.extraLogs)?patch.extraLogs:[];
    const hasCommentExtraLog=extraLogs.some(l=>l?.type==='comment');
    const patchOverridesLogs=Object.prototype.hasOwnProperty.call(patch,'logs');
    const suppressStatusLog=!!patch.suppressStatusLog||patchOverridesLogs||hasCommentExtraLog;
    const eventAt=now();
    const fromStatus=statusChanged?(statusById[original.status]?.name||original.status):'';
    const toStatus=statusChanged?(statusById[patch.status]?.name||patch.status):'';
    const statusEventLog=statusChanged&&!suppressStatusLog?{
      id:safeUUID(),
      user:effectiveUser.name,
      userId:effectiveUser.id,
      type:'status',
      visibility:'internal',
      at:eventAt,
      fromStatusId:original.status,
      toStatusId:patch.status,
      text:patch.statusLogText||`${effectiveUser.name} alterou de ${fromStatus} para ${toStatus}`
    }:null;

    setTasks(prevTasks=>prevTasks.map(t=>{
      if(t.id!==id) return t;

      let next={...t,...patch};
      delete next.extraLogs;
      delete next.statusLogText;
      delete next.suppressStatusLog;

      let logs=[...(t.logs||[])];

      if(patch.responsibleId && patch.responsibleId!==t.responsibleId){
        const fromUser=users.find(u=>u.id===t.responsibleId)?.name || 'Sem responsável';
        const toUser=users.find(u=>u.id===patch.responsibleId)?.name || 'Sem responsável';
        logs.push({
          id:safeUUID(),
          user:effectiveUser.name,
          userId:effectiveUser.id,
          type:'log',
          visibility:'internal',
          at:eventAt,
          text:`${effectiveUser.name} alterou o responsável de ${fromUser} para ${toUser}`
        });
      }

      if(statusChanged){
        if(patch.status==='alteracao' && t.status!=='alteracao') next.alterationCount=(t.alterationCount||0)+1;
        if(statusEventLog) logs.push(statusEventLog);
      }

      if(logText && !statusChanged && !isLogNoise(logText)){
        logs.push({
          id:safeUUID(),
          user:effectiveUser.name,
          userId:effectiveUser.id,
          type:'log',
          visibility:'internal',
          at:eventAt,
          text:logText
        });
      }

      if(extraLogs.length) logs.push(...extraLogs);
      if(patchOverridesLogs) logs=patch.logs;

      return {...next,logs};
    }));

    if(original && statusChanged){
      const targetTask={...original,...patch};
      notifyTask(
        targetTask,
        `Status alterado de ${fromStatus} para ${toStatus}.`,
        'Status da tarefa',
        nextStatusId,
        effectiveUser.id,
        {
          actorName:effectiveUser.name,
          logId:statusEventLog?.id||null,
          fromStatus:original.status,
          toStatus:patch.status,
          at:eventAt
        }
      );
    }
  }

  function addLog(id,text,type='comment',visibility='internal'){
    const eventAt=now();
    const task=tasks.find(t=>t.id===id);
    const entry={id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type,visibility,at:eventAt,text,resolved:false,statusAtTime:task?.status||null};
    setTasks(prev=>prev.map(t=>t.id===id?{...t,logs:[...(t.logs||[]),entry]}:t));
    if(type==='comment'){
      notifyTask(task,text,'Comentário na tarefa',task?.status,effectiveUser.id,{
        actorName:effectiveUser.name,
        logId:entry.id,
        at:eventAt
      });
    }
  }

  function createWeeklyTasks(companyId, weekStart, force=false){
    const company=companies.find(c=>c.id===companyId);
    if(!company) return;
    const currentWeekStart=weekStartStr();
    const canonicalWeekStart = weekStart <= currentWeekStart ? nextWeekStartStr() : weekStartStr(weekStart);
    weekStart = canonicalWeekStart;
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
          id:safeUUID(),
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
          usefulLinks:item.usefulLinks || '',
          finalLink:item.finalLink || '',
          materialLinks:'',
          generatedWeek:weekStart,
          generatedFromTemplate:true,
          logs:[{id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'log',visibility:'internal',at:now(),text:`Tarefa gerada pelo Planejamento Semanal (${fmtDate(weekStart)} a ${fmtDate(weekEndStr(weekStart))}).`}]
        });
      }
    });
    if(!created.length){ alert('Nenhuma tarefa foi gerada. Verifique as quantidades do template.'); return; }
    setTasks(prev=>[...prev,...created]);
    alert(`${created.length} tarefa(s) gerada(s) para ${company.name}.`);
  }
  // Round155B: usa personalização somente quando o usuário possuir
  // panelPermissions.mode === 'custom'. Sem isso, mantém os padrões atuais.
  const rawNav=applySidebarPanelOrder(panelNavigationForUser(effectiveUser,system),system);
  const taskTabs=taskTabsFromNavigation(rawNav);
  const nav=collapseTaskPanelsInNavigation(rawNav);
  const requestedScreen=['kanban','calendar','tasks'].includes(screen)&&taskTabs.length?'tasks':screen;
  const activeScreen = nav.some(([id])=>id===requestedScreen) ? requestedScreen : nav[0][0];
  function navigateScreen(nextScreen){
    setSelectedTask(null);
    setScreen(nextScreen);
    setAppRoute({screen: nextScreen});
  }
  function openTaskRoute(taskId){
    if(!taskId) return;
    taskOpenSessionRef.current[taskId] = true;
    setSelectedTask(taskId);
    setAppRoute({taskId});
  }
  function closeTaskRoute(){
    setSelectedTask(null);
    setAppRoute({screen: activeScreen});
  }
  const selectedTaskObj = selectedTask ? tasks.find(t=>t.id===selectedTask) : null;
  const selectedTaskAllowed = selectedTaskObj && (taskOpenSessionRef.current[selectedTask] || canUserAccessTask(selectedTaskObj, effectiveUser, statuses));
  if(selectedTaskObj && canUserAccessTask(selectedTaskObj, effectiveUser, statuses)){
    taskOpenSessionRef.current[selectedTask] = true;
  }
  return <>
    {IS_LOCAL_DEV&&<div className="argos-environment-banner">Ambiente Local • Supabase Dev • Polling automático desligado</div>}
    <div className={'app'+(sidebarCollapsed?' sidebar-collapsed':'')}>
    <Sidebar auth={auth} effectiveUser={effectiveUser} viewAs={viewAs} setViewAs={setViewAs} users={users} companies={companies} notifications={notifications} system={system} realAdmin={realAdmin} nav={nav} screen={activeScreen} setScreen={navigateScreen} setAuth={setAuth} notificationAlertsEnabled={notificationAlertsEnabled} notificationPermission={notificationPermission} enableNotificationAlerts={enableNotificationAlerts} disableNotificationAlerts={disableNotificationAlerts} sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}/>
    <button type="button" className="side-collapse-toggle" onClick={()=>setSidebarCollapsed(v=>!v)} title={sidebarCollapsed?'Expandir menu':'Recolher menu'} aria-label={sidebarCollapsed?'Expandir menu':'Recolher menu'}>{sidebarCollapsed?'»':'«'}</button>
    <main className="main">
      {((cloudError&&!dismissCloudAlert)||(realtimeConflict&&!dismissRealtimeAlert))&&<div className="cloud-alert-stack" role="status" aria-live="polite">
        {cloudError&&!dismissCloudAlert&&<div className="cloud-banner"><button type="button" className="cloud-banner-close" aria-label="Fechar aviso" onClick={()=>setDismissCloudAlert(true)}>×</button>{cloudError}</div>}
        {realtimeConflict&&!dismissRealtimeAlert&&<div className="cloud-banner"><button type="button" className="cloud-banner-close" aria-label="Fechar aviso" onClick={()=>setDismissRealtimeAlert(true)}>×</button>Existe uma versão mais recente deste campo. Seu texto em edição foi preservado; revise antes de continuar.</div>}
      </div>}
      {selectedTask && (
        selectedTaskObj && selectedTaskAllowed
          ? <TaskPage task={selectedTaskObj} tasks={tasks} setTasks={setTasks} companies={companies} users={users} statuses={statuses} types={effectiveTaskTypes} statusById={statusById} updateTask={updateTask} addLog={addLog} back={closeTaskRoute} open={openTaskRoute} effectiveUser={effectiveUser} isAdmin={isAdmin}/>
          : <TaskAccessDenied back={closeTaskRoute}/>
      )}
      <div style={selectedTask ? {display:'none'} : undefined}>
        <div className="top-actions">
          <SearchBox value={globalSearch} setValue={setGlobalSearch} tasks={visibleTasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={effectiveUser} open={openTaskRoute}/>
          {(effectiveUser.taskPermissions?.canCreate??(effectiveUser.role!=='client'))&&<button className="new-btn" onClick={openCreate}>+ {effectiveUser.taskPermissions?.creationMode==='request'?'Nova solicitação':'Nova tarefa'}</button>}
        </div>
        {activeScreen==='dashboard' && <Dashboard tasks={tasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={effectiveUser} open={openTaskRoute} search=""/>}
        {activeScreen==='teamhub' && effectiveUser.role!=='client' && <TeamHubPage users={users} setUsers={setUsers} setAuth={setAuth} tasks={tasks} statuses={statuses} auth={auth} viewer={effectiveUser} open={openTaskRoute}/>}
        {activeScreen==='tasks' && <TasksWorkspace tabs={taskTabs} requestedTab={screen} tasks={visibleTasks} setTasks={setTasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={effectiveUser} open={openTaskRoute} openCreateForDate={(effectiveUser.taskPermissions?.canCreate??(effectiveUser.role!=='client'))?openCreateForDate:null} updateTask={updateTask}/>} 
        {activeScreen==='planning' && <PlanningPage companies={companies} setCompanies={setCompanies} users={users} tasks={tasks} createWeeklyTasks={createWeeklyTasks} open={openTaskRoute} user={effectiveUser}/>} 
        {activeScreen==='documents' && <DocumentsPage documents={documents} setDocuments={setDocuments} companies={companies} users={users} tasks={tasks} statuses={statuses} currentUser={effectiveUser}/>} 
        {activeScreen==='financial' && <FinancialLab tasks={tasks} companies={companies} users={users} currentUser={effectiveUser}/>} 
        {activeScreen==='settings' && isAdmin && <SettingsPage statuses={statuses} setStatuses={setStatuses} tasks={tasks} setTasks={setTasks} companies={companies} setCompanies={setCompanies} users={users} setUsers={setUsers} system={system} setSystem={setSystem} reset={reset} currentUser={effectiveUser}/>} 
        {activeScreen==='notifications' && effectiveUser.role!=='client' && <NotificationsPage notifications={notifications} setNotifications={setNotifications} open={openTaskRoute} tasks={tasks} companies={companies} users={users} statuses={statuses} user={effectiveUser} auth={auth} alertsEnabled={notificationAlertsEnabled} notificationPermission={notificationPermission} enableAlerts={enableNotificationAlerts}/>} 
      </div>
    </main>
    {createOpen && <CreateModal form={form} setForm={setForm} companies={companies} users={users} statuses={statuses} types={effectiveTaskTypes} createTask={createTask} close={()=>setCreateOpen(false)} user={effectiveUser} permissions={effectiveUser.taskPermissions||builtInTaskPermissionsForRole(effectiveUser.role)}/>} 
  </div>
  </>
}

async function hydrateCloudSession(setAuth,setUsersState,setCompaniesState,setStatusesState,setTasksState,setNotificationsState,setDocumentsState,setSystemState,setCloudReady,setCloudError,setWorkspaceMeta){
  const { data } = await supabase.auth.getSession();
  const profile=await fetchCurrentProfile(data.session);
  const record=await loadWorkspaceRecord(profile.organizationId);
  const payload=normalizeWorkspacePayload(record.payload || EMPTY_CLOUD_STATE);
  const mergedProfile=mergeProfileWithWorkspaceUser(profile,payload);
  let profileUsers=[];
  try{ profileUsers = await loadOrganizationProfiles(profile.organizationId); }
  catch(profileErr){ console.warn('profiles refresh ignored:', profileErr?.message || profileErr); }
  const nextUsers = mergeProfileRowsIntoUsers([mergedProfile, ...(payload.users||[]).filter(u=>u.id!==mergedProfile.id)], profileUsers);
  const nextPayload={...payload, users:nextUsers};
  const currentAuth = nextUsers.find(u=>u.id===mergedProfile.id) || mergedProfile;
  setAuth(currentAuth);
  applyWorkspacePayload(nextPayload,{setUsersState,setCompaniesState,setStatusesState,setTasksState,setNotificationsState,setDocumentsState,setSystemState});
  setCloudReady(true); setCloudError('');
  if(setWorkspaceMeta) setWorkspaceMeta({updatedAt:record.updatedAt, basePayload:clonePayload(workspacePayloadForSave(nextPayload)), lastSavedSignature:payloadSignature(workspacePayloadForSave(nextPayload)), applyingRemote:false});
  if(!record.payload){
    const savedRecord=await saveWorkspaceState(mergedProfile.organizationId,workspacePayloadForSave(nextPayload),null);
    if(setWorkspaceMeta) setWorkspaceMeta({updatedAt:savedRecord.updatedAt, basePayload:clonePayload(savedRecord.payload||workspacePayloadForSave(nextPayload)), lastSavedSignature:payloadSignature(savedRecord.payload||workspacePayloadForSave(nextPayload)), applyingRemote:false});
  }
}
function CloudLogin({setAuth,setUsersState,setCompaniesState,setStatusesState,setTasksState,setNotificationsState,setDocumentsState,setSystemState,setCloudReady,setCloudError,setWorkspaceMeta,cloudError,system}){
  const [email,setEmail]=useState(''); const [pass,setPass]=useState(''); const [busy,setBusy]=useState(false);
  const cachedSystem = load('argos_system_r18', {});
  const loginLogo = system?.loginLogo || system?.logo || cachedSystem?.loginLogo || cachedSystem?.logo || ''; 
  const loginTitle = system?.loginTitle || system?.title || cachedSystem?.loginTitle || cachedSystem?.title || 'Painel de Aprovação';
  const loginSubtitle = system?.loginSubtitle || cachedSystem?.loginSubtitle || 'Entre com seu acesso.';
  async function login(){
    try{ setBusy(true); setCloudError(''); const { error } = await supabase.auth.signInWithPassword({ email, password: pass }); if(error) throw error; await hydrateCloudSession(setAuth,setUsersState,setCompaniesState,setStatusesState,setTasksState,setNotificationsState,setDocumentsState,setSystemState,setCloudReady,setCloudError,setWorkspaceMeta); }
    catch(err){ setCloudError(err.message||'Login inválido.'); }
    finally{ setBusy(false); }
  }
  return <div className="login"><div className="login-card login-card-brand-fixed"><div className="login-logo-big">{loginLogo?<img src={driveDirect(loginLogo)} onError={e=>{ e.currentTarget.style.display='none'; }}/>:null}</div><h1>{loginTitle}</h1><p>{loginSubtitle}</p>{cloudError&&<div className="cloud-error">{cloudError}</div>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="e-mail"/><input value={pass} onChange={e=>setPass(e.target.value)} placeholder="senha" type="password" onKeyDown={e=>{if(e.key==='Enter')login()}}/><button onClick={login} disabled={busy}>{busy?'Entrando...':'Entrar'}</button></div></div>
}

function SetupRequired(){
  return <div className="login"><div className="login-card"><div className="logo">A</div><h1>Configuração necessária</h1><p>O Supabase ainda não foi configurado neste projeto.</p><div className="cloud-error">Crie o arquivo <b>.env</b> na raiz do projeto com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</div><small>Depois reinicie o servidor com npm run dev.</small></div></div>
}

function Login({users,companies,setAuth,system}){ const [email,setEmail]=useState('admin@argos.local'); const [pass,setPass]=useState('123456');
  function login(){ const u=users.find(x=>x.email===email&&x.password===pass); if(!u) return alert('Login inválido'); if(!u.active) return alert('Usuário inativo'); if(u.role==='client' && !(u.companyIds||[]).some(id=>companies.find(c=>c.id===id)?.active)) return alert('Nenhuma empresa ativa vinculada a este usuário.'); setAuth(u); }
  return <div className="login"><div className="login-card"><div className="logo">A</div><h1>{system?.title || 'Painel de Aprovação'}</h1><p>Central de produção, aprovação e operação.</p><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="login"/><input value={pass} onChange={e=>setPass(e.target.value)} placeholder="senha" type="password"/><button onClick={login}>Entrar</button></div></div>
}

function NavIcon({id}){
  const common={viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:'1.8', strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':'true'};
  const icons={
    dashboard:<><rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><path d="M14 17h6M17 14v6"/></>,
    teamhub:<><circle cx="8" cy="8" r="3"/><path d="M3.5 19c.7-3.2 2.4-5 4.5-5s3.8 1.8 4.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M14.4 18.5c.5-2.3 1.8-3.7 3.4-3.7 1.4 0 2.5.9 3.1 2.7"/></>,
    notifications:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 19a2 2 0 0 0 4 0"/></>,
    planning:<><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h4M8 17h7"/></>,
    calendar:<><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></>,
    kanban:<><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 4v16M6.5 8h.01M11.5 12h.01M17.5 9h.01"/></>,
    tasks:<><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></>,
    documents:<><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/><path d="M9 11h6M9 15h6M9 18h4"/></>,
    financial:<><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M2 19h22"/><path d="M4 7l6-4 6 6 6-6"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82V22a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 20.6a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.4 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82V2a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 3.4a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.39.29.73.63 1 1h.09a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1 1z"/></>,
  };
  return <svg className="nav-icon" {...common}>{icons[id] || icons.dashboard}</svg>;
}

function SearchBox({value,setValue,tasks,companies,users,statuses,statusById,user,open}){
  const [show,setShow]=useState(false);
  const wrapRef=useRef(null);
  const q=(value||'').trim().toLowerCase();
  useEffect(()=>{
    function closeOnOutside(ev){
      if(wrapRef.current && !wrapRef.current.contains(ev.target)) setShow(false);
    }
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside, {passive:true});
    return ()=>{
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
    };
  },[]);
  const clearSearch=()=>{ setValue(''); setShow(false); };
  const results=q?tasks.filter(t=>{
    const company=companies.find(c=>c.id===t.companyId)?.name||'';
    const resp=users.find(u=>u.id===t.responsibleId)?.name||'';
    const visibleLogs=(t.logs||[]).filter(l=>user?.role!=='client'||l.visibility==='client'||l.userId===user.id).map(l=>l.text).join(' ');
    return `${t.title} ${company} ${resp} ${t.type} ${t.copy} ${t.caption} ${visibleLogs}`.toLowerCase().includes(q);
  }).slice(0,5):[];
  return <div className="search-wrap" ref={wrapRef}>
    <div className="search-input-shell">
      <input value={value} onFocus={()=>{if(q)setShow(true)}} onChange={e=>{setValue(e.target.value);setShow(true)}} onKeyDown={e=>{if(e.key==='Escape') clearSearch();}} placeholder="Pesquisar tarefa, cliente, copy, legenda ou comentário..."/>
      {q&&<button type="button" className="search-clear" aria-label="Limpar pesquisa" onClick={clearSearch}>×</button>}
    </div>
    {show&&q&&<div className="search-results">{results.length?results.map(t=>{
      const company=companies.find(c=>c.id===t.companyId);
      const responsible=users.find(u=>u.id===t.responsibleId);
      const deadlineColor=taskDeadlineColor(t,statuses,statusById);
      return <button className="search-result-row" key={t.id} onClick={()=>{open(t.id);setShow(false)}}>
        <span className="search-result-main"><b>{t.title}{t.archived?' • Arquivada':''}</b><small>{company?.name||'Sem empresa'}</small></span>
        <span className="search-result-meta">
          <span className="search-result-company" title={`Empresa: ${company?.name||'Sem empresa'}`}><AvatarMini value={company?.logo} label={company?.name}/></span>
          <span className="search-result-responsible" title={`Responsável: ${responsible?.name||'Sem responsável'}`}>{responsible&&<AvatarMini value={responsible.avatar} label={responsible.name}/>}</span>
          <small className="search-result-deadline" style={{borderColor:`${deadlineColor}66`,background:`${deadlineColor}18`,color:deadlineColor}}>{fmtDate(t.internalDate)}</small>
          <small className="search-result-postdate">{t.postDate?fmtDate(t.postDate):'Sem data'}</small>
        </span>
      </button>;
    }):<p>Nenhuma tarefa encontrada.</p>}<small className="search-note">Pesquisa restrita às tarefas permitidas.</small></div>}
  </div>
}
function Sidebar({auth,effectiveUser,viewAs,setViewAs,users,companies=[],notifications=[],system,realAdmin,nav,screen,setScreen,setAuth,notificationAlertsEnabled,notificationPermission,enableNotificationAlerts,disableNotificationAlerts,sidebarCollapsed,setSidebarCollapsed}){
  const [pushStatus,setPushStatus]=useState('idle'); // idle | subscribed | unsupported | busy | denied
  useEffect(()=>{
    let alive=true;
    async function checkSupport(){
      if(!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification==='undefined'){
        if(alive) setPushStatus('unsupported');
        return;
      }
      try{
        const reg=await navigator.serviceWorker.register('/sw.js');
        const existing=await reg.pushManager.getSubscription();
        if(alive) setPushStatus(existing?'subscribed':(Notification.permission==='denied'?'denied':'idle'));
      }catch(err){
        console.warn('sw register failed',err);
        if(alive) setPushStatus('unsupported');
      }
    }
    checkSupport();
    return ()=>{ alive=false; };
  },[]);
  async function subscribePush(){
    if(!auth?.id || pushStatus==='unsupported') return;
    setPushStatus('busy');
    try{
      const permission = await Notification.requestPermission();
      if(permission!=='granted'){ setPushStatus(permission==='denied'?'denied':'idle'); return; }
      let orgId = auth.organizationId;
      if(!orgId){
        const { data: prof, error: profErr } = await supabase
          .from('profiles').select('organization_id').eq('id', auth.id).single();
        if(profErr) throw profErr;
        orgId = prof?.organization_id;
      }
      if(!orgId) throw new Error('Organização não encontrada para este usuário.');
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub){
        sub=await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json=sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        organization_id: orgId,
        profile_id: auth.id,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth_key: json.keys?.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      }, { onConflict:'endpoint' });
      if(error) throw error;
      setPushStatus('subscribed');
    }catch(err){
      console.error('push subscribe failed',err);
      setPushStatus('idle');
    }
  }
  async function unsubscribePush(){
    setPushStatus('busy');
    try{
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.getSubscription();
      if(sub){
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setPushStatus('idle');
    }catch(err){
      console.error('push unsubscribe failed',err);
      setPushStatus('subscribed');
    }
  }
  const notificationsOn = !!notificationAlertsEnabled || pushStatus==='subscribed';
  const notificationsBusy = pushStatus==='busy';
  async function handleNotificationsToggle(){
    if(notificationsBusy) return;
    if(notificationsOn){
      disableNotificationAlerts?.();
      await unsubscribePush();
    }else{
      await enableNotificationAlerts?.();
      await subscribePush();
    }
  }
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const drawerRef=useRef(null);
  const menuButtonRef=useRef(null);
  useEffect(()=>{
    if(!mobileMenuOpen) return;
    const closeOnOutside=(event)=>{
      const target=event.target;
      if(drawerRef.current?.contains(target)) return;
      if(menuButtonRef.current?.contains(target)) return;
      setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside, {passive:true});
    return ()=>{
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
    };
  },[mobileMenuOpen]);
  const clientCompany = effectiveUser.role==='client' ? companies.find(c=>(effectiveUser.companyIds||[]).includes(c.id)) : null;
  const displayAvatar = clientCompany?.logo || effectiveUser.avatar;
  const baseRoleLabel = effectiveUser.title || (effectiveUser.role==='admin'?'Administrador':effectiveUser.role==='team'?'Equipe':'Cliente');
  const roleLabel = viewAs ? 'Visualização simulada' : baseRoleLabel;
  const viewCardSubtitle = realAdmin ? (viewAs ? `${baseRoleLabel} • visão simulada` : 'Minha visão') : baseRoleLabel;
  const activeViewUsers = users.filter(u=>u.active && u.role!=='admin');
  const teamViewUsers = activeViewUsers.filter(u=>u.role==='team').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'}));
  const clientViewUsers = activeViewUsers.filter(u=>u.role==='client');
  const clientViewGroups = [...companies]
    .filter(company=>clientViewUsers.some(user=>(user.companyIds||[]).includes(company.id)))
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'}))
    .map(company=>({
      company,
      users:clientViewUsers
        .filter(user=>(user.companyIds||[]).includes(company.id))
        .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'}))
    }));
  const ungroupedClientViewUsers = clientViewUsers
    .filter(user=>!(user.companyIds||[]).some(companyId=>companies.some(company=>company.id===companyId)))
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'}));
  const goScreen=(id)=>{ setScreen(id); setMobileMenuOpen(false); };
  const pendingNotificationsCount = (notifications||[]).filter(n=>n?.userId===effectiveUser?.id && !n?.done).length;
  return <aside className={'side '+(mobileMenuOpen?'mobile-open':'')+(sidebarCollapsed?' collapsed':'')}>
    <div className="mobile-side-bar">
      <div className="mobile-brand-mini">
        <div className="brand-logo">{system?.logo?<img src={argosLogoSrc(system.logo)} onError={e=>{ e.currentTarget.style.display='none'; }}/>:<span>A</span>}</div>
        <strong>{system?.title || 'Argos approvals'}</strong>
      </div>
      <button type="button" ref={menuButtonRef} className="mobile-menu-toggle" aria-label={mobileMenuOpen?'Fechar menu':'Abrir menu'} onClick={()=>setMobileMenuOpen(v=>!v)}><span></span><span></span><span></span></button>
    </div>
    <div className="side-drawer-shade" onClick={()=>setMobileMenuOpen(false)} />
    <div className="side-drawer" ref={drawerRef}>
      <div className="brand brand-clean brand-logo-only">
        <div className="brand-logo">{system?.logo?<img src={argosLogoSrc(system.logo)} onError={e=>{ e.currentTarget.style.display='none'; }}/>:<span>A</span>}</div>
        <small>{system?.title || 'Painel de Aprovação'}</small>
      </div>
      <div className={`side-user-view-card ${realAdmin?'is-selectable':''}`.trim()}>
        <div className="side-user-view-identity"><AvatarMini value={displayAvatar} label={effectiveUser.name}/><div><b>{effectiveUser.name}</b><small>{viewCardSubtitle}</small></div></div>
        {realAdmin&&<><span className="side-user-view-arrow" aria-hidden="true">▾</span><select className="side-user-view-select" aria-label="Selecionar visualização" value={viewAs?.id||''} onChange={e=>setViewAs(users.find(u=>u.id===e.target.value)||null)}><option value="">Minha visão</option><optgroup label="Pessoas da equipe">{teamViewUsers.length?teamViewUsers.map(u=><option value={u.id} key={u.id}>{u.name}</option>):<option disabled>Nenhuma pessoa ativa</option>}</optgroup>{clientViewGroups.map(group=><optgroup label={group.company.name} key={group.company.id}>{group.users.map(u=><option value={u.id} key={`${group.company.id}-${u.id}`}>{u.name}</option>)}</optgroup>)}{ungroupedClientViewUsers.length>0&&<optgroup label="Sem empresa">{ungroupedClientViewUsers.map(u=><option value={u.id} key={`ungrouped-${u.id}`}>{u.name}</option>)}</optgroup>}{!clientViewGroups.length&&!ungroupedClientViewUsers.length&&<optgroup label="Usuários clientes"><option disabled>Nenhum cliente ativo</option></optgroup>}</select></>}
      </div>
      <div className="side-notif-section">
        <button type="button" className={'side-notif-toggle '+(notificationsOn?'is-on':'')} onClick={handleNotificationsToggle} disabled={notificationsBusy || pushStatus==='unsupported'} aria-pressed={notificationsOn} title={notificationsOn?'Desativar notificações':'Ativar notificações'}>
          <span className="side-notif-toggle-label">🔔 Notificações</span>
          <span className={'side-notif-switch '+(notificationsOn?'on':'off')}><span className="side-notif-switch-knob"/></span>
        </button>
      </div>
      <hr className="side-section-divider"/>
      <nav>{nav.map(([id,label])=><button key={id} onClick={()=>goScreen(id)} className={'nav-btn '+(screen===id?'active':'')}><NavIcon id={id}/><span>{label}</span>{id==='notifications'&&pendingNotificationsCount>0&&<span className="nav-notification-badge" aria-label={`${pendingNotificationsCount} notificações pendentes`}>{pendingNotificationsCount>9?'9+':pendingNotificationsCount}</span>}</button>)}</nav>
      <div className="spacer"/>
      <button onClick={async()=>{ if(isSupabaseConfigured) await supabase.auth.signOut(); setAuth(null); location.reload(); }}>{sidebarCollapsed?'⏻':'Sair'}</button>
    </div>
  </aside> 
}
function ModalDismiss({onClose}){
  const onCloseRef=useRef(onClose);
  useEffect(()=>{ onCloseRef.current=onClose; },[onClose]);
  useEffect(()=>{
    const handleEscape=event=>{
      if(event.key!=='Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current?.();
    };
    window.addEventListener('keydown',handleEscape,true);
    return ()=>window.removeEventListener('keydown',handleEscape,true);
  },[]);
  return <button type="button" className="x modal-close-button" aria-label="Fechar" title="Fechar" onClick={()=>onCloseRef.current?.()}>×</button>;
}
function CreateModal({form,setForm,companies,users,statuses,types,createTask,close,user,permissions}){
  const F=(k,v)=>setForm(k==='postDate'&&permissions?.creationMode==='request'
    ? {...form,postDate:v,internalDate:v}
    : {...form,[k]:v});
  const byName=(a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR',{sensitivity:'base'});
  const teams=users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')).sort(byName);
  const fields=permissions?.createFields||{};
  const allowedCompanies=user?.role==='client'
    ? companies.filter(c=>c.active&&(user.companyIds||[]).includes(c.id))
    : companies.filter(c=>c.active);
  const sortedAllowedCompanies=[...allowedCompanies].sort(byName);
  const isRequest=permissions?.creationMode==='request';

  return <div className="modal-bg"><div className="modal create">
    <ModalDismiss onClose={close}/>
    <h2>{isRequest?'Nova solicitação':'Nova tarefa'}</h2>
    <p>{isRequest?'Envie as informações necessárias para a produção.':'Organize briefing, prazos e materiais da produção.'}</p>

    <label>Nome da {isRequest?'solicitação':'tarefa'}
      <input
        value={form.title}
        onChange={e=>F('title',e.target.value)}
        placeholder={isRequest?'Ex: Campanha de agosto':'Ex: Reels | Oferta Junho'}
      />
    </label>

    {(fields.companyId||fields.responsibleId)&&<div className="form-two">
      {fields.companyId&&<label>Cliente / Empresa
        <div className="select-entity create-select-entity">
          {form.companyId
            ? <AvatarMini value={sortedAllowedCompanies.find(c=>c.id===form.companyId)?.logo} label={sortedAllowedCompanies.find(c=>c.id===form.companyId)?.name||'Empresa'}/>
            : <span className="create-select-placeholder">Selecionar</span>}
          <select value={form.companyId} onChange={e=>F('companyId',e.target.value)}>
            <option value="">Selecionar</option>
            {sortedAllowedCompanies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </div>
      </label>}
      {fields.responsibleId&&<label>Responsável
        <div className="select-entity create-select-entity">
          {form.responsibleId
            ? <AvatarMini value={teams.find(u=>u.id===form.responsibleId)?.avatar} label={teams.find(u=>u.id===form.responsibleId)?.name||'Responsável'}/>
            : <span className="create-select-placeholder">Selecionar</span>}
          <select value={form.responsibleId} onChange={e=>F('responsibleId',e.target.value)}>
            <option value="">Selecionar</option>
            {teams.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}
          </select>
        </div>
      </label>}
    </div>}

    {(fields.type||fields.status)&&<div className="form-two">
      {fields.type&&<label>Tipo
        <select value={form.type} onChange={e=>F('type',e.target.value)}>
          {types.map(t=><option key={t}>{t}</option>)}
        </select>
      </label>}
      {fields.status&&<label>Status
        <div className="status-select">
          {statusDot(statuses.find(s=>s.id===form.status))}
          <select value={form.status} onChange={e=>F('status',e.target.value)}>
            {statuses.filter(s=>s.active).map(s=><option value={s.id} key={s.id} style={{background:`${s.color}20`,color:s.color}}>{s.name}</option>)}
          </select>
        </div>
      </label>}
    </div>}

    {(fields.postDate||fields.internalDate)&&<div className="form-two">
      {fields.postDate&&<label>Data desejada
        <input type="date" value={form.postDate} onChange={e=>F('postDate',e.target.value)}/>
        {isRequest&&<small style={{display:'block',marginTop:8,fontSize:15,fontWeight:700,color:'#f4c542',lineHeight:1.4}}>Prazo sujeito à fila de produção de até 7 dias.</small>}
      </label>}
      {fields.internalDate&&<label className={'date-field '+priorityClass(form.internalDate)}>Prazo
        <input type="date" value={form.internalDate} onChange={e=>F('internalDate',e.target.value)}/>
        <small>{priorityText(form.internalDate)}</small>
      </label>}
    </div>}

    {fields.copyInstructions&&<RichTextField label="Instruções ao copy" value={form.copyInstructions||''} onChange={e=>F('copyInstructions',e.target.value)} placeholder="Explique o objetivo, a abordagem, o tom, o CTA e outras orientações para o texto."/>}

    {fields.editorInstructions&&<RichTextField label="Instruções ao editor" value={form.editorInstructions||''} onChange={e=>F('editorInstructions',e.target.value)} placeholder="Explique o formato, a identidade visual, as imagens e outras orientações para a edição."/>}

    {fields.usefulLinks&&<RichTextField label="Links úteis" value={form.usefulLinks||''} onChange={e=>F('usefulLinks',e.target.value)} placeholder="Cole links e descreva para que serve cada um."/>}

    <hr className="content-fields-divider"/>

    {fields.copy&&<RichTextField label="Copy" value={form.copy||''} onChange={e=>F('copy',e.target.value)} placeholder="Insira o texto do post."/>}

    {fields.caption&&<RichTextField label="Legenda" value={form.caption||''} onChange={e=>F('caption',e.target.value)} placeholder="Insira a legenda do post."/>}

    <hr className="content-fields-divider"/>

    {fields.finalLink&&<RichTextField label="Link da pasta final" value={form.finalLink||''} onChange={e=>F('finalLink',e.target.value)} placeholder="Link liberado ao cliente após a aprovação (ex: pasta do Google Drive)."/>}

    {fields.materialLinks&&<TextFieldWithCopy
      label="Links de material finalizado"
      value={form.materialLinks||''}
      onChange={e=>F('materialLinks',e.target.value)}
      placeholder="Cole um link por linha para artes, vídeos ou arquivos finalizados."
      minHeight={44}
    />}

    <div className="modal-actions">
      <button onClick={close}>Cancelar</button>
      <button className="primary" onClick={createTask}>+ {isRequest?'Enviar solicitação':'Criar tarefa'}</button>
    </div>
  </div></div>;
}

function PeriodFilters({period,setPeriod,from,setFrom,to,setTo}){ return <><label>Período<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="current">Atualmente</option><option value="month">Mês corrente</option><option value="lastmonth">Mês passado</option><option value="week">Essa semana</option><option value="lastweek">Semana passada</option><option value="today">Hoje</option><option value="custom">Personalizado</option></select></label>{period==='custom'&&<><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></>}</> }
function PanelTabsHeader({title,tabs=[],active,onChange,actions=null,className=''}){
  return <div className={`panel-header-block ${className}`.trim()}><div className="panel-tabs-header"><div className="panel-tabs-heading"><h1>{title}</h1>{tabs.length>0&&<div className="panel-tabs" role="tablist">{tabs.map(([id,label])=>{const selected=active===id;return <span key={id} role="tab" tabIndex={0} aria-selected={selected} aria-current={selected?'page':undefined} className={`panel-tab-link ${selected?'active':''}`.trim()} onClick={()=>onChange(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onChange(id)}}}>{label}</span>})}</div>}</div></div>{actions&&<div className="panel-header-tools">{actions}</div>}</div>;
}

function Dashboard({tasks,companies,users,statuses,statusById,user,open,search=''}){ 
  const preferencesStorageKey=`argos_dashboard_preferences_${user?.id||'anonymous'}`;
  const initialPreferences=load(preferencesStorageKey,{period:'current',from:'',to:'',company:'all',resp:'all',type:'all',tab:'summary'});
  const [period,setPeriod]=useState(initialPreferences.period||'current'),[from,setFrom]=useState(initialPreferences.from||''),[to,setTo]=useState(initialPreferences.to||''),[company,setCompany]=useState(initialPreferences.company||'all'),[resp,setResp]=useState(initialPreferences.resp||'all'),[type,setType]=useState(initialPreferences.type||'all'); 
  const [tab,setTab]=useState(initialPreferences.tab||'summary'),[selectedEntity,setSelectedEntity]=useState('');
  useEffect(()=>{ save(preferencesStorageKey,{period,from,to,company,resp,type,tab}); },[preferencesStorageKey,period,from,to,company,resp,type,tab]);
  const isAdmin=user.role==='admin'; 
  const visible={...fullDashboardVisibility(),...(user.dashboardPermissions?.visible||{})};
  const activeCompanies=companies.filter(c=>c.active);
  const activeUsers=sortMembersAdminFirst(users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')));
  // No Dashboard da equipe, os números precisam considerar todos os posts atribuídos ao membro,
  // mesmo quando o status ainda não faz parte dos status visíveis dele no Kanban/Tarefas.
  const dashboardScope = user.role==='team' ? (tasks||[]).filter(t=>t.responsibleId===user.id) : (tasks||[]);
  const operationalTasks=dashboardScope.filter(t=>activeCompanies.some(c=>c.id===t.companyId) && activeUsers.some(u=>u.id===t.responsibleId));
  const filtered=applyFilters(operationalTasks,{period:visible.showPeriodFilter===false?'current':period,from,to,company:visible.showCompanyFilter!==false?company:'all',resp:visible.showTeamFilter!==false?resp:'all',type:visible.showTypeFilter===false?'all':type,search,showArchived:true}); 
  const alterations=filtered.reduce((a,t)=>a+(t.alterationCount||0),0);
  const finalized=filtered.filter(t=>isFinalStatus(statuses,t.status)).length;
  const rework=filtered.length?Math.round(alterations/filtered.length*100):0;
  const total=filtered.reduce((a,t)=>a+(t.totalEditSeconds||0)+(t.totalAlterSeconds||0),0);
  const quickCards=[
    isAdmin&&visible.activeCompanies&&<Card key="activeCompanies" title="Clientes ativos" value={activeCompanies.length}/>,
    user.role==='team'&&visible.postCount&&<Card key="postCount" title="Quantidade de posts" value={filtered.length}/>,
    visible.periodPosts&&<Card key="periodPosts" title={user.role==='team'?'Posts finalizados':'Posts no período'} value={user.role==='team'?finalized:filtered.length}/>,
    visible.alterations&&<Card key="alterations" title="Alterações" value={alterations}/>,
    visible.reworkRate&&<Card key="reworkRate" title="Taxa de retrabalho" value={`${rework}%`}/>
  ].filter(Boolean);
  const timeCards=[
    visible.totalTime&&<Card key="totalTime" title="Tempo total" value={fmtSec(total)}/>,
    visible.averagePerPost&&<Card key="averagePerPost" title="Média por post" value={fmtSec(avg(filtered.map(t=>(t.totalEditSeconds||0)+(t.totalAlterSeconds||0))))}/>,
    visible.averageEditing&&<Card key="averageEditing" title="Média em edição" value={fmtSec(avg(filtered.map(t=>t.totalEditSeconds||0)))}/>,
    visible.averageAlteration&&<Card key="averageAlteration" title="Média em alteração" value={fmtSec(avg(filtered.map(t=>t.totalAlterSeconds||0)))}/>
  ].filter(Boolean);
  const sortChartRows=rows=>[...rows].sort((a,b)=>b[1]-a[1] || String(a[0]).localeCompare(String(b[0]),'pt-BR',{sensitivity:'base'}));
  const charts=[
    visible.statusChart&&<Bar key="statusChart" title="Post por Status" rows={statuses.map(s=>[s.name,filtered.filter(t=>t.status===s.id).length,s.color])}/>,
    visible.typeChart&&<Bar key="typeChart" title="Por tipo" tone="gold" rows={sortChartRows(TASK_TYPES.map(tp=>[tp,filtered.filter(t=>t.type===tp).length,'var(--gold)']))}/>,
    visible.companyChart&&<Bar key="companyChart" title="Por cliente" tone="gold" rows={sortChartRows(activeCompanies.map(c=>[c.name,filtered.filter(t=>t.companyId===c.id).length,'var(--gold)',c.logo]))}/>,
    isAdmin&&visible.memberChart&&<Bar key="memberChart" title="Por membro" tone="gold" rows={sortChartRows(activeUsers.map(u=>[u.name,filtered.filter(t=>t.responsibleId===u.id).length,'var(--gold)',u.avatar]))}/>
  ].filter(Boolean);
  const detailTabs=[
    visible.showSummaryTab!==false&&['summary','Resumo'],
    visible.showTeamTab!==false&&['team','Equipe'],
    visible.showCompaniesTab!==false&&['companies','Clientes'],
    visible.showTypesTab!==false&&['types','Tipos'],
    visible.showCargaTab!==false&&['carga','Carga'],
  ].filter(Boolean);
  const effectiveTab=detailTabs.some(([id])=>id===tab)?tab:(detailTabs[0]?.[0]||'summary');
  useEffect(()=>{if(effectiveTab!==tab)setTab(effectiveTab);},[effectiveTab,tab]);
  const entityOptions=effectiveTab==='team'||effectiveTab==='carga'?activeUsers.map(item=>({id:item.id,name:item.name,avatar:item.avatar})):effectiveTab==='companies'?activeCompanies.map(item=>({id:item.id,name:item.name,avatar:item.logo})):effectiveTab==='types'?TASK_TYPES.map(item=>({id:item,name:item})):[];
  useEffect(()=>{if(effectiveTab==='summary'||!entityOptions.some(item=>item.id===selectedEntity))setSelectedEntity('');},[effectiveTab,entityOptions.map(item=>item.id).join('|')]);
  const entityTasks=effectiveTab==='team'||effectiveTab==='carga'?filtered.map(task=>({...task,__entityId:task.responsibleId})):effectiveTab==='companies'?filtered.map(task=>({...task,__entityId:task.companyId})):effectiveTab==='types'?filtered.map(task=>({...task,__entityId:task.type})):[];
  return <section className="dashboard-page"><PanelTabsHeader title="Dashboard" tabs={detailTabs} active={effectiveTab} onChange={setTab}/><div className="filters">{visible.showPeriodFilter!==false&&<PeriodFilters period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={setTo}/>} {visible.showCompanyFilter!==false&&<label>Cliente<select value={company} onChange={e=>setCompany(e.target.value)}><option value="all">Todos</option>{activeCompanies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}{visible.showTeamFilter!==false&&<label>Equipe<select value={resp} onChange={e=>setResp(e.target.value)}><option value="all">Todos</option>{activeUsers.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></label>}{visible.showTypeFilter!==false&&<label>Tipo de post<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>}</div>{effectiveTab==='summary'?<>{(quickCards.length||timeCards.length)?<div className="dash-zone">{quickCards.length>0&&<div className="cards quick-cards">{quickCards}</div>}{timeCards.length>0&&<div className="cards time-cards">{timeCards}</div>}</div>:null}{charts.length>0&&<div className="grid2">{charts}</div>}</>:(effectiveTab==='carga'?<DashboardCargaDetail options={entityOptions} tasks={entityTasks} liveTasks={tasks} users={activeUsers} selected={selectedEntity} setSelected={setSelectedEntity} statusById={statusById} viewerId={user.id} canViewAll={isAdmin}/>:<DashboardEntityDetail mode={tab} options={entityOptions} selected={selectedEntity} setSelected={setSelectedEntity} tasks={entityTasks} companies={companies} users={users} statusById={statusById} statuses={statuses} open={open}/>)}</section>
}
function DashboardEntityDetail({mode,options,selected,setSelected,tasks,companies,users,statusById,open}){
  const [sort,setSort]=useState({key:'count',direction:'desc'});
  const rows=options.map(item=>{
    const itemTasks=tasks.filter(task=>task.__entityId===item.id);
    const edit=itemTasks.reduce((sum,task)=>sum+(task.totalEditSeconds||0),0),alter=itemTasks.reduce((sum,task)=>sum+(task.totalAlterSeconds||0),0),total=edit+alter,changes=itemTasks.reduce((sum,task)=>sum+(task.alterationCount||0),0);
    return {...item,tasks:itemTasks,edit,alter,total,changes,average:itemTasks.length?Math.round(total/itemTasks.length):0,rate:total?Math.round(alter/total*100):0};
  });
  const sortValue=(row,key)=>key==='name'?row.name:key==='count'?row.tasks.length:row[key]||0;
  const orderedRows=[...rows].sort((a,b)=>{const av=sortValue(a,sort.key),bv=sortValue(b,sort.key);const comparison=sort.key==='name'?String(av).localeCompare(String(bv),'pt-BR',{sensitivity:'base'}):av-bv;return (sort.direction==='asc'?comparison:-comparison)||String(a.name).localeCompare(String(b.name),'pt-BR',{sensitivity:'base'});});
  const changeSort=key=>setSort(current=>current.key===key?{key,direction:current.direction==='asc'?'desc':'asc'}:{key,direction:key==='name'?'asc':'desc'});
  const headings=[['name','Nome'],['count','Qt. tarefas'],['average','Tempo médio'],['total','Tempo total'],['edit','Edição'],['alter','Alteração'],['rate','Taxa alt.']];
  const marksFor=task=>{const company=companies.find(item=>item.id===task.companyId),responsible=users.find(item=>item.id===task.responsibleId),status=statusById[task.status];return <span className="dashboard-task-marks">{mode!=='companies'&&company&&<AvatarMini value={company.logo} label={company.name}/>} {mode!=='team'&&responsible&&<AvatarMini value={responsible.avatar} label={responsible.name}/>}<span className="dashboard-status" style={{color:status?.color,borderColor:`${status?.color||'#777'}66`,background:`${status?.color||'#777'}18`}}>{status?.name||task.status}</span></span>};
  return <div className="dashboard-detail panel dashboard-entity-list"><div className="dashboard-entity-head">{headings.map(([key,label])=><button type="button" className="dashboard-sort-heading" key={key} onClick={()=>changeSort(key)} aria-label={`Ordenar por ${label}`}><span>{label}</span>{sort.key===key&&<span className="dashboard-sort-arrow">{sort.direction==='asc'?'▲':'▼'}</span>}</button>)}</div>{orderedRows.map(row=>{const expanded=selected===row.id;const sorted=[...row.tasks].sort((a,b)=>((b.totalEditSeconds||0)+(b.totalAlterSeconds||0))-((a.totalEditSeconds||0)+(a.totalAlterSeconds||0))||String(a.title||'').localeCompare(String(b.title||''),'pt-BR'));return <div className="dashboard-entity-group" key={row.id}><button type="button" className={`dashboard-entity-summary${expanded?' active':''}`} aria-expanded={expanded} onClick={()=>setSelected(expanded?'':row.id)}><span className="dashboard-entity-name"><span className="dashboard-chevron">{expanded?'⌄':'›'}</span>{row.avatar&&<AvatarMini value={row.avatar} label={row.name}/>}<strong>{row.name}</strong></span><span className="dashboard-stat">{row.tasks.length}</span><span className="dashboard-stat">{fmtSec(row.average)}</span><span className="dashboard-stat">{fmtSec(row.total)}</span><span className="dashboard-stat">{fmtSec(row.edit)}</span><span className="dashboard-stat">{fmtSec(row.alter)}</span><span className="dashboard-stat">{row.rate}%</span></button>{expanded&&<div className="dashboard-task-detail">{sorted.map(task=>{const edit=task.totalEditSeconds||0,alter=task.totalAlterSeconds||0,total=edit+alter;return <button type="button" className="dashboard-task-detail-row" key={task.id} onClick={()=>open?.(task.id)}><span className="dashboard-task-identity"><span className="dashboard-chevron">−</span><strong className="dashboard-task-name">{task.title}</strong></span>{marksFor(task)}<span className="dashboard-task-empty-column" aria-hidden="true"/><span>{fmtSec(total)}</span><span>{fmtSec(edit)}</span><span>{fmtSec(alter)}</span><span>{task.alterationCount||0}</span></button>})}{!sorted.length&&<div className="dashboard-empty-detail">Nenhuma tarefa encontrada nesse período.</div>}</div>}</div>})}{!orderedRows.length&&<div className="dashboard-empty-detail">Nenhuma opção disponível.</div>}</div>;
}
function DashboardCargaDetail({options,tasks,liveTasks=[],users=[],selected,setSelected,statusById,viewerId='',canViewAll=false}){
  const editColor=statusById?.['edicao']?.color||'#a855f7';
  const alterColor=statusById?.['alteracao']?.color||'#ef4444';
  const rows=options.map(item=>{
    const itemTasks=tasks.filter(task=>task.__entityId===item.id);
    const edit=itemTasks.reduce((sum,task)=>sum+(task.totalEditSeconds||0),0),alter=itemTasks.reduce((sum,task)=>sum+(task.totalAlterSeconds||0),0),total=edit+alter;
    const fullUser=users.find(u=>u.id===item.id)||null;
    const online=isUserOnline(fullUser);
    const activeTask=activeTimerTaskForUser(liveTasks,fullUser);
    const canSeeDetails=canViewAll||item.id===viewerId;
    return {...item,tasks:itemTasks,edit,alter,total,online,activeTask,canSeeDetails};
  }).sort((a,b)=>b.total-a.total||String(a.name).localeCompare(String(b.name),'pt-BR',{sensitivity:'base'}));
  return <div className="dashboard-detail panel dashboard-entity-list dashboard-carga-list">
    {rows.map(row=>{
      const expanded=row.canSeeDetails&&selected===row.id;
      const sorted=[...row.tasks].sort((a,b)=>((b.totalEditSeconds||0)+(b.totalAlterSeconds||0))-((a.totalEditSeconds||0)+(a.totalAlterSeconds||0))||String(a.title||'').localeCompare(String(b.title||''),'pt-BR'));
      const maxTotal=Math.max(1,...sorted.map(t=>(t.totalEditSeconds||0)+(t.totalAlterSeconds||0)));
      return <div className="dashboard-entity-group" key={row.id}>
        <button type="button" className={`dashboard-entity-summary carga-entity-summary${expanded?' active':''}${row.canSeeDetails?'':' carga-locked'}`} aria-expanded={expanded} disabled={!row.canSeeDetails} onClick={()=>row.canSeeDetails&&setSelected(expanded?'':row.id)}>
          <span className="dashboard-entity-name"><span className="dashboard-chevron">{row.canSeeDetails?(expanded?'⌄':'›'):''}</span>{row.avatar&&<AvatarMini value={row.avatar} label={row.name}/>}<strong>{row.name}</strong></span>
          <span className="carga-status">{row.online&&<><span className="carga-online-tag">Online</span>{row.activeTask&&<span className="carga-active-task">{row.canSeeDetails?row.activeTask.title:'Em trabalho'}</span>}</>}</span>
          <span className="dashboard-stat">{row.canSeeDetails?`${row.tasks.length} tarefa(s)`:'—'}</span>
          <span className="dashboard-stat">{row.canSeeDetails?fmtSec(row.total):''}</span>
        </button>
        {expanded&&<div className="carga-task-list">
          {sorted.map(task=>{
            const edit=task.totalEditSeconds||0,alter=task.totalAlterSeconds||0,total=edit+alter;
            const editPct=total?edit/total*100:0,alterPct=total?alter/total*100:0;
            const widthPct=total/maxTotal*100;
            return <div className="carga-task-row" key={task.id}>
              <div className="carga-task-head"><strong>{task.title}</strong><span>{fmtSec(total)}</span></div>
              <div className="carga-task-track"><div className="carga-task-fill" style={{width:`${widthPct}%`}}>
                {edit>0&&<span style={{width:`${editPct}%`,background:editColor}} title={`Edição: ${fmtSec(edit)}`}/>}
                {alter>0&&<span style={{width:`${alterPct}%`,background:alterColor}} title={`Alteração: ${fmtSec(alter)}`}/>}
              </div></div>
            </div>
          })}
          {!sorted.length&&<div className="dashboard-empty-detail">Nenhuma tarefa encontrada nesse período.</div>}
        </div>}
      </div>
    })}
    {!rows.length&&<div className="dashboard-empty-detail">Nenhuma opção disponível.</div>}
    <div className="carga-legend"><span><i style={{background:editColor}}/>Edição</span><span><i style={{background:alterColor}}/>Alteração</span></div>
  </div>;
}
function Card({title,value}){ return <div className="card"><small>{title}</small><b>{value}</b></div> }
function Bar({title,rows,tone=''}){
  const max=Math.max(1,...rows.map(r=>r[1]));
  return <div className={`panel dashboard-chart${tone?` dashboard-chart--${tone}`:''}`}><h2>{title}</h2>{rows.map(([label,val,color,avatar])=><div className="bar" key={label} style={{display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',columnGap:12}}><span className="bar-label" style={{display:'inline-flex',alignItems:'center',gap:8,minWidth:0}}>{avatar&&<AvatarMini value={avatar} label={label}/>}<span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span></span><b>{val}</b><i style={{gridColumn:'1 / -1'}}><em style={{width:`${val/max*100}%`,background:color,color}}/></i></div>)}</div>
}

function TeamHubPage({users,setUsers,setAuth,tasks,statuses,auth,viewer,open}){
  const permissions={...builtInPortfolioPermissionsForRole(viewer?.role||auth?.role),...(viewer?.portfolioPermissions||{})};
  const allMembers=sortMembersAdminFirst(users.filter(u=>u.active && (u.role==='admin'||u.role==='team')));
  const selfId=viewer?.id || auth?.id || '';
  const ownMember=allMembers.find(u=>u.id===selfId)||null;
  const baseMembers=permissions.canViewOtherMembers?allMembers:(ownMember?[ownMember]:allMembers.slice(0,1));
  const members=selfId?[...baseMembers.filter(u=>u.id===selfId),...baseMembers.filter(u=>u.id!==selfId)]:baseMembers;
  const [selectedId,setSelectedId]=useState(()=>selfId || members[0]?.id || '');
  const [page,setPage]=useState(0);
  const selected=members.find(u=>u.id===selectedId) || members[0] || null;

  useEffect(()=>{
    if(selected && selected.id!==selectedId) setSelectedId(selected.id);
  },[selected?.id]);

  useEffect(()=>{ setPage(0); },[selected?.id]);

  const portfolio=useMemo(()=>{
    if(!selected) return [];
    return (tasks||[])
      .filter(t=>t.responsibleId===selected.id && isPortfolioTask(t,statuses))
      .sort((a,b)=>portfolioDateValue(b)-portfolioDateValue(a));
  },[tasks,statuses,selected?.id]);

  const selectedStats=useMemo(()=>memberWorkStats(tasks,selected,statuses),[tasks,statuses,selected?.id]);
  const totalPages=Math.max(1,Math.ceil(portfolio.length/12));
  const safePage=Math.min(page,totalPages-1);
  const visiblePosts=portfolio.slice(safePage*12,safePage*12+12);

  function updateOwnSocial(patch){
    if(!auth?.id || !permissions.canEditOwnProfile) return;
    const normalized={
      ...(Object.prototype.hasOwnProperty.call(patch,'socialInstagram')?{socialInstagram:String(patch.socialInstagram||'').trim()}:{}),
      ...(Object.prototype.hasOwnProperty.call(patch,'socialStatus')?{socialStatus:String(patch.socialStatus||'').trim().slice(0,140)}:{})
    };
    setUsers(prev=>prev.map(u=>u.id===auth.id?{...u,...normalized}:u));
    if(typeof setAuth==='function') setAuth(prev=>prev&&prev.id===auth.id?{...prev,...normalized}:prev);
    if(isSupabaseConfigured){
      updateProfileSocial(auth.id,normalized).catch(err=>alert('Não foi possível salvar seu perfil social: '+(err.message||err)));
    }
  }

  if(!members.length) return <section><PanelTabsHeader title="Portfólios"/><p>Nenhum membro ativo encontrado.</p></section>;

  return <section className="team-hub">
    <PanelTabsHeader title="Portfólios"/>

    {permissions.showMemberSelector&&<TeamStoriesStrip members={members} selected={selected} tasks={tasks} setSelectedId={setSelectedId}/>}

    <div className="team-profile-area">
      {selected&&permissions.showProfileHeader&&<TeamProfileHeader
        member={selected}
        tasks={tasks}
        statuses={statuses}
        stats={selectedStats}
        showStats={permissions.showStats}
        canEdit={permissions.canEditOwnProfile&&selected.id===auth?.id}
        updateOwnSocial={updateOwnSocial}
      />}

      {permissions.showPosts&&<>
        <div className="team-feed-toolbar" aria-hidden="true"></div>
        {visiblePosts.length
          ? <div className="team-feed-grid">{visiblePosts.map(t=><TeamFeedItem key={t.id} task={t} open={open} canOpen={permissions.canOpenPosts}/>)}</div>
          : <div className="empty-team-feed inline-empty"><p>Nenhum trabalho agendado/finalizado com material ainda.</p></div>
        }

        {permissions.showPagination&&portfolio.length>12&&<div className="team-feed-pager">
          <button disabled={safePage<=0} onClick={()=>setPage(p=>Math.max(0,p-1))}>← Anteriores</button>
          <span>Página {safePage+1} de {totalPages}</span>
          <button disabled={safePage>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}>Próximos →</button>
        </div>}
      </>}
    </div>
  </section>;
}

function TeamStoriesStrip({members,selected,tasks,setSelectedId}){
  return <div className="team-stories-strip panel" aria-label="Membros da equipe">
    {members.map(m=>{
      const online=isUserOnline(m);
      const activeTask=activeTimerTaskForUser(tasks,m);
      const selectedClass=selected?.id===m.id?'selected':'';
      return <button key={m.id} className={'team-story '+selectedClass} onClick={()=>setSelectedId(m.id)} title={safeMemberName(m)}>
        <span className={'team-story-avatar '+(online?'online':'offline')+' '+(activeTask?'working':'')}><AvatarMini value={m.avatar} label={safeMemberName(m)}/></span>
        <span>{socialUsernameLabel(m).replace(/^@/,'') || safeMemberName(m)}</span>
        {activeTask&&<i>●</i>}
      </button>
    })}
  </div>;
}

function OwnSocialEditor({user,update}){
  const [open,setOpen]=useState(false);
  const [instagram,setInstagram]=useState(user?.socialInstagram || user?.instagramUsername || user?.socialUsername || '');
  const [status,setStatus]=useState(user?.socialStatus || user?.statusMessage || '');
  useEffect(()=>{ setInstagram(user?.socialInstagram || user?.instagramUsername || user?.socialUsername || ''); setStatus(user?.socialStatus || user?.statusMessage || ''); },[user?.id,user?.socialInstagram,user?.socialStatus]);
  if(!user) return null;
  function save(){
    update({ socialInstagram:String(instagram||'').trim(), socialStatus:String(status||'').trim().slice(0,120) });
    setOpen(false);
  }
  return <div className="own-social-editor">
    <button type="button" onClick={()=>setOpen(!open)}>{open?'Fechar meu recado':'Editar meu recado'}</button>
    {open&&<div className="own-social-form">
      <label>@ Instagram<input value={instagram} onChange={e=>setInstagram(e.target.value)} placeholder="@seuuser"/></label>
      <label>Recado<textarea value={status} maxLength={120} onChange={e=>setStatus(e.target.value)} placeholder="No que você está focado hoje?"/></label>
      <button className="primary" type="button" onClick={save}>Salvar</button>
    </div>}
  </div>;
}

function TeamProfileHeader({member,tasks,statuses,stats,showStats=true,canEdit=false,updateOwnSocial}){
  const online=isUserOnline(member);
  const activeTask=activeTimerTaskForUser(tasks,member);
  const [editing,setEditing]=useState(false);
  const [instagram,setInstagram]=useState(member?.socialInstagram || member?.instagramUsername || member?.socialUsername || '');
  const [status,setStatus]=useState(member?.socialStatus || member?.statusMessage || '');
  useEffect(()=>{
    setInstagram(member?.socialInstagram || member?.instagramUsername || member?.socialUsername || '');
    setStatus(member?.socialStatus || member?.statusMessage || '');
    setEditing(false);
  },[member?.id, member?.socialInstagram, member?.socialStatus, member?.instagramUsername, member?.statusMessage]);
  const displayName=safeMemberName(member);
  const currentInstagram=socialUsernameLabel({...member,socialInstagram:instagram});
  const handle=socialUsernameLabel(member) || displayName;
  const roleText=member.title || (member.role==='admin'?'Administrador':'Membro');
  const workTitle=activeTask?.title || '';
  function save(){
    updateOwnSocial?.({ socialInstagram:String(instagram||'').trim(), socialStatus:String(status||'').trim().slice(0,140) });
    setEditing(false);
  }
  function cancel(){
    setInstagram(member?.socialInstagram || member?.instagramUsername || member?.socialUsername || '');
    setStatus(member?.socialStatus || member?.statusMessage || '');
    setEditing(false);
  }
  return <div className="team-profile-header insta-profile-header">
    <div className={'team-profile-avatar '+(online?'online':'offline')+' '+(activeTask?'working':'')}><AvatarMini value={member.avatar} label={displayName}/></div>
    <div className="team-profile-main">
      <div className="team-profile-name-row insta-name-row">
        {editing?
          <input className="inline-social-input username-inline" value={instagram} onChange={e=>setInstagram(e.target.value)} placeholder="@instagram" autoFocus/>:
          <h2>{handle}</h2>
        }
        <span className={'presence-pill '+(online?'on':'off')}>{online?'Online':'Offline'}</span>
        {activeTask&&<span className="presence-pill working">Em trabalho</span>}
        {canEdit&&!editing&&<button className="profile-gear" type="button" onClick={()=>setEditing(true)} title="Editar recado e Instagram">⚙</button>}
        {editing&&<div className="inline-edit-actions"><button type="button" className="mini-save" onClick={save}>Salvar</button><button type="button" className="mini-cancel" onClick={cancel}>Cancelar</button></div>}
      </div>
      {showStats&&<div className="team-profile-stats insta-stats">
        <span><b>{stats?.assigned||0}</b> atribuídos</span>
        <span><b>{stats?.scheduled||0}</b> agendados</span>
        <span><b>{stats?.finished||0}</b> finalizados</span>
      </div>}
      <b className="profile-display-name">{displayName}</b>
      <p className="profile-role-text">{roleText}</p>
      {editing?
        <textarea className="inline-social-textarea" value={status} maxLength={140} onChange={e=>setStatus(e.target.value)} placeholder="Recado curto para a equipe..."/>:
        (status?<div className="team-status-bio">{status}</div>:canEdit?<div className="team-status-bio empty-status">Sem recado.</div>:null)
      }
      {activeTask&&<small className="team-work-note">Timer ativo: {workTitle}</small>}
    </div>
  </div>;
}

function TeamFeedItem({task,open,canOpen=true}){
  const links=taskMaterialLinks(task);
  const [slide,setSlide]=useState(0);
  const index=Math.min(slide, Math.max(0, links.length-1));
  if(!links.length) return null;
  return <article className="team-feed-item">
    <div className="team-feed-media"><Media url={links[index]} type={task.type} slide={index} total={links.length}/>{links.length>1&&<div className="team-feed-arrows"><button className="feed-arrow prev" onClick={()=>setSlide(i=>Math.max(0,i-1))} disabled={index<=0} aria-label="Arte anterior">‹</button><button className="feed-arrow next" onClick={()=>setSlide(i=>Math.min(links.length-1,i+1))} disabled={index>=links.length-1} aria-label="Próxima arte">›</button></div>}</div>
    <footer className="team-feed-task-link">
      <span title={task.title}>{task.title}</span>
      {canOpen&&<button type="button" onClick={()=>open?.(task.id)}>Abrir tarefa ↗</button>}
    </footer>
  </article>;
}

function TasksWorkspace({tabs,requestedTab,tasks,setTasks,companies,users,statuses,statusById,user,open,openCreateForDate,updateTask}){
  const ownHiddenRequests = user?.role==='client'
    ? tasks.filter(t=>!(user.visibleStatuses||[]).includes(t.status))
    : [];
  const fullTabs = user?.role==='client' ? [...tabs,['ownRequests','Solicitações']] : tabs;
  const allowedIds=fullTabs.map(([id])=>id);
  const storageKey=`argos:tasks-workspace-tab:${user?.id||user?.role||'user'}`;
  const resolveInitialTab=()=>{
    if(requestedTab!=='tasks'&&allowedIds.includes(requestedTab)) return requestedTab;
    try{
      const saved=localStorage.getItem(storageKey);
      if(allowedIds.includes(saved)) return saved;
    }catch{}
    return allowedIds[0]||'tasks';
  };
  const [tab,setTab]=useState(resolveInitialTab);
  useEffect(()=>{
    if(!allowedIds.includes(tab)) setTab(resolveInitialTab());
  },[fullTabs.map(([id])=>id).join('|'),requestedTab,user?.id]);
  const changeTab=next=>{
    if(!allowedIds.includes(next)) return;
    setTab(next);
    try{ localStorage.setItem(storageKey,next); }catch{}
    if(requestedTab!=='tasks') setAppRoute({screen:'tasks'});
  };
  if(!fullTabs.length) return <section><PanelTabsHeader title="Tarefas"/><div className="panel"><p className="muted">Nenhuma visualização de tarefas está liberada para este usuário.</p></div></section>;
  return <section className="tasks-workspace">
    <PanelTabsHeader title="Tarefas" tabs={fullTabs} active={tab} onChange={changeTab}/>
    {tab==='ownRequests'&&<div className="panel own-requests-panel">
      <p className="muted">Solicitações da sua empresa que ainda não entraram na etapa de produção visível — qualquer pessoa da empresa pode acompanhar e comentar aqui.</p>
      {ownHiddenRequests.length?<div className="own-requests-rows">{ownHiddenRequests.map(t=>{
        const st=statusById[t.status];
        return <button key={t.id} className="task-row task-list-row own-request-row" onClick={()=>open(t.id)}>
          <b>{t.title}</b>
          <span className="status-pill" style={{color:st?.color,background:`${st?.color}20`,borderColor:st?.color}}>{st?.name||t.status}</span>
          <small className="muted">{fmtDate(t.postDate)}</small>
        </button>;
      })}</div>:<p className="muted-note">Nenhuma solicitação pendente no momento.</p>}
    </div>}
    {tab==='kanban'&&<Kanban tasks={tasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={user} open={open} search="" embedded updateTask={updateTask}/>}
    {tab==='calendar'&&<Calendar tasks={tasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={user} open={open} search="" embedded onQuickAdd={openCreateForDate} updateTask={updateTask}/>}
    {tab==='tasks'&&<TasksPanel tasks={tasks} setTasks={setTasks} companies={companies} users={users} statuses={statuses} statusById={statusById} user={user} open={open} embedded/>}
  </section>;
}
function TasksPanel({tasks,setTasks,companies,users,statuses,statusById,user,open,embedded=false}){
  const collapseStorageKey=`argos_tasks_collapsed_${user?.id||'anonymous'}`;
  const preferencesStorageKey=`argos_tasks_preferences_${user?.id||'anonymous'}`;
  const initialPreferences=load(preferencesStorageKey,{mode:'priority',showArchived:false});
  const [mode,setMode]=useState(initialPreferences.mode==='date'?'priority':(initialPreferences.mode||'priority')),[showArchived,setShowArchived]=useState(!!initialPreferences.showArchived),[selected,setSelected]=useState([]),[bulkEdit,setBulkEdit]=useState(null),[bulkValue,setBulkValue]=useState(''),[collapsedGroups,setCollapsedGroups]=useState(()=>load(collapseStorageKey,{}));
  const isAdmin=user.role==='admin';
  const permissions={...builtInTasksListPermissionsForRole(user.role),...(user.tasksListPermissions||{})};
  const teams=users.filter(u=>u.active&&(u.role==='team'||u.role==='admin'));
  const activeStatuses=statuses.filter(s=>s.active!==false);
  const visibleForArchive = permissions.showArchivedToggle && showArchived ? tasks.filter(t=>t.archived) : tasks.filter(t=>!t.archived);
  const filtered=visibleForArchive
    .filter(t=>showArchived || mode==='status' || !isFinishedTask(t,statuses));
  const selectedFiltered = selected.filter(id=>filtered.some(t=>t.id===id));
  const priorityOrder={late:0,hot:1,warn:2,ok:3,neutral:4,done:5};
  useEffect(()=>{ save(preferencesStorageKey,{mode,showArchived}); },[preferencesStorageKey,mode,showArchived]);
  const groupers={
    priority:t=>taskPriorityGroup(t,statuses),
    status:t=>statusById[t.status]?.name||t.status,
    client:t=>companies.find(c=>c.id===t.companyId)?.name||'Sem cliente',
    type:t=>t.type,
    responsible:t=>users.find(u=>u.id===t.responsibleId)?.name||'Sem responsável'
  };
  const sorted=[...filtered].sort((a,b)=>{
    if(showArchived && permissions.showArchivedToggle && (a.archived!==b.archived)) return a.archived?1:-1;
    return priorityOrder[taskPriorityClass(a,statuses)]-priorityOrder[taskPriorityClass(b,statuses)] || String(a.internalDate||'').localeCompare(String(b.internalDate||'')) || a.title.localeCompare(b.title);
  });
  const groups={}; sorted.forEach(t=>{const k=(groupers[mode]||groupers.priority)(t); (groups[k] ||= []).push(t)});
  const groupEntries=Object.entries(groups).sort(([groupA],[groupB])=>{
    if(mode==='status'){
      const order=new Map(activeStatuses.map((status,index)=>[status.name,index]));
      const a=order.has(groupA)?order.get(groupA):Number.MAX_SAFE_INTEGER;
      const b=order.has(groupB)?order.get(groupB):Number.MAX_SAFE_INTEGER;
      return a-b||groupA.localeCompare(groupB);
    }
    return 0;
  });
  function groupCollapseKey(group){ return `${mode}:${group}`; }
  function isGroupCollapsed(group){ return !!collapsedGroups[groupCollapseKey(group)]; }
  function toggleGroup(group){
    const key=groupCollapseKey(group);
    setCollapsedGroups(prev=>{
      const next={...prev,[key]:!prev[key]};
      save(collapseStorageKey,next);
      return next;
    });
  }
  function toggleSelected(id){
    setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  }
  function selectAllVisible(){
    const ids=filtered.map(t=>t.id);
    const allSelected=ids.length && ids.every(id=>selected.includes(id));
    setSelected(allSelected?selected.filter(id=>!ids.includes(id)):[...new Set([...selected,...ids])]);
  }
  function clearSelected(){ setSelected([]); }
  function addBulkLog(t,text){
    return {...t,logs:[...(t.logs||[]),{id:safeUUID(),user:user.name,userId:user.id,type:'log',visibility:'internal',at:now(),text}]};
  }
  function bulkArchive(archived=true){
    if(!selectedFiltered.length) return;
    if(!confirm(`${archived?'Arquivar':'Desarquivar'} ${selectedFiltered.length} tarefa(s)?`)) return;
    setTasks(prev=>prev.map(t=>selectedFiltered.includes(t.id)?addBulkLog({...t,archived}, archived?'Tarefa arquivada em massa.':'Tarefa desarquivada em massa.'):t));
    clearSelected();
  }
  function bulkDelete(){
    if(!selectedFiltered.length) return;
    const typed=prompt(`Digite EXCLUIR para apagar permanentemente ${selectedFiltered.length} tarefa(s).`);
    if(typed!=='EXCLUIR') return;
    setTasks(prev=>prev.filter(t=>!selectedFiltered.includes(t.id)));
    clearSelected();
  }
  function bulkDuplicate(){
    if(!selectedFiltered.length) return;
    if(!confirm(`Duplicar ${selectedFiltered.length} tarefa(s)?`)) return;
    const source=tasks.filter(t=>selectedFiltered.includes(t.id));
    const createdAt=now();
    const copies=source.map(t=>{
      const newId=safeUUID();
      return {
        ...t,
        id:newId,
        title:`${t.title||'Tarefa'} (cópia)`,
        archived:false,
        startedAt:null,
        startedById:null,
        timerHeartbeatAt:null,
        generatedFromTemplate:false,
        generatedWeek:'',
        duplicatedFromTaskId:t.id,
        createdAt,
        updatedAt:createdAt,
        logs:[{id:safeUUID(),user:user.name,userId:user.id,type:'log',visibility:'internal',at:createdAt,text:`${user.name} duplicou esta tarefa a partir de ${taskShareUrl(t.id)}`}]
      };
    });
    setTasks(prev=>[...prev,...copies]);
    clearSelected();
  }
  function openBulkEditor(kind){
    if(!selectedFiltered.length) return;
    const first=tasks.find(t=>t.id===selectedFiltered[0]);
    const defaults={responsibleId:first?.responsibleId||teams[0]?.id||'',status:first?.status||activeStatuses[0]?.id||'',internalDate:first?.internalDate||'',postDate:first?.postDate||''};
    setBulkEdit(kind);
    setBulkValue(defaults[kind]||'');
  }
  function bulkLabel(kind){
    return kind==='responsibleId'?'responsável':kind==='status'?'status':kind==='internalDate'?'prazo':'data do post';
  }
  function applyBulkEdit(){
    if(!bulkEdit||!selectedFiltered.length) return;
    if(!bulkValue && ['responsibleId','status'].includes(bulkEdit)) return alert('Escolha uma opção antes de aplicar.');
    const selectedName = bulkEdit==='responsibleId'
      ? (teams.find(u=>u.id===bulkValue)?.name||'responsável')
      : bulkEdit==='status'
        ? (activeStatuses.find(s=>s.id===bulkValue)?.name||'status')
        : fmtDate(bulkValue);
    const logText = bulkEdit==='responsibleId'
      ? `Responsável alterado em massa para ${selectedName}.`
      : bulkEdit==='status'
        ? `Status alterado em massa para ${selectedName}.`
        : bulkEdit==='internalDate'
          ? `Prazo alterado em massa para ${selectedName}.`
          : `Data do post alterada em massa para ${selectedName}.`;
    setTasks(prev=>prev.map(t=>{
      if(!selectedFiltered.includes(t.id)) return t;
      const patch={};
      patch[bulkEdit]=bulkValue;
      return addBulkLog({...t,...patch}, logText);
    }));
    setBulkEdit(null);
    setBulkValue('');
    clearSelected();
  }
  const totalArchived=tasks.filter(t=>t.archived).length;
  return <section className={embedded?'embedded-task-view tasks-list-embedded-view':''}>{!embedded&&<PanelTabsHeader title="Tarefas"/>}
  {(permissions.showGrouping||permissions.showArchivedToggle||permissions.canSelectTasks)&&<div className="filters tasks-filters tasks-list-toolbar">
    <div className="tasks-list-toolbar-left">
      {permissions.showGrouping&&<label className="toolbar-arrange-control">Agrupar por<select value={mode} onChange={e=>setMode(e.target.value)}><option value="priority">Prioridade</option><option value="status">Status</option><option value="client">Cliente</option><option value="type">Tipo de post</option>{user.role==='admin'&&<option value="responsible">Responsável</option>}</select></label>}
      {permissions.showArchivedToggle&&<label className="toggle-archived tasks-archive-toggle"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/><span>Mostrar arquivadas{totalArchived?` (${totalArchived})`:''}</span></label>}
    </div>
    {permissions.canSelectTasks&&<div className="tasks-list-toolbar-right">
      <div className="task-bulk-left task-bulk-inline"><label className="task-select-all"><input type="checkbox" checked={filtered.length>0&&filtered.every(t=>selected.includes(t.id))} onChange={selectAllVisible}/><span></span></label><small>Selecionar</small></div>
      {(permissions.canBulkEdit||permissions.canBulkArchive||permissions.canBulkDuplicate||permissions.canBulkDelete)&&<div className="task-bulk-actions task-bulk-edit-actions task-bulk-inline-actions">
        {permissions.canBulkEdit&&<><button disabled={!selectedFiltered.length} onClick={()=>openBulkEditor('responsibleId')}>Responsável</button><button disabled={!selectedFiltered.length} onClick={()=>openBulkEditor('status')}>Status</button><button disabled={!selectedFiltered.length} onClick={()=>openBulkEditor('internalDate')}>Prazo</button><button disabled={!selectedFiltered.length} onClick={()=>openBulkEditor('postDate')}>Data</button></>}
        {permissions.canBulkArchive&&<><button disabled={!selectedFiltered.length} onClick={()=>bulkArchive(true)}>Arquivar</button><button disabled={!selectedFiltered.length} onClick={()=>bulkArchive(false)}>Desarquivar</button></>}
        {permissions.canBulkDuplicate&&<button disabled={!selectedFiltered.length} onClick={bulkDuplicate}>Duplicar</button>}
        {permissions.canBulkDelete&&<button className="danger" disabled={!selectedFiltered.length} onClick={bulkDelete}>Excluir</button>}
      </div>}
    </div>}
  </div>}

  {bulkEdit&&permissions.canBulkEdit&&<div className="modal-bg"><div className="modal bulk-edit-modal"><ModalDismiss onClose={()=>{setBulkEdit(null);setBulkValue('')}}/><h2>Alterar {bulkLabel(bulkEdit)}</h2><p>{selectedFiltered.length} tarefa(s) selecionada(s).</p>{bulkEdit==='responsibleId'&&<label>Novo responsável<select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}>{teams.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}{bulkEdit==='status'&&<label>Novo status<div className="status-select">{statusDot(activeStatuses.find(s=>s.id===bulkValue))}<select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}>{activeStatuses.map(s=><option key={s.id} value={s.id} style={{background:`${s.color}20`,color:s.color}}>{s.name}</option>)}</select></div></label>}{bulkEdit==='internalDate'&&<label>Novo prazo<input type="date" value={bulkValue} onChange={e=>setBulkValue(e.target.value)}/></label>}{bulkEdit==='postDate'&&<label>Nova data do post<input type="date" value={bulkValue} onChange={e=>setBulkValue(e.target.value)}/></label>}
<div className="modal-actions"><button onClick={()=>{setBulkEdit(null);setBulkValue('')}}>Cancelar</button><button className="primary" onClick={applyBulkEdit}>Aplicar</button></div></div></div>}

  <div className="tasks-board" style={{display:'flex',flexDirection:'column',gap:16}}>
    {groupEntries.length?groupEntries.map(([group,items])=>{
      const collapsed=permissions.canCollapseGroups?isGroupCollapsed(group):false;
      const groupStatus=mode==='status'?activeStatuses.find(s=>s.name===group):null;
      return <div className="panel task-group" style={{width:'100%',borderColor:groupStatus?.color||undefined,'--status-color':groupStatus?.color||'var(--line)'}} key={group}>
        <button className="task-group-toggle" type="button" disabled={!permissions.canCollapseGroups} onClick={()=>permissions.canCollapseGroups&&toggleGroup(group)} aria-expanded={!collapsed} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:0,background:'transparent',border:0,textAlign:'left',cursor:permissions.canCollapseGroups?'pointer':'default'}}>
          <h2 style={{margin:0,display:'flex',alignItems:'center',gap:8,color:groupStatus?.color||undefined}}>{permissions.canCollapseGroups&&<span style={{display:'inline-block',transform:collapsed?'rotate(-90deg)':'rotate(0deg)',transition:'transform .18s ease'}}>▾</span>}{group}<small>{items.length}</small></h2>
          {permissions.canCollapseGroups&&<small>{collapsed?'Expandir':'Minimizar'}</small>}
        </button>
        {!collapsed&&<div className="task-group-list" style={{marginTop:12}}>{items.map(t=>{
          const c=companies.find(x=>x.id===t.companyId);
          const r=users.find(x=>x.id===t.responsibleId);
          const statusColor=statusById[t.status]?.color||'#9ca3af';
          const deadlineColor=taskDeadlineColor(t,statuses,statusById);
          return <div className={'task-row-wrap '+(t.archived?'archived-card':'')} key={t.id}>
            {permissions.canSelectTasks&&<input className="task-row-check" type="checkbox" checked={selected.includes(t.id)} onChange={e=>{e.stopPropagation();toggleSelected(t.id)}} onClick={e=>e.stopPropagation()}/>} 
            <button className={'task-row task-list-row'+(t.startedAt?' task-working':'')} disabled={!permissions.canOpenTasks} onClick={()=>permissions.canOpenTasks&&open(t.id)} style={!permissions.canOpenTasks?{cursor:'default'}:undefined}>
              <span className="task-list-main"><b title={t.title}>{t.title}{t.archived?' • Arquivada':''}</b></span>
              <span className="task-list-meta">
                {permissions.showCompany&&<span className="task-list-company-avatar" title={`Empresa: ${c?.name||'Sem empresa'}`}><AvatarMini value={c?.logo} label={c?.name}/></span>}
                {permissions.showResponsible&&<span className="task-list-responsible" title={`Responsável: ${r?.name||'Sem responsável'}`}>{r&&<AvatarMini value={r.avatar} label={r.name}/>}</span>}
                {permissions.showStatus&&<small className="task-list-status" style={{borderColor:`${statusColor}66`,background:`${statusColor}18`,color:statusColor}}>{statusById[t.status]?.name||t.status}</small>}
                {permissions.showDeadline&&<small className="task-list-deadline" style={{borderColor:`${deadlineColor}66`,background:`${deadlineColor}18`,color:deadlineColor}}>{fmtDate(t.internalDate)}</small>}
                {permissions.showPostDate&&<small className="task-list-postdate">{t.postDate?fmtDate(t.postDate):'Sem data'}</small>}
              </span>
            </button>
          </div>
        })}</div>}
      </div>
    }):<div className="panel"><p className="muted-note">Nenhuma tarefa encontrada.</p></div>}
  </div>
</section>
}
function Calendar({tasks,companies,users,statuses,statusById,user,open,search='',embedded=false,onQuickAdd,updateTask}){ 
  const preferencesStorageKey=`argos_calendar_preferences_${user?.id||'anonymous'}`;
  const initialPreferences=load(preferencesStorageKey,{view:'month',company:'all',resp:'all',type:'all',status:'all',archivedOnly:false});
  const [view,setView]=useState(initialPreferences.view||'month'),[selectedDay,setSelectedDay]=useState(todayStr()),[company,setCompany]=useState(initialPreferences.company||'all'),[resp,setResp]=useState(initialPreferences.resp||'all'),[type,setType]=useState(initialPreferences.type||'all'),[status,setStatus]=useState(initialPreferences.status||'all'),[archivedOnly,setArchivedOnly]=useState(!!initialPreferences.archivedOnly);
  const permissions={...builtInCalendarPermissionsForRole(user.role),...(user.calendarPermissions||{})};
  useEffect(()=>{ save(preferencesStorageKey,{view,company,resp,type,status,archivedOnly}); },[preferencesStorageKey,view,company,resp,type,status,archivedOnly]); 
  const filtered=applyFilters(tasks,{
    company:permissions.showCompanyFilter?company:'all',
    resp:permissions.showResponsibleFilter?resp:'all',
    type:permissions.showTypeFilter?type:'all',
    status:permissions.showStatusFilter?status:'all',
    archivedOnly:permissions.showArchivedToggle?archivedOnly:false,
    search
  }); 
  const current=dObj(selectedDay)||dObj(todayStr()); 
  const monthStart=new Date(current.getFullYear(),current.getMonth(),1); 
  const days=[...Array(42)].map((_,i)=>{const d=new Date(monthStart); d.setDate(1-monthStart.getDay()+i); return d;}); 
  const legendStatuses=statuses.filter(s=>user.role==='admin'||(user.visibleStatuses||[]).includes(s.id));
  const taskDisplayPermissions={
    canOpenTasks:permissions.canOpenTasks,
    showTaskTitle:permissions.showTaskTitle,
    showCompany:permissions.showCompany,
    showResponsible:permissions.showResponsible,
    showStatus:permissions.showStatus,
    showDeadline:permissions.showDeadline,
    canNavigateDates:permissions.canNavigateDates,
  };
  const hasSidebar=permissions.showCompanyFilter||permissions.showResponsibleFilter||permissions.showTypeFilter||permissions.showStatusFilter||permissions.showArchivedToggle||permissions.showLegend;
  const calendarHeaderMeta=getCalendarHeaderMeta(view,selectedDay,filtered);
  const calendarViewTabs=permissions.showViewTabs
    ? <CalendarViewTabs active={view} onChange={setView}/>
    : null;
  const calendarHeaderControls=<CalendarHeaderControls view={view} selectedDay={selectedDay} setSelectedDay={setSelectedDay} countLabel={calendarHeaderMeta.countLabel} title={calendarHeaderMeta.title} permissions={permissions} onExportMonth={()=>exportCalendarTasksToExcel(filtered,selectedDay,view)} trailing={embedded?calendarViewTabs:null}/>;
  return <section className={embedded?'embedded-task-view calendar-embedded-view':''}>
    {!embedded&&<PanelTabsHeader title="Calendário" tabs={permissions.showViewTabs?[['month','Mês'],['week','Semana'],['day','Dia']]:[]} active={view} onChange={setView} actions={calendarHeaderControls} className={`calendar-panel-titlebar view-${view}`}/>} 
    <div className="calendar-layout">
      {hasSidebar&&<aside className="legend">
        {(permissions.showCompanyFilter||permissions.showResponsibleFilter||permissions.showTypeFilter||permissions.showStatusFilter||permissions.showArchivedToggle)&&<h3>Filtros</h3>}
        {permissions.showCompanyFilter&&<label>Cliente<select value={company} onChange={e=>setCompany(e.target.value)}><option value="all">Todos</option>{companies.filter(c=>c.active).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}
        {permissions.showResponsibleFilter&&<label>Responsável<select value={resp} onChange={e=>setResp(e.target.value)}><option value="all">Todos</option>{users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')).map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></label>}
        {permissions.showTypeFilter&&<label>Tipo de post<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>}
        {permissions.showStatusFilter&&<label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option>{legendStatuses.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>}
        {permissions.showArchivedToggle&&<label className="check archive-check"><input type="checkbox" checked={archivedOnly} onChange={e=>setArchivedOnly(e.target.checked)}/><span>Mostrar só arquivados</span></label>}
        {permissions.showLegend&&<><h3>Legenda</h3>{legendStatuses.map(s=><button className={'legend-row '+(status===s.id?'selected':'')} key={s.id} onClick={()=>permissions.showStatusFilter&&setStatus(status===s.id?'all':s.id)}><i style={{background:s.color}}/><span>{s.name}</span><b>{filtered.filter(t=>t.status===s.id).length}</b></button>)}</>}
      </aside>}
      <div className="calendar-main">
        {embedded&&<div className={`calendar-main-header view-${view}`}>{calendarHeaderControls}</div>}
        {view==='month'&&<MonthView selectedDay={selectedDay} days={days} tasks={filtered} companies={companies} users={users} statusById={statusById} setDay={d=>{setSelectedDay(d);if(permissions.showViewTabs)setView('day')}} open={open} permissions={taskDisplayPermissions} onQuickAdd={onQuickAdd} updateTask={updateTask} isAdmin={user?.role==='admin'}/>} 
        {view==='week'&&<WeekView selectedDay={selectedDay} setSelectedDay={setSelectedDay} tasks={filtered} companies={companies} users={users} statusById={statusById} open={open} permissions={taskDisplayPermissions}/>} 
        {view==='day'&&<DayView day={selectedDay} tasks={filtered} companies={companies} users={users} statusById={statusById} open={open} permissions={taskDisplayPermissions}/>} 
      </div>
    </div>
  </section>
}
function AvatarMini({value,label}){ const v=String(value||''); const text=String(label||value||'?').slice(0,2).toUpperCase(); return <span className="avatar-mini">{(/^https?:\/\//.test(v)||v.startsWith('data:'))?<img src={driveDirect(v)} onError={e=>{e.currentTarget.remove();}}/>:text}</span> }
function EntityLabel({value,label}){ return <span className="entity-label"><AvatarMini value={value} label={label}/><span>{label}</span></span> }
function TaskButton({t,companies,users,statusById,open,permissions={},draggable:isDraggable=false,onDragStart}){ const company=companies.find(c=>c.id===t.companyId); const resp=users.find(u=>u.id===t.responsibleId); const isWorking=!!t.startedAt; const showCompanyName=permissions.showCompany?company?.name:null; const showRespName=permissions.showResponsible?resp?.name:null; return <button className={'mini-task'+(isWorking?' task-working':'')} disabled={permissions.canOpenTasks===false} onClick={()=>permissions.canOpenTasks!==false&&open(t.id)} style={{borderLeftColor:permissions.showStatus===false?'transparent':statusById[t.status]?.color,cursor:permissions.canOpenTasks===false?'default':undefined}} draggable={isDraggable} onDragStart={isDraggable?(e=>onDragStart&&onDragStart(e,t)):undefined}>{permissions.showTaskTitle!==false&&<b className={isWorking?'task-working-text':undefined}>{t.title}</b>}{(showCompanyName||showRespName)&&<small>{showCompanyName}{showCompanyName&&showRespName?' • ':''}{showRespName&&<span className={isWorking?'task-working-text':undefined}>{showRespName}</span>}</small>}</button> }

const FIXED_SPECIAL_DATES = [
  // Janeiro
  { md:'01-01', name:'Ano Novo', type:'feriado', icon:'✦' },
  { md:'01-04', name:'Dia Mundial do Braille', type:'inclusão', icon:'•' },
  { md:'01-06', name:'Dia de Reis', type:'comemorativa', icon:'✦' },
  { md:'01-07', name:'Dia do Leitor', type:'educação/conteúdo', icon:'•' },
  { md:'01-08', name:'Dia do Fotógrafo', type:'profissional', icon:'•' },
  { md:'01-20', name:'Dia do Farmacêutico', type:'profissional/saúde', icon:'•' },
  { md:'01-24', name:'Dia Internacional da Educação', type:'educação', icon:'•' },
  { md:'01-24', name:'Dia do Aposentado', type:'conteúdo', icon:'•' },
  { md:'01-25', name:'Dia do Carteiro', type:'profissional', icon:'•' },
  { md:'01-30', name:'Dia da Saudade', type:'conteúdo', icon:'•' },

  // Fevereiro
  { md:'02-01', name:'Dia do Publicitário', type:'profissional/marketing', icon:'•' },
  { md:'02-04', name:'Dia Mundial do Câncer', type:'saúde', icon:'•' },
  { md:'02-11', name:'Dia Internacional das Mulheres e Meninas na Ciência', type:'educação/ciência', icon:'•' },
  { md:'02-13', name:'Dia Mundial do Rádio', type:'comunicação', icon:'•' },
  { md:'02-14', name:'Valentine’s Day', type:'comercial global', icon:'♡', market:'us' },
  { md:'02-20', name:'Dia Mundial da Justiça Social', type:'cidadania', icon:'•' },
  { md:'02-27', name:'Dia Nacional do Livro Didático', type:'educação', icon:'•' },

  // Março
  { md:'03-08', name:'Dia da Mulher', type:'comercial', icon:'✦' },
  { md:'03-12', name:'Dia do Bibliotecário', type:'profissional/educação', icon:'•' },
  { md:'03-14', name:'Dia dos Animais', type:'conteúdo', icon:'•' },
  { md:'03-15', name:'Dia do Consumidor', type:'comercial', icon:'✦' },
  { md:'03-15', name:'Dia da Escola', type:'educação', icon:'•' },
  { md:'03-20', name:'Dia Internacional da Felicidade', type:'conteúdo', icon:'•' },
  { md:'03-20', name:'Início do outono', type:'estação', icon:'◐' },
  { md:'03-21', name:'Dia Internacional da Síndrome de Down', type:'inclusão/saúde', icon:'•' },
  { md:'03-21', name:'Dia Internacional das Florestas', type:'meio ambiente', icon:'•' },
  { md:'03-22', name:'Dia Mundial da Água', type:'meio ambiente', icon:'•' },
  { md:'03-27', name:'Dia Mundial do Teatro', type:'cultura', icon:'•' },

  // Abril
  { md:'04-01', name:'Dia da Mentira', type:'conteúdo', icon:'•' },
  { md:'04-02', name:'Dia Mundial de Conscientização do Autismo', type:'inclusão/saúde', icon:'•' },
  { md:'04-07', name:'Dia Mundial da Saúde', type:'saúde', icon:'•' },
  { md:'04-13', name:'Dia do Beijo', type:'conteúdo/comercial', icon:'♡' },
  { md:'04-18', name:'Dia Nacional do Livro Infantil', type:'educação', icon:'•' },
  { md:'04-19', name:'Dia dos Povos Indígenas', type:'cultura/cidadania', icon:'•' },
  { md:'04-21', name:'Tiradentes', type:'feriado', icon:'✦' },
  { md:'04-22', name:'Dia da Terra', type:'meio ambiente', icon:'•' },
  { md:'04-23', name:'Dia Mundial do Livro', type:'conteúdo/educação', icon:'•' },
  { md:'04-26', name:'Dia Nacional de Prevenção e Combate à Hipertensão', type:'saúde', icon:'•' },
  { md:'04-28', name:'Dia da Educação', type:'educação', icon:'•' },
  { md:'04-29', name:'Dia Internacional da Dança', type:'cultura', icon:'•' },

  // Maio
  { md:'05-01', name:'Dia do Trabalho', type:'feriado', icon:'✦' },
  { md:'05-03', name:'Dia Mundial da Liberdade de Imprensa', type:'comunicação', icon:'•' },
  { md:'05-05', name:'Dia Nacional das Comunicações', type:'comunicação', icon:'•' },
  { md:'05-08', name:'Dia do Profissional de Marketing', type:'profissional/marketing', icon:'•' },
  { md:'05-12', name:'Dia Internacional da Enfermagem', type:'profissional/saúde', icon:'•' },
  { md:'05-15', name:'Dia Internacional da Família', type:'família/conteúdo', icon:'♡' },
  { md:'05-17', name:'Dia Mundial da Internet', type:'tecnologia', icon:'•' },
  { md:'05-18', name:'Dia Internacional dos Museus', type:'cultura', icon:'•' },
  { md:'05-20', name:'Dia do Pedagogo', type:'profissional/educação', icon:'•' },
  { md:'05-22', name:'Dia Internacional da Biodiversidade', type:'meio ambiente', icon:'•' },
  { md:'05-25', name:'Dia do Orgulho Nerd', type:'conteúdo/tecnologia', icon:'•' },
  { md:'05-31', name:'Dia Mundial sem Tabaco', type:'saúde', icon:'•' },

  // Junho
  { md:'06-05', name:'Dia do Meio Ambiente', type:'meio ambiente', icon:'•' },
  { md:'06-08', name:'Dia Mundial dos Oceanos', type:'meio ambiente', icon:'•' },
  { md:'06-09', name:'Dia da Imunização', type:'saúde', icon:'•' },
  { md:'06-12', name:'Dia dos Namorados', type:'comercial', icon:'♡' },
  { md:'06-12', name:'Dia Mundial de Combate ao Trabalho Infantil', type:'cidadania', icon:'•' },
  { md:'06-14', name:'Dia Mundial do Doador de Sangue', type:'saúde', icon:'•' },
  { md:'06-14', name:'Flag Day', type:'comemorativa', icon:'✦', market:'us' },
  { md:'06-19', name:'Juneteenth', type:'feriado federal', icon:'✦', market:'us' },
  { md:'06-20', name:'Início do inverno', type:'estação', icon:'◐' },
  { md:'06-21', name:'Dia Internacional do Yoga', type:'saúde/bem-estar', icon:'•' },
  { md:'06-24', name:'São João', type:'sazonal', icon:'✦' },
  { md:'06-26', name:'Dia Internacional de Combate às Drogas', type:'saúde/cidadania', icon:'•' },
  { md:'06-28', name:'Dia Internacional do Orgulho LGBTQIA+', type:'cidadania', icon:'•' },

  // Julho
  { md:'07-04', name:'Independence Day', type:'feriado federal', icon:'✦', market:'us' },
  { md:'07-07', name:'Dia Mundial do Chocolate', type:'conteúdo/comercial', icon:'•' },
  { md:'07-10', name:'Dia da Pizza', type:'conteúdo/comercial', icon:'•' },
  { md:'07-13', name:'Dia do Rock', type:'conteúdo/cultura', icon:'•' },
  { md:'07-15', name:'Dia do Homem', type:'conteúdo', icon:'•' },
  { md:'07-20', name:'Dia do Amigo', type:'conteúdo', icon:'•' },
  { md:'07-25', name:'Dia Nacional do Escritor', type:'profissional/cultura', icon:'•' },
  { md:'07-26', name:'Dia dos Avós', type:'família/conteúdo', icon:'♡' },
  { md:'07-27', name:'Dia do Pediatra', type:'profissional/saúde', icon:'•' },
  { md:'07-28', name:'Dia do Agricultor', type:'profissional', icon:'•' },

  // Agosto
  { md:'08-01', name:'Dia Mundial de Combate ao Câncer de Pulmão', type:'saúde', icon:'•' },
  { md:'08-05', name:'Dia Nacional da Saúde', type:'saúde', icon:'•' },
  { md:'08-08', name:'Dia Nacional de Prevenção e Controle do Colesterol', type:'saúde', icon:'•' },
  { md:'08-09', name:'Dia Internacional dos Povos Indígenas', type:'cultura/cidadania', icon:'•' },
  { md:'08-11', name:'Dia do Estudante', type:'educação', icon:'✦' },
  { md:'08-11', name:'Dia do Advogado', type:'profissional', icon:'•' },
  { md:'08-11', name:'Dia da Televisão', type:'comunicação', icon:'•' },
  { md:'08-11', name:'Dia do Garçom', type:'profissional', icon:'•' },
  { md:'08-12', name:'Dia Internacional da Juventude', type:'educação/conteúdo', icon:'•' },
  { md:'08-12', name:'Dia Nacional das Artes', type:'cultura', icon:'•' },
  { md:'08-15', name:'Dia da Informática', type:'tecnologia', icon:'•' },
  { md:'08-15', name:'Dia dos Solteiros', type:'conteúdo/comercial', icon:'•' },
  { md:'08-17', name:'Dia Nacional do Patrimônio Histórico', type:'cultura', icon:'•' },
  { md:'08-19', name:'Dia Mundial da Fotografia', type:'conteúdo/cultura', icon:'•' },
  { md:'08-22', name:'Dia do Folclore', type:'cultura/educação', icon:'•' },
  { md:'08-25', name:'Dia do Soldado', type:'comemorativa', icon:'•' },
  { md:'08-27', name:'Dia do Psicólogo', type:'profissional/saúde', icon:'•' },
  { md:'08-29', name:'Dia Nacional de Combate ao Fumo', type:'saúde', icon:'•' },
  { md:'08-31', name:'Dia do Nutricionista', type:'profissional/saúde', icon:'•' },

  // Setembro
  { md:'09-01', name:'Dia do Profissional de Educação Física', type:'profissional/saúde', icon:'•' },
  { md:'09-05', name:'Dia da Amazônia', type:'meio ambiente', icon:'•' },
  { md:'09-07', name:'Independência do Brasil', type:'feriado', icon:'✦' },
  { md:'09-08', name:'Dia Mundial da Alfabetização', type:'educação', icon:'•' },
  { md:'09-09', name:'Dia do Administrador', type:'profissional', icon:'•' },
  { md:'09-09', name:'Dia do Médico Veterinário', type:'profissional/saúde', icon:'•' },
  { md:'09-10', name:'Dia Mundial de Prevenção ao Suicídio', type:'saúde', icon:'•' },
  { md:'09-15', name:'Dia do Cliente', type:'comercial', icon:'✦' },
  { md:'09-21', name:'Dia da Árvore', type:'meio ambiente', icon:'•' },
  { md:'09-21', name:'Dia Mundial de Conscientização sobre Alzheimer', type:'saúde', icon:'•' },
  { md:'09-22', name:'Início da primavera', type:'estação', icon:'◐' },
  { md:'09-25', name:'Dia Nacional do Trânsito', type:'cidadania', icon:'•' },
  { md:'09-27', name:'Dia Mundial do Turismo', type:'conteúdo/turismo', icon:'•' },
  { md:'09-30', name:'Dia da Secretária', type:'profissional', icon:'•' },

  // Outubro
  { md:'10-01', name:'Dia Internacional da Pessoa Idosa', type:'saúde/cidadania', icon:'•' },
  { md:'10-04', name:'Dia Mundial dos Animais', type:'conteúdo', icon:'•' },
  { md:'10-05', name:'Dia Nacional da Micro e Pequena Empresa', type:'negócios', icon:'•' },
  { md:'10-10', name:'Dia Mundial da Saúde Mental', type:'saúde', icon:'•' },
  { md:'10-12', name:'Dia das Crianças', type:'comercial', icon:'✦' },
  { md:'10-15', name:'Dia dos Professores', type:'educação/profissional', icon:'•' },
  { md:'10-16', name:'Dia Mundial da Alimentação', type:'saúde', icon:'•' },
  { md:'10-18', name:'Dia do Médico', type:'profissional/saúde', icon:'•' },
  { md:'10-25', name:'Dia do Dentista', type:'profissional/saúde', icon:'•' },
  { md:'10-28', name:'Dia do Servidor Público', type:'profissional', icon:'•' },
  { md:'10-29', name:'Dia Nacional do Livro', type:'cultura/educação', icon:'•' },
  { md:'10-31', name:'Halloween', type:'sazonal', icon:'✦', market:'us' },

  // Novembro
  { md:'11-01', name:'Dia Mundial do Veganismo', type:'conteúdo', icon:'•' },
  { md:'11-05', name:'Dia do Designer Gráfico', type:'profissional/criatividade', icon:'•' },
  { md:'11-08', name:'Dia do Radiologista', type:'profissional/saúde', icon:'•' },
  { md:'11-14', name:'Dia Mundial do Diabetes', type:'saúde', icon:'•' },
  { md:'11-14', name:'Dia Nacional da Alfabetização', type:'educação', icon:'•' },
  { md:'11-15', name:'Proclamação da República', type:'feriado', icon:'✦' },
  { md:'11-19', name:'Dia Internacional do Homem', type:'conteúdo', icon:'•' },
  { md:'11-20', name:'Consciência Negra', type:'feriado/conteúdo', icon:'✦' },
  { md:'11-25', name:'Dia Nacional do Doador de Sangue', type:'saúde', icon:'•' },

  // Dezembro
  { md:'12-01', name:'Dia Mundial de Luta contra a AIDS', type:'saúde', icon:'•' },
  { md:'12-03', name:'Dia Internacional da Pessoa com Deficiência', type:'inclusão/cidadania', icon:'•' },
  { md:'12-05', name:'Dia Internacional do Voluntário', type:'cidadania', icon:'•' },
  { md:'12-09', name:'Dia do Fonoaudiólogo', type:'profissional/saúde', icon:'•' },
  { md:'12-10', name:'Dia Internacional dos Direitos Humanos', type:'cidadania', icon:'•' },
  { md:'12-11', name:'Dia do Engenheiro', type:'profissional', icon:'•' },
  { md:'12-13', name:'Dia Nacional da Pessoa com Deficiência Visual', type:'inclusão', icon:'•' },
  { md:'12-15', name:'Dia do Arquiteto e Urbanista', type:'profissional', icon:'•' },
  { md:'12-21', name:'Início do verão', type:'estação', icon:'◐' },
  { md:'12-24', name:'Véspera de Natal', type:'sazonal', icon:'✦' },
  { md:'12-25', name:'Natal', type:'comercial', icon:'✦' },
  { md:'12-31', name:'Réveillon', type:'sazonal', icon:'✦' }
];

function pad2(n){ return String(n).padStart(2,'0'); }
function dateKeyLocal(d){
  const date = d instanceof Date ? d : dObj(String(d));
  if(!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
}
function makeDateKey(year, month, day){ return `${year}-${pad2(month)}-${pad2(day)}`; }
function addDateKeys(base, offset){
  const d = dObj(base);
  if(!d) return '';
  d.setDate(d.getDate()+offset);
  return dateKeyLocal(d);
}
function nthWeekdayOfMonth(year, monthIndex, weekday, nth){
  const d = new Date(year, monthIndex, 1);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(1 + diff + (nth-1)*7);
  return dateKeyLocal(d);
}
function lastWeekdayOfMonth(year, monthIndex, weekday){
  const d = new Date(year, monthIndex + 1, 0);
  const diff = (d.getDay() - weekday + 7) % 7;
  d.setDate(d.getDate() - diff);
  return dateKeyLocal(d);
}
function easterDateKey(year){
  const a=year%19, b=Math.floor(year/100), c=year%100, d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return makeDateKey(year, month, day);
}
function variableSpecialDates(year){
  const easter = easterDateKey(year);
  const blackFriday = lastWeekdayOfMonth(year,10,5);
  const thanksgiving = nthWeekdayOfMonth(year,10,4,4);
  return [
    { date:nthWeekdayOfMonth(year,0,1,3), name:'Martin Luther King Jr. Day', type:'feriado federal', icon:'✦', market:'us' },
    { date:nthWeekdayOfMonth(year,1,1,3), name:'Presidents’ Day', type:'feriado federal', icon:'✦', market:'us' },
    { date:addDateKeys(easter,-47), name:'Carnaval', type:'sazonal', icon:'✦' },
    { date:addDateKeys(easter,-46), name:'Carnaval', type:'sazonal', icon:'✦' },
    { date:addDateKeys(easter,-2), name:'Sexta-feira Santa', type:'feriado', icon:'✦' },
    { date:easter, name:'Páscoa', type:'comercial', icon:'✦' },
    { date:addDateKeys(easter,60), name:'Corpus Christi', type:'feriado', icon:'✦' },
    { date:nthWeekdayOfMonth(year,4,0,2), name:'Dia das Mães', type:'comercial', icon:'♡' },
    { date:lastWeekdayOfMonth(year,4,1), name:'Memorial Day', type:'feriado federal', icon:'✦', market:'us' },
    { date:nthWeekdayOfMonth(year,5,0,3), name:'Father’s Day', type:'comercial', icon:'♡', market:'us' },
    { date:nthWeekdayOfMonth(year,7,0,2), name:'Dia dos Pais', type:'comercial', icon:'♡' },
    { date:nthWeekdayOfMonth(year,8,1,1), name:'Labor Day', type:'feriado federal', icon:'✦', market:'us' },
    { date:nthWeekdayOfMonth(year,9,1,2), name:'Columbus Day', type:'feriado federal', icon:'✦', market:'us' },
    { date:thanksgiving, name:'Thanksgiving', type:'feriado federal', icon:'✦', market:'us' },
    { date:blackFriday, name:'Black Friday', type:'comercial', icon:'✦', market:'us' },
    { date:addDateKeys(blackFriday,3), name:'Cyber Monday', type:'comercial', icon:'✦', market:'us' }
  ].filter(x=>x.date);
}
function specialDatesFor(ds){
  const d = dObj(ds);
  if(!d || Number.isNaN(d.getTime())) return [];
  const year = d.getFullYear();
  const md = `${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const fixed = FIXED_SPECIAL_DATES.filter(x=>x.md===md).map(x=>({...x, date:ds}));
  const variable = variableSpecialDates(year).filter(x=>x.date===ds);
  return [...fixed, ...variable];
}
const MAJOR_SPECIAL_DATE_NAMES = new Set([
  'Carnaval',
  'Páscoa',
  'Dia da Mulher',
  'Dia do Consumidor',
  'Dia das Mães',
  'Dia dos Namorados',
  'Father’s Day',
  'Dia dos Pais',
  'Dia das Crianças',
  'Valentine’s Day',
  'Halloween',
  'Thanksgiving',
  'Black Friday',
  'Cyber Monday',
  'Véspera de Natal',
  'Natal',
  'Réveillon'
]);
function isMajorSpecialDate(item){
  if(!item) return false;
  const type=String(item.type||'').toLowerCase();
  if(type.includes('feriado')) return true;
  return MAJOR_SPECIAL_DATE_NAMES.has(String(item.name||''));
}
function SpecialDateMarks({items=[]}){
  if(!items.length) return null;
  return <div className="special-date-marks" title={items.map(i=>`${i.name} (${i.type})${i.market==='us'?' • EUA':''}`).join(' • ')}>{items.slice(0,2).map((item,idx)=><span className={'special-date-chip type-'+String(item.type||'').replace(/[^a-z0-9]/gi,'-').toLowerCase()+(item.market==='us'?' market-us':'')} key={item.name+idx}><i>{item.icon||'✦'}</i><em>{item.name}</em>{item.market==='us'&&<strong>EUA</strong>}</span>)}{items.length>2&&<span className="special-date-more">+{items.length-2}</span>}</div>
}
function SpecialDatePanel({items=[]}){
  if(!items.length) return null;
  return <div className="special-date-panel"><h3>Datas especiais</h3>{items.map((item,idx)=><div className={'special-date-line'+(item.market==='us'?' market-us':'')} key={item.name+idx}><b>{item.icon||'✦'}</b><span>{item.name}</span><small>{item.market==='us'?`EUA • ${item.type}`:item.type}</small></div>)}</div>
}

function shiftCalendarDate(view,selectedDay,direction){
  if(view==='month') return addMonths(selectedDay,direction);
  if(view==='week') return addDays(selectedDay,7*direction);
  return addDays(selectedDay,direction);
}
function getCalendarHeaderMeta(view,selectedDay,tasks){
  const base=dObj(selectedDay)||dObj(todayStr());
  if(view==='week'){
    const start=new Date(base);
    start.setDate(base.getDate()-base.getDay()+1);
    const days=[...Array(7)].map((_,i)=>{const d=new Date(start); d.setDate(start.getDate()+i); return dateKeyLocal(d)});
    const taskCount=tasks.filter(t=>days.includes(t.postDate)).length;
    return {countLabel:`${taskCount} tarefa(s)`,title:`Semana de ${fmtDate(days[0])} a ${fmtDate(days[6])}`};
  }
  if(view==='day'){
    const taskCount=tasks.filter(t=>t.postDate===selectedDay).length;
    return {countLabel:`${taskCount} tarefa(s)`,title:fmtDate(selectedDay)};
  }
  const taskCount=tasks.filter(t=>{const d=dObj(t.postDate); return d&&d.getFullYear()===base.getFullYear()&&d.getMonth()===base.getMonth();}).length;
  return {countLabel:`${taskCount} tarefa(s)`,title:monthLabel(selectedDay)};
}
function CalendarViewTabs({active,onChange}){
  return <div className="calendar-inline-view-tabs panel-tabs" role="tablist">{[['month','Mês'],['week','Semana'],['day','Dia']].map(([id,label])=>{const selected=active===id;return <button key={id} type="button" role="tab" aria-selected={selected} aria-current={selected?'page':undefined} className={selected?'active':''} onClick={()=>onChange(id)} style={{position:'relative',overflow:'hidden'}}>{selected&&<span aria-hidden="true" style={{position:'absolute',inset:0,zIndex:0,pointerEvents:'none',background:'rgba(var(--accent-rgb),.08)',border:'1px solid rgba(var(--accent-rgb),.55)',borderRadius:8,boxSizing:'border-box'}}/>}<span style={{position:'relative',zIndex:1,color:selected?'var(--gold-2)':undefined,fontWeight:400}}>{label}</span></button>})}</div>;
}
function CalendarHeaderControls({view,selectedDay,setSelectedDay,countLabel,title,permissions={},onExportMonth,trailing=null}){
  return <div className="calendar-header-controls">
    {permissions.canNavigateDates!==false&&<div className="calendar-topbar-nav nav-actions"><button type="button" onClick={()=>setSelectedDay(shiftCalendarDate(view,selectedDay,-1))}>‹</button><button type="button" onClick={()=>setSelectedDay(todayStr())}>Atual</button><button type="button" onClick={()=>setSelectedDay(shiftCalendarDate(view,selectedDay,1))}>›</button></div>}
    <small className="calendar-header-count">{countLabel}</small>
    <h2 className="calendar-header-title">{title}</h2>
    {permissions.canExportExcel!==false&&<button type="button" className="calendar-export-btn" onClick={onExportMonth}>Exportar Excel</button>}
    {trailing&&<div className="calendar-header-trailing">{trailing}</div>}
  </div>;
}
function MonthView({selectedDay,days,tasks,companies,users,statusById,setDay,open,permissions={},onQuickAdd,updateTask,isAdmin}){ const cur=dObj(selectedDay); const todayKey=todayStr(); const canDrag=isAdmin&&!!updateTask; return <div className="month"><div className="weeknames">{['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(d=><b key={d}>{d}</b>)}</div><div className="days">{days.map(d=>{const ds=dateKeyLocal(d); const list=tasks.filter(t=>t.postDate===ds); const other=d.getMonth()!==cur.getMonth(); const specials=specialDatesFor(ds); const hasUsSpecial=specials.some(i=>i.market==='us'); const hasMajorSpecial=specials.some(isMajorSpecialDate); const specialTitle=specials.map(i=>`${i.name}${i.market==='us'?' • EUA':''}`).join(' • '); const isToday=ds===todayKey; const weekday=d.getDay(); const isWeekend=weekday===0||weekday===6; return <div className={'day '+(other?'muted-day ':'')+(specials.length?'has-special-date ':'')+(hasUsSpecial?'has-us-special-date ':'')+(isToday?'is-today ':'')+(isWeekend?'is-weekend':'')} key={ds} onDragOver={e=>{if(canDrag){e.preventDefault();e.currentTarget.classList.add('drag-over');}}} onDragLeave={e=>{e.currentTarget.classList.remove('drag-over');}} onDrop={e=>{if(!canDrag)return;e.preventDefault();e.currentTarget.classList.remove('drag-over');const taskId=e.dataTransfer.getData('text/plain');if(taskId)updateTask(taskId,{postDate:ds});}}><div className={'day-headline month-day-headline'+(specials.length?' has-month-special':'')+(hasMajorSpecial?' has-major-month-special':'')} title={specialTitle||undefined} role="button" tabIndex={0} onClick={()=>setDay(ds)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDay(ds)}}}>{hasMajorSpecial?<span className="month-special-star-mark" aria-label={`Data importante: ${specialTitle}`}>✦</span>:<span className="month-special-star-space" aria-hidden="true"/>}<span className="day-num month-day-num">{d.getDate()}</span></div>{onQuickAdd&&<button type="button" className="day-quick-add" onClick={e=>{e.stopPropagation();onQuickAdd(ds);}} title="Criar tarefa neste dia" aria-label="Criar tarefa neste dia">+</button>}{list.slice(0,4).map(t=><TaskButton key={t.id} t={t} companies={companies} users={users} statusById={statusById} open={open} permissions={permissions} draggable={canDrag} onDragStart={(e,task)=>e.dataTransfer.setData('text/plain',task.id)}/>)}{list.length>4&&<button className="more" onClick={()=>setDay(ds)}>+{list.length-4} mais</button>}</div>})}</div></div> }
function WeekView({selectedDay,setSelectedDay,tasks,companies,users,statusById,open,permissions={}}){ const base=dObj(selectedDay); const start=new Date(base); start.setDate(base.getDate()-base.getDay()+1); const days=[...Array(7)].map((_,i)=>{const d=new Date(start); d.setDate(start.getDate()+i); return dateKeyLocal(d)}); return <div className="calendar-period-content"><div className="week-grid">{days.map(ds=>{const list=tasks.filter(t=>t.postDate===ds); const specials=specialDatesFor(ds); return <div className={'week-col '+(specials.length?'has-special-date':'')} key={ds}><button className="day-num" onClick={()=>setSelectedDay(ds)}>{fmtDate(ds)}</button><SpecialDateMarks items={specials}/>{list.map(t=><TaskButton key={t.id} t={t} companies={companies} users={users} statusById={statusById} open={open} permissions={permissions}/>)}</div>})}</div></div> }
function DayView({day,tasks,companies,users,statusById,open,permissions={}}){ 
  const list=tasks.filter(t=>t.postDate===day); 
  const specials=specialDatesFor(day);
  return <div className="calendar-period-content"><SpecialDatePanel items={specials}/><div className="day-list clean-day-list">{list.map(t=><button className="day-card clean-day-card" key={t.id} disabled={permissions.canOpenTasks===false} onClick={()=>permissions.canOpenTasks!==false&&open(t.id)} style={{borderColor:permissions.showStatus===false?'transparent':statusById[t.status]?.color,cursor:permissions.canOpenTasks===false?'default':undefined}}>{permissions.showTaskTitle!==false&&<b>{t.title}</b>}{permissions.showDeadline&&<><small>Prazo: {fmtDate(t.internalDate)}</small><small>Prioridade: {priorityText(t.internalDate)}</small></>}{permissions.showStatus!==false&&<span className="status-pill" style={{background:statusById[t.status]?.color}}>{statusById[t.status]?.name}</span>}</button>)}</div></div> 
}
function Kanban({tasks,companies,users,statuses,statusById,user,open,search='',embedded=false,updateTask}){ 
  const isAdmin=user?.role==='admin';
  const preferencesStorageKey=`argos_kanban_preferences_${user?.id||'anonymous'}`;
  const initialPreferences=load(preferencesStorageKey,{period:'current',from:'',to:'',company:'all',resp:'all',type:'all',archivedOnly:false,sort:'priority'});
  const [period,setPeriod]=useState(initialPreferences.period||'current'),[from,setFrom]=useState(initialPreferences.from||''),[to,setTo]=useState(initialPreferences.to||''),[company,setCompany]=useState(initialPreferences.company||'all'),[resp,setResp]=useState(initialPreferences.resp||'all'),[type,setType]=useState(initialPreferences.type||'all'),[archivedOnly,setArchivedOnly]=useState(!!initialPreferences.archivedOnly),[sort,setSort]=useState(initialPreferences.sort||'priority');
  const PAGE_SIZE=10;
  const [visibleByStatus,setVisibleByStatus]=useState({});
  const permissions={...builtInKanbanPermissionsForRole(user.role),...(user.kanbanPermissions||{})};
  useEffect(()=>{ save(preferencesStorageKey,{period,from,to,company,resp,type,archivedOnly,sort}); },[preferencesStorageKey,period,from,to,company,resp,type,archivedOnly,sort]);
  const allowed=statuses.filter(s=>user.role==='admin'||(user.visibleStatuses||[]).includes(s.id));

  let filtered=applyFilters(tasks,{
    period:null,
    from,
    to,
    company:permissions.showCompanyFilter?company:'all',
    resp:permissions.showResponsibleFilter?resp:'all',
    type:permissions.showTypeFilter?type:'all',
    archivedOnly:permissions.showArchivedToggle?archivedOnly:false,
    search
  });

  filtered=filtered.filter(t=>{
    if(!permissions.showPeriodFilter||!period) return true;
    if(!t.postDate) return true;
    return periodMatch(t.postDate,period,from,to);
  });

  const priorityOrder={late:0,hot:1,warn:2,ok:3,neutral:4}; 
  function cmp(a,b){
    const pa=priorityOrder[priorityClass(a.internalDate)], pb=priorityOrder[priorityClass(b.internalDate)];
    const clientA=companies.find(c=>c.id===a.companyId)?.name||'', clientB=companies.find(c=>c.id===b.companyId)?.name||'';
    const respA=users.find(u=>u.id===a.responsibleId)?.name||'', respB=users.find(u=>u.id===b.responsibleId)?.name||'';
    if(sort==='client') return clientA.localeCompare(clientB)||pa-pb||a.title.localeCompare(b.title);
    if(sort==='type') return a.type.localeCompare(b.type)||pa-pb||clientA.localeCompare(clientB);
    if(sort==='responsible') return respA.localeCompare(respB)||pa-pb||clientA.localeCompare(clientB);
    if(sort==='postDate') return String(a.postDate||'9999-12-31').localeCompare(String(b.postDate||'9999-12-31'))||pa-pb;
    if(sort==='internalDate') return String(a.internalDate||'9999-12-31').localeCompare(String(b.internalDate||'9999-12-31'))||clientA.localeCompare(clientB);
    return pa-pb||clientA.localeCompare(clientB)||String(a.internalDate||'9999-12-31').localeCompare(String(b.internalDate||'9999-12-31'));
  }

  filtered=[...filtered].sort(cmp);

  useEffect(()=>{ setVisibleByStatus({}); },[period,from,to,company,resp,type,archivedOnly,sort,search]);

  function visibleLimit(statusId){ return visibleByStatus[statusId]||PAGE_SIZE; }
  function loadMore(statusId){ setVisibleByStatus(prev=>({...prev,[statusId]:(prev[statusId]||PAGE_SIZE)+PAGE_SIZE})); }

  const hasFilters=permissions.showPeriodFilter||permissions.showCompanyFilter||permissions.showResponsibleFilter||permissions.showTypeFilter||permissions.showSort||permissions.showArchivedToggle;

  return <section className={embedded?'embedded-task-view kanban-embedded-view':''}>{!embedded&&<PanelTabsHeader title="Kanban"/>}
    {hasFilters&&<div className="filters">
      {permissions.showPeriodFilter&&<PeriodFilters period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo}/>}
      {permissions.showCompanyFilter&&<label>Cliente<select value={company} onChange={e=>setCompany(e.target.value)}><option value="all">Todos</option>{companies.filter(c=>c.active).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}
      {permissions.showResponsibleFilter&&<label>Responsável<select value={resp} onChange={e=>setResp(e.target.value)}><option value="all">Todos</option>{users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')).map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></label>}
      {permissions.showTypeFilter&&<label>Tipo de post<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>}
      {permissions.showSort&&<label className="toolbar-sort-control">Ordenar por<select value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">Prioridade</option><option value="client">Cliente</option><option value="type">Tipo de post</option><option value="responsible">Responsável</option><option value="postDate">Data do post</option><option value="internalDate">Prazo</option></select></label>}
      {permissions.showArchivedToggle&&<label className="check archive-check inline"><input type="checkbox" checked={archivedOnly} onChange={e=>setArchivedOnly(e.target.checked)}/><span>Mostrar só arquivados</span></label>}
    </div>}
    <div className="kanban">{allowed.map(s=>{
      const columnTasks=filtered.filter(t=>t.status===s.id);
      const visibleTasks=columnTasks.slice(0,visibleLimit(s.id));
      return <div className="col" key={s.id} style={{borderTopColor:s.color,'--status-color':s.color}} onDragOver={e=>{if(isAdmin&&updateTask){e.preventDefault();e.currentTarget.classList.add('drag-over');}}} onDragLeave={e=>{e.currentTarget.classList.remove('drag-over');}} onDrop={e=>{if(!isAdmin||!updateTask)return;e.preventDefault();e.currentTarget.classList.remove('drag-over');const taskId=e.dataTransfer.getData('text/plain');const draggedTask=filtered.find(x=>x.id===taskId);if(taskId&&draggedTask&&draggedTask.status!==s.id)updateTask(taskId,{status:s.id});}}><h3><span style={{color:s.color}}>{s.name}</span><b>{Math.min(visibleTasks.length,columnTasks.length)} de {columnTasks.length}</b></h3>{visibleTasks.map(t=>{
        const companyEntity=companies.find(c=>c.id===t.companyId);
        const respUser=users.find(u=>u.id===t.responsibleId);
        const isWorking=!!t.startedAt;
        return <button className={'kcard'+(isWorking?' task-working':'')} key={t.id} disabled={!permissions.canOpenTasks} onClick={()=>permissions.canOpenTasks&&open(t.id)} style={!permissions.canOpenTasks?{cursor:'default'}:undefined} draggable={isAdmin&&!!updateTask} onDragStart={e=>{if(isAdmin&&updateTask)e.dataTransfer.setData('text/plain',t.id);}}>
          <b className="k-title" title={t.title}>{t.title}</b>
          <div className="k-meta" style={{alignItems:'center',gap:6}}>
            {(permissions.showCompany||permissions.showResponsible)&&<span className="avatars" style={{flex:'0 0 auto'}}>
              {permissions.showCompany&&<AvatarMini value={companyEntity?.logo} label={companyEntity?.name}/>} 
              {permissions.showResponsible&&<span className="resp-avatar"><AvatarMini value={respUser?.avatar} label={respUser?.name}/></span>} 
            </span>}
            {(permissions.showPostDate||permissions.showDeadline)&&<span style={{display:'flex',gap:4,flexWrap:'nowrap',minWidth:0,marginLeft:'auto'}}>
              {permissions.showDeadline&&<small style={{display:'inline-flex',alignItems:'center',padding:'3px 6px',borderRadius:6,border:`1px solid ${taskDeadlineColor(t,statuses,statusById)}55`,background:`${taskDeadlineColor(t,statuses,statusById)}14`,color:taskDeadlineColor(t,statuses,statusById),fontSize:10,fontWeight:400,lineHeight:1.1,whiteSpace:'nowrap'}}>{fmtDate(t.internalDate)}</small>}
              {permissions.showPostDate&&<small style={{display:'inline-flex',alignItems:'center',padding:'3px 6px',borderRadius:6,border:'1px solid rgba(156,163,175,.30)',background:'rgba(156,163,175,.06)',color:'#aeb4bd',fontSize:10,fontWeight:400,lineHeight:1.1,whiteSpace:'nowrap'}}>{t.postDate?fmtDate(t.postDate):'Sem data'}</small>}
            </span>}
          </div>
        </button>;
      })}{columnTasks.length>visibleTasks.length&&<button type="button" onClick={()=>loadMore(s.id)} style={{width:'100%',marginTop:10}}>Carregar mais {Math.min(PAGE_SIZE,columnTasks.length-visibleTasks.length)}</button>}</div>;
    })}</div>
  </section> 
}

function CopyTextButton({text}){
  const [copied,setCopied]=useState(false);
  async function copy(){
    const value=richTextPlainText(text);
    if(!value.trim()) return;
    try{
      await navigator.clipboard.writeText(value);
    }catch{
      const area=document.createElement('textarea');
      area.value=value;
      area.setAttribute('readonly','');
      area.style.position='fixed';
      area.style.opacity='0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    setTimeout(()=>setCopied(false),1200);
  }

  return <button
    type="button"
    onClick={copy}
    disabled={!String(text||'').trim()}
    title={copied?'Texto copiado':'Copiar todo o texto'}
    aria-label={copied?'Texto copiado':'Copiar todo o texto'}
    style={{
      position:'absolute',
      top:7,
      right:7,
      zIndex:3,
      width:28,
      height:28,
      minHeight:28,
      padding:0,
      display:'inline-flex',
      alignItems:'center',
      justifyContent:'center',
      borderRadius:7,
      border:'1px solid rgba(var(--accent-rgb),.2)',
      background:'rgba(7,7,7,.74)',
      color:copied?'#d9ad38':'rgba(255,255,255,.62)',
      opacity:String(text||'').trim()?0.82:0.28,
      boxShadow:'none'
    }}
  >
    {copied
      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
    }
  </button>;
}

function TextFieldWithCopy({label,value,onChange,placeholder,minHeight=92}){
  return <label className="plain-text-field-with-copy" style={{display:'block'}}>
    {label}
    <div className="plain-text-editor-shell" style={{position:'relative'}}>
      <AutoTextarea
        rows={1}
        value={value||''}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
        className="plain-text-editor"
        style={{paddingRight:48}}
      />
      <CopyTextButton text={value}/>
    </div>
  </label>;
}

function ReadOnlyReadyLinks({title='Links de material finalizado',text}){
  const links=String(text||'').split('\n').map(x=>x.trim()).filter(Boolean);
  return <div className="readonly-instruction">
    <label>{title}</label>
    <div className="instruction-box textarea-like" style={{display:'flex',flexDirection:'column',gap:8}}>
      {links.length
        ? links.map((url,index)=><a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{
              display:'inline-flex',
              alignItems:'center',
              width:'fit-content',
              minHeight:32,
              padding:'6px 10px',
              border:'1px solid rgba(var(--accent-rgb),.28)',
              borderRadius:8,
              background:'rgba(var(--accent-rgb),.04)',
              color:'#d9ad38',
              textDecoration:'none',
              fontWeight:700
            }}
          >Link {index+1}</a>)
        : <span className="muted-note">Sem links prontos.</span>}
    </div>
  </div>;
}

function ReadOnlyInstruction({title,text}){
  return <div className="readonly-instruction"><label>{title}</label><div style={{position:'relative'}}><div className="instruction-box textarea-like" style={{paddingRight:48}}>{text?<RichTextDisplay value={text}/>:<span className="muted-note">Sem informações.</span>}</div><CopyTextButton text={text}/></div></div>
}

function PlanningPage({companies,setCompanies,users,tasks,createWeeklyTasks,open,user}){
  const permissions={...builtInPlanningPermissionsForRole(user?.role),...(user?.planningPermissions||{})};
  const preferencesStorageKey=`argos_planning_preferences_${user?.id||'anonymous'}`;
  const initialPreferences=load(preferencesStorageKey,{companySort:'template-first',weekStart:nextWeekStartStr()});
  const [weekStart,setWeekStart]=useState(initialPreferences.weekStart&&initialPreferences.weekStart>=nextWeekStartStr()?weekStartStr(initialPreferences.weekStart):nextWeekStartStr());
  const [editingTemplate,setEditingTemplate]=useState(null);
  const [companySort,setCompanySort]=useState(initialPreferences.companySort||'template-first');
  useEffect(()=>{ save(preferencesStorageKey,{companySort,weekStart}); },[preferencesStorageKey,companySort,weekStart]);

  function changePlanningDate(value){
    if(!value) return;
    setWeekStart(weekStartStr(value));
  }

  const activeCompanies=companies.filter(c=>c.active);
  const compareCompanyNames=(a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR',{sensitivity:'base'});
  const companyCreatedTime=(company)=>{
    const value=new Date(company?.createdAt||0).getTime();
    return Number.isFinite(value)?value:0;
  };
  const sortedPlanningCompanies=[...activeCompanies].sort((a,b)=>{
    const aHasTemplate=(a.weeklyTemplate||[]).length>0;
    const bHasTemplate=(b.weeklyTemplate||[]).length>0;
    if(companySort==='template-first'&&aHasTemplate!==bHasTemplate) return aHasTemplate?-1:1;
    if(companySort==='no-template-first'&&aHasTemplate!==bHasTemplate) return aHasTemplate?1:-1;
    if(companySort==='newest'){
      const dateDiff=companyCreatedTime(b)-companyCreatedTime(a);
      if(dateDiff) return dateDiff;
    }
    if(companySort==='oldest'){
      const dateDiff=companyCreatedTime(a)-companyCreatedTime(b);
      if(dateDiff) return dateDiff;
    }
    return compareCompanyNames(a,b);
  });
  const weekEnd=weekEndStr(weekStart);
  const totalExpected=activeCompanies.reduce((acc,c)=>acc+(c.weeklyTemplate||[]).reduce((a,item)=>a+(Number(item.quantity)||0),0),0);
  const totalCreated=tasks.filter(t=>t.generatedWeek===weekStart).length;

  function saveTemplate(companyId,weeklyTemplate){
    if(!permissions.canEditTemplate) return;
    setCompanies(companies.map(c=>c.id===companyId?{...c,weeklyTemplate}:c));
    setEditingTemplate(null);
  }

  function generateAll(){
    if(!permissions.canGenerateAll) return;
    const pending=activeCompanies.filter(c=>{
      const expected=(c.weeklyTemplate||[]).reduce((a,item)=>a+(Number(item.quantity)||0),0);
      const created=tasks.filter(t=>t.companyId===c.id&&t.generatedWeek===weekStart).length;
      return expected>0&&created===0;
    });
    if(!pending.length){alert('Nenhum cliente pendente para a próxima semana.');return;}
    const total=pending.reduce((acc,c)=>acc+(c.weeklyTemplate||[]).reduce((a,item)=>a+(Number(item.quantity)||0),0),0);
    if(!confirm(`Gerar ${total} tarefa(s) para ${pending.length} cliente(s) pendente(s)?`)) return;
    pending.forEach(c=>createWeeklyTasks(c.id,weekStart,false));
  }

  return <section>
    <PanelTabsHeader title="Planejamento"/>

    {(permissions.showWeekControls||permissions.showIndicators||permissions.canGenerateAll)&&<div className="filters planning-top-filters">
      {permissions.showWeekControls&&<>
        {permissions.showSort&&<label className="planning-date-filter planning-company-sort toolbar-sort-control">Ordenar por<select value={companySort} onChange={e=>setCompanySort(e.target.value)}><option value="template-first">Com template primeiro</option><option value="no-template-first">Sem template primeiro</option><option value="name">Nome A–Z</option><option value="newest">Cadastro mais recente</option><option value="oldest">Cadastro mais antigo</option></select></label>}
        <label className="panel planning-kpi-card planning-kpi-period planning-period-selector">
          <small>Período</small>
          <b>{fmtDate(weekStart)} a {fmtDate(weekEnd)}</b>
          <input type="date" value={weekStart} min={nextWeekStartStr()} onChange={e=>changePlanningDate(e.target.value)} aria-label="Selecionar semana do planejamento"/>
        </label>
      </>}
      {permissions.showIndicators&&<>
        {!permissions.showWeekControls&&<div className="panel planning-kpi-card planning-kpi-period"><small>Período</small><b>{fmtDate(weekStart)} a {fmtDate(weekEnd)}</b></div>}
        <div className="panel planning-kpi-card planning-kpi-small planning-indicator"><small>Total previsto</small><b>{totalExpected}</b></div>
        <div className="panel planning-kpi-card planning-kpi-small planning-indicator"><small>Já geradas</small><b>{totalCreated}</b></div>
      </>}
      {permissions.canGenerateAll&&<button className="primary planning-generate-all-inline" onClick={generateAll}>Gerar todos pendentes</button>}
    </div>}

    {permissions.showCompanies&&<div className="client-grid compact-admin-grid planning-grid" style={{display:'flex',flexDirection:'column',gap:16}}>
      {sortedPlanningCompanies.map(c=>{
        const template=c.weeklyTemplate||[];
        const expected=template.reduce((a,item)=>a+(Number(item.quantity)||0),0);
        const createdTasks=tasks.filter(t=>t.companyId===c.id&&t.generatedWeek===weekStart);
        const created=createdTasks.length;
        const canGenerate=created?permissions.canRegenerate:permissions.canGenerateCompany;

        return <div className="panel planning-card" key={c.id}>
          <div className="mini-title"><AvatarMini value={c.logo} label={c.name}/><div><h2>{c.name}</h2><small>{expected} tarefa(s) previstas • {created} gerada(s)</small></div></div>
          {permissions.showTemplateSummary&&(template.length
            ? <div className="template-preview">{template.map(item=><small key={item.id||item.type}>{item.quantity||0}× {item.type} • {WEEK_DAYS.find(d=>d.value===Number(item.postDay))?.label||'Segunda'}</small>)}</div>
            : <p className="muted-note">Sem template semanal configurado.</p>
          )}
          {(canGenerate||permissions.canEditTemplate||(permissions.canOpenGeneratedTasks&&createdTasks.length>0))&&<div className="row-actions">
            {canGenerate&&<button className="primary" disabled={!expected} onClick={()=>createWeeklyTasks(c.id,weekStart,false)}>{created?'Gerar novamente':'Gerar semana'}</button>}
            {permissions.canEditTemplate&&<button onClick={()=>setEditingTemplate(c)}>{template.length?'Editar template':'Criar template'}</button>}
            {permissions.canOpenGeneratedTasks&&createdTasks.length>0&&<button onClick={()=>open(createdTasks[0].id)}>Ver tarefas</button>}
          </div>}
        </div>;
      })}
    </div>}

    {editingTemplate&&permissions.canEditTemplate&&<WeeklyTemplateEditor company={editingTemplate} users={users} save={saveTemplate} cancel={()=>setEditingTemplate(null)}/>}
  </section>;
}

function WeeklyTemplateEditor({company,users,save,cancel}){
  const [weeklyTemplate,setWeeklyTemplate]=useState(company.weeklyTemplate||[]);
  const teams=users.filter(u=>u.active&&(u.role==='team'||u.role==='admin'));
  function updateTemplate(id,patch){ setWeeklyTemplate(weeklyTemplate.map(item=>item.id===id?{...item,...patch}:item)); }
  function addTemplateItem(){ setWeeklyTemplate([...weeklyTemplate,{ id:safeUUID(), type:TASK_TYPES[0], quantity:1, responsibleId:teams[0]?.id||'', postDay:0, internalOffset:1, copyInstructions:'', editorInstructions:'', usefulLinks:'', finalLink:'' }]); }
  function removeTemplateItem(id){ setWeeklyTemplate(weeklyTemplate.filter(item=>item.id!==id)); }
  return <div className="modal-bg"><div className="modal company-modal"><ModalDismiss onClose={cancel}/>
<div className="section-header"><div><h2>Template semanal</h2><p>{company.name}</p></div></div>
{weeklyTemplate.length?weeklyTemplate.map((item,index)=><div className="panel template-item" key={item.id}><h3 className="template-line-title">Linha {index+1}</h3>
<div className="form-two"><label>Tipo<select value={item.type||TASK_TYPES[0]} onChange={e=>updateTemplate(item.id,{type:e.target.value})}>{TASK_TYPES.map(t=><option key={t}>{t}</option>)}</select></label><label>Quantidade<input type="number" min="0" value={item.quantity??1} onChange={e=>updateTemplate(item.id,{quantity:Number(e.target.value)})}/></label></div><div className="form-two"><label>Responsável<select value={item.responsibleId||''} onChange={e=>updateTemplate(item.id,{responsibleId:e.target.value})}><option value="">Padrão do sistema</option>{teams.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Dia de postagem<select value={item.postDay??0} onChange={e=>updateTemplate(item.id,{postDay:Number(e.target.value)})}>{WEEK_DAYS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select></label></div><label>Prazo interno<input type="number" min="0" value={item.internalOffset??1} onChange={e=>updateTemplate(item.id,{internalOffset:Number(e.target.value)})}/><small>Quantos dias antes da postagem. Ex: 1 = um dia antes.</small></label><RichTextField label="Instruções ao copy" value={item.copyInstructions||''} onChange={e=>updateTemplate(item.id,{copyInstructions:e.target.value})} placeholder="Orientações padrão para o copy desta linha."/><RichTextField label="Instruções ao editor" value={item.editorInstructions||''} onChange={e=>updateTemplate(item.id,{editorInstructions:e.target.value})} placeholder="Orientações padrão para edição/design desta linha."/><RichTextField label="Links úteis" value={item.usefulLinks||''} onChange={e=>updateTemplate(item.id,{usefulLinks:e.target.value})} placeholder="Cole links e descreva para que serve cada um."/><RichTextField label="Link da pasta final (padrão)" value={item.finalLink||''} onChange={e=>updateTemplate(item.id,{finalLink:e.target.value})} placeholder="Padrão de link final pra esse cliente, se aplicável (opcional)."/><div className="row-actions"><button type="button" onClick={()=>removeTemplateItem(item.id)}>Remover linha</button></div></div>
):<p className="muted-note">Nenhuma linha de template. Clique em + Linha para criar a remessa semanal deste cliente.</p>}<div className="modal-actions template-modal-actions"><button type="button" className="template-add-line" onClick={addTemplateItem}>+ Linha</button><div className="template-save-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={()=>save(company.id,weeklyTemplate)}>Salvar template</button></div></div></div></div>
}

function TaskAccessDenied({back}){
  return <section className="task-access-denied"><button onClick={back}>← Voltar</button><div className="panel"><h1>Acesso não permitido</h1><p>Esta tarefa não está disponível para o seu perfil ou não está mais em um status visível para você.</p></div></section>
}

function AutoTextarea({value,onChange,minHeight=92,style,...props}){
  const ref=useRef(null);

  function resize(){
    const element=ref.current;
    if(!element) return;
    element.style.height='auto';
    element.style.height=`${Math.max(element.scrollHeight,minHeight)}px`;
  }

  useEffect(()=>{ resize(); },[value,minHeight]);

  return <textarea
    {...props}
    ref={ref}
    value={value}
    onChange={onChange}
    onInput={resize}
    style={{
      ...style,
      minHeight,
      height:'auto',
      overflowY:'hidden',
      resize:'vertical'
    }}
  />;
}

function RichTextField({label,value,onChange,placeholder='Escreva aqui...',className='',minHeight,taskId,taskField}){
  const editorRef=useRef(null);
  const lastValueRef=useRef(null);
  const [toolbar,setToolbar]=useState({visible:false,left:0,top:0});

  useEffect(()=>{
    const editor=editorRef.current;
    const incoming=String(value||'');
    if(!editor || incoming===lastValueRef.current) return;
    // Uma atualização remota nunca pode reescrever o conteúdo enquanto a pessoa
    // está digitando neste editor. O texto visível local continua sendo a fonte
    // de verdade até o blur/emit confirmar a versão completa.
    if(document.activeElement===editor) return;
    editor.innerHTML=sanitizeRichText(richTextHtml(incoming));
    lastValueRef.current=incoming;
  },[value]);

  function emit(){
    const editor=editorRef.current;
    if(!editor) return;
    const html=sanitizeRichText(editor.innerHTML);
    const plain=String(editor.innerText||'').replace(/\u00a0/g,' ').trim();
    const next=plain ? RICH_TEXT_PREFIX+html : '';
    lastValueRef.current=next;
    onChange({target:{value:next}});
  }

  function command(name,arg=null){
    editorRef.current?.focus();
    document.execCommand(name,false,arg);
    emit();
    positionToolbar();
  }

  function toggleTitle(){
    const editor=editorRef.current;
    const selection=window.getSelection();
    if(!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
    const anchor=selection.anchorNode?.nodeType===Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;
    const currentTitle=anchor?.closest?.('h3');
    const titleIsActive=Boolean(currentTitle&&editor.contains(currentTitle));
    editor.focus();
    document.execCommand('formatBlock',false,titleIsActive?'div':'h3');
    emit();
    positionToolbar();
  }

  function positionToolbar(){
    const editor=editorRef.current;
    if(!editor || document.activeElement!==editor){
      setToolbar(current=>current.visible?{...current,visible:false}:current);
      return;
    }
    requestAnimationFrame(()=>{
      const selection=window.getSelection();
      let rect=null;
      if(selection?.rangeCount && editor.contains(selection.anchorNode)){
        const range=selection.getRangeAt(0).cloneRange();
        rect=range.getBoundingClientRect();
        if(!rect.width&&!rect.height) rect=Array.from(range.getClientRects())[0]||null;
      }
      const editorRect=editor.getBoundingClientRect();
      const anchor=rect&&Number.isFinite(rect.left)?rect:editorRect;
      const toolbarWidth=Math.min(274,window.innerWidth-16);
      const left=Math.max(8,Math.min(anchor.left,window.innerWidth-toolbarWidth-8));
      const preferredTop=anchor.top-42;
      const top=preferredTop>=8?preferredTop:Math.min(window.innerHeight-42,anchor.bottom+8);
      setToolbar({visible:true,left,top});
    });
  }

  function autoLinkAtCaret(){
    const selection=window.getSelection();
    if(!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    const node=selection.anchorNode;
    if(node?.nodeType!==Node.TEXT_NODE) return;
    const offset=selection.anchorOffset;
    const match=String(node.textContent||'').slice(0,offset).match(/(https?:\/\/[^\s]+)$/i);
    if(!match) return;
    const range=document.createRange();
    range.setStart(node,offset-match[1].length);
    range.setEnd(node,offset);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('createLink',false,match[1]);
    selection.collapseToEnd();
    emit();
  }

  function pastePlainText(event){
    event.preventDefault();
    const plain=event.clipboardData.getData('text/plain');
    const escaped=plain
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/(https?:\/\/[^\s<]+)/gi,'<a href="$1" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\r?\n/g,'<br>');
    document.execCommand('insertHTML',false,escaped);
    emit();
    positionToolbar();
  }

  const tool=(title,content,onPress)=><button type="button" title={title} aria-label={title} onMouseDown={event=>{event.preventDefault();onPress();}}>{content}</button>;
  return <div className={'rich-text-field '+className}>
    {label&&<label>{label}</label>}
    <div className={'rich-text-toolbar'+(toolbar.visible?' is-visible':'')} style={{left:toolbar.left,top:toolbar.top}} role="toolbar" aria-label={`Formatação de ${label}`}>
      {tool('Negrito',<b>B</b>,()=>command('bold'))}
      {tool('Itálico',<i>I</i>,()=>command('italic'))}
      {tool('Sublinhado',<u>U</u>,()=>command('underline'))}
      {tool('Título','T',toggleTitle)}
      {tool('Lista','• Lista',()=>command('insertUnorderedList'))}
    </div>
    <div className="rich-text-editor-shell">
      <div
        ref={editorRef}
        className="rich-text-editor"
        data-task-id={taskId}
        data-task-field={taskField}
        style={minHeight?{minHeight}:undefined}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={positionToolbar}
        onInput={()=>{emit();positionToolbar();}}
        onBlur={event=>{emit();if(!event.currentTarget.parentElement?.parentElement?.contains(event.relatedTarget))setToolbar(current=>({...current,visible:false}));}}
        onPaste={pastePlainText}
        onKeyUp={positionToolbar}
        onMouseUp={positionToolbar}
        onScroll={positionToolbar}
        onClick={event=>{const anchor=event.target.closest?.('a');if(anchor&&(event.ctrlKey||event.metaKey)){event.preventDefault();window.open(anchor.href,'_blank','noopener,noreferrer');}}}
        onKeyDown={event=>{ if(event.key==='Enter'||event.key===' ') autoLinkAtCaret(); }}
      />
      <CopyTextButton text={value}/>
    </div>
  </div>;
}

function TaskLinksEditor({task,updateTask,field,title,placeholder='Cole um link'}) {
  function normalizedItems(){
    const saved=String(task?.[field]||'').split('\n').map(x=>x.trim()).filter(Boolean);
    return [...saved,''];
  }
  const [items,setItems]=useState(normalizedItems);
  useEffect(()=>{ setItems(normalizedItems()); },[task?.id,field,task?.[field]]);

  function persist(next){
    const cleaned=next.map(x=>String(x||'').trim()).filter(Boolean);
    setItems([...cleaned,'']);
    updateTask(task.id,{[field]:cleaned.join('\n')});
  }

  function change(index,value){
    const next=[...items];
    next[index]=value;
    if(index===next.length-1&&String(value||'').trim()) next.push('');
    setItems(next);
    const cleaned=next.map(x=>String(x||'').trim()).filter(Boolean);
    updateTask(task.id,{[field]:cleaned.join('\n')});
  }

  function remove(index){
    persist(items.filter((_,i)=>i!==index));
  }

  function move(index,direction){
    const target=index+direction;
    if(target<0||target>=items.length-1) return;
    const next=[...items];
    [next[index],next[target]]=[next[target],next[index]];
    persist(next);
  }

  return <div className="material-links-editor">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:8}}>
      <b>{title}</b>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {items.map((value,index)=>{
        const filled=String(value||'').trim();
        const isTrailingEmpty=index===items.length-1&&!filled;
        return <div key={`${field}-${index}`} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto auto auto auto',gap:8,alignItems:'center'}}>
          <input type="url" value={value} data-task-id={task.id} data-task-field={field} onChange={e=>change(index,e.target.value)} placeholder={isTrailingEmpty?placeholder:`Link ${index+1}`}/>
          <a href={filled||undefined} target="_blank" rel="noreferrer" aria-disabled={!filled} onClick={e=>{if(!filled)e.preventDefault();}} style={{pointerEvents:filled?'auto':'none',opacity:filled?1:.45,display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:36,padding:'0 12px',border:'1px solid rgba(var(--accent-rgb),.35)',borderRadius:10,background:'rgba(var(--accent-rgb),.04)',color:'var(--accent-pale)',textDecoration:'none',fontWeight:700,boxSizing:'border-box'}}>Abrir</a>
          <button type="button" className="material-link-move" onClick={()=>move(index,-1)} disabled={!filled||index===0}><span aria-hidden="true">↑</span></button>
          <button type="button" className="material-link-move" onClick={()=>move(index,1)} disabled={!filled||index>=items.length-2}><span aria-hidden="true">↓</span></button>
          <button type="button" onClick={()=>remove(index)} disabled={isTrailingEmpty}>Remover</button>
        </div>;
      })}
    </div>
  </div>
}

function TaskPage({task,tasks=[],setTasks,companies,users,statuses,types,statusById,updateTask,addLog,back,open,effectiveUser,isAdmin}){ 
  if(!task) return <section><button onClick={back}>Voltar</button><h1>Tarefa não encontrada</h1></section>; 
  const company=companies.find(c=>c.id===task.companyId); 
  const taskOrderValue = t => String(t.postDate || t.internalDate || t.createdAt || '9999-12-31');
  const clientTasks=[...(tasks||[])]
    .filter(t=>t.companyId===task.companyId)
    .filter(t=>t.id===task.id || canUserAccessTask(t, effectiveUser, statuses))
    .sort((a,b)=>taskOrderValue(a).localeCompare(taskOrderValue(b)) || String(a.internalDate||'').localeCompare(String(b.internalDate||'')) || String(a.title||'').localeCompare(String(b.title||'')));
  const currentClientIndex=clientTasks.findIndex(t=>t.id===task.id);
  const previousClientTask=currentClientIndex>0?clientTasks[currentClientIndex-1]:null;
  const nextClientTask=currentClientIndex>=0&&currentClientIndex<clientTasks.length-1?clientTasks[currentClientIndex+1]:null;
  const links=taskMaterialLinks(task); 
  const [slide,setSlide]=useState(0); 
  const [comment,setComment]=useState(''); 
  const [clientForm,setClientForm]=useState(null); 
  const [showBackToTop,setShowBackToTop]=useState(false);
  const isClient=effectiveUser.role==='client';
  const isTeam=effectiveUser.role==='team';
  const taskPermissionSet=effectiveUser.taskPermissions||builtInTaskPermissionsForRole(effectiveUser.role);
  const detailVisible={...builtInTaskDetailPermissionsForRole(effectiveUser.role).visible,...(taskPermissionSet.detailFields?.visible||{})};
  const detailEditable={...builtInTaskDetailPermissionsForRole(effectiveUser.role).editable,...(taskPermissionSet.detailFields?.editable||{})};
  const canViewDetail=id=>detailVisible[id]!==false;
  const canEditDetail=id=>canViewDetail(id)&&detailEditable[id]===true;
  const rawCanApprovePosts=taskPermissionSet.canApprovePosts===true;
  const approveCopyStatusId=statuses.find(s=>slug(s?.name)==='aprovar-copy')?.id||null;
  const approversForCompany=companyApprovers(task.companyId, users);
  const isMultiApprover=approversForCompany.length>1;
  const canApprovePosts=rawCanApprovePosts||(isClient&&isMultiApprover);
  const myVoteAlready=isMultiApprover&&(task.approvalVotes||[]).some(v=>v.userId===effectiveUser.id);
  const myCopyVoteAlready=isMultiApprover&&(task.copyApprovalVotes||[]).some(v=>v.userId===effectiveUser.id);
  const createCopyStatusId=statuses.find(s=>['criar-copy','copy'].includes(slug(s?.name)))?.id||'copy';
  const approveCopyIndex=approveCopyStatusId?statuses.findIndex(s=>s.id===approveCopyStatusId):-1;
  const createPostStatusId=statuses.find(s=>slug(s?.name)==='criar-post')?.id||(approveCopyIndex>=0?statuses.slice(approveCopyIndex+1).find(s=>s.active!==false)?.id:null)||'edicao';
  const isApproveCopyStatus=!!approveCopyStatusId&&task.status===approveCopyStatusId;
  const configCompanies=isClient
    ? companies.filter(c=>c.id===task.companyId||(effectiveUser.companyIds||[]).includes(c.id))
    : companies;
  const configResponsibleUsers=isClient
    ? users.filter(u=>u.id===task.responsibleId)
    : users.filter(u=>u.active&&(u.role==='team'||u.role==='admin'));
  const canAccess=isAdmin||task.startedAt; 
  const timeline=(task.logs||[]).filter(l=>!isClient||l.visibility==='client'||l.userId===effectiveUser.id).slice().sort((a,b)=>new Date(b.at)-new Date(a.at)); 
  const comments=timeline.filter(l=>l.type==='comment');
  const history=timeline.filter(l=>l.type!=='comment');
  function timelineTimeLabel(dateStr){
    if(!dateStr) return '';
    const d=new Date(dateStr);
    const nowD=new Date();
    const sameDay=d.toDateString()===nowD.toDateString();
    if(sameDay){
      const diffMin=Math.floor((nowD-d)/60000);
      if(diffMin<1) return 'agora';
      if(diffMin<60) return `há ${diffMin}min`;
      return `há ${Math.floor(diffMin/60)}h`;
    }
    return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  }
  function escapeRegExp(value){ return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function cleanCommentText(log){
    const raw=String(log?.text||'').trim();
    const author=String(log?.user||'').trim();
    if(!raw||!author) return raw;
    const prefix=new RegExp(`^${escapeRegExp(author)}\\s+\\d{1,2}\\/\\d{1,2}\\/\\d{4}(?:,)?\\s+\\d{1,2}:\\d{2}(?::\\d{2})?\\s*`,'i');
    return raw.replace(prefix,'').trim();
  }
  const taskRef=useRef(task);
  useEffect(()=>{ taskRef.current=task; });
  useEffect(()=>{
    const updateBackToTop=()=>setShowBackToTop(window.scrollY>420);
    updateBackToTop();
    window.addEventListener('scroll',updateBackToTop,{passive:true});
    return ()=>window.removeEventListener('scroll',updateBackToTop);
  },[]);
  function pauseTimer(logText='Timer pausado automaticamente ao sair da tarefa.'){
    const current=taskRef.current;
    if(!current?.startedAt || !isTeam || current.startedById!==effectiveUser.id) return;
    const patch=closeTimerPatch(current, now());
    if(!patch) return;
    updateTask(current.id, patch, logText);
  }
  useEffect(()=>{
    if(!isTeam || !task.startedAt || task.startedById!==effectiveUser.id) return;
    const beforeUnload=()=>pauseTimer('Timer pausado automaticamente ao fechar a tela.');
    window.addEventListener('beforeunload', beforeUnload);
    return ()=>{
      window.removeEventListener('beforeunload', beforeUnload);
      pauseTimer();
    };
  },[task.id, task.startedAt, task.startedById, isTeam, effectiveUser.id]);
  function handleTaskBack(){ pauseTimer('Timer pausado ao sair da tarefa.'); back(); }
  function goToClientTask(target){ if(!target) return; pauseTimer('Timer pausado ao trocar de tarefa.'); open(target.id); setSlide(0); }
  const hiddenTeam=isTeam&&!canAccess; 
  const showTeamProtected=!hiddenTeam && !isClient;
  const actionStyle=(statusId,solid=true)=>{ const color=statusById[statusId]?.color||'var(--gold)'; return {borderColor:color,color,'--tint':color}; };
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
  function sendApproval(){
    const validLinks=taskMaterialLinks(task);
    if(!validLinks.length){
      alert('Adicione pelo menos um link de visualização antes de enviar para aprovação.');
      return;
    }
    const elapsed=task.startedAt?Math.floor((Date.now()-new Date(task.startedAt).getTime())/1000):0;
    const patch={startedAt:null,startedById:null,timerHeartbeatAt:null,status:'aprovacao',previousWorkStatus:task.status};
    if(task.status==='alteracao') patch.totalAlterSeconds=(task.totalAlterSeconds||0)+elapsed;
    else patch.totalEditSeconds=(task.totalEditSeconds||0)+elapsed;
    updateTask(task.id,patch,'Enviado para aprovação.');
    notifySettingsSaved('Enviado para aprovação');
  } 
  function returnToCopy(){
    const rawReason=prompt('Motivo do retorno ao Copy:');
    if(rawReason===null) return;
    const reason=String(rawReason||'').trim();
    if(!reason) return alert('Informe o motivo para retornar ao Copy.');
    const elapsed=task.startedAt?Math.floor((Date.now()-new Date(task.startedAt).getTime())/1000):0;
    const patch={startedAt:null,startedById:null,timerHeartbeatAt:null,status:'copy',previousWorkStatus:task.status,extraLogs:[{
      id:safeUUID(),
      user:effectiveUser.name,
      userId:effectiveUser.id,
      type:'comment',
      visibility:'internal',
      at:now(),
      text:`${effectiveUser.name} retornou para Copy. Motivo: ${reason}`,
      resolved:false,
      statusAtTime:task.status
    }]};
    if(task.status==='alteracao') patch.totalAlterSeconds=(task.totalAlterSeconds||0)+elapsed;
    else patch.totalEditSeconds=(task.totalEditSeconds||0)+elapsed;
    updateTask(task.id,patch,'Retornado para Copy com motivo.');
    notifySettingsSaved('Retornado para Copy');
  } 
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
        id:safeUUID(),
        user:effectiveUser.name,
        userId:effectiveUser.id,
        type:'comment',
        visibility:'internal',
        at:now(),
        text:`${effectiveUser.name} enviou para Aguardando. Motivo: ${reason}`,
        resolved:false,
        statusAtTime:task.status
      }];
    }

    updateTask(task.id,patch,reason?'Marcado como aguardando com comentário.':'Marcado como aguardando.');
    notifySettingsSaved('Marcado como aguardando');
  } 
  function approve(){
    if(!clientForm?.art||!clientForm?.caption) return alert('Selecione artes/vídeos aprovados e legenda aprovada para aprovar.');
    const eventAt=now();
    if(isMultiApprover){
      if((task.approvalVotes||[]).some(v=>v.userId===effectiveUser.id)){
        alert('Você já registrou sua aprovação para esta tarefa.');
        setClientForm(null);
        return;
      }
      const votes=[...(task.approvalVotes||[]),{userId:effectiveUser.id,userName:effectiveUser.name,at:eventAt}];
      const names=votes.map(v=>v.userName).join(', ');
      const entry={id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'comment',visibility:isClient?'client':'internal',at:eventAt,text:`${effectiveUser.name} aprovou a tarefa. (${votes.length} de ${approversForCompany.length} aprovaram)`,resolved:false,statusAtTime:task.status};
      updateTask(task.id,{approvalVotes:votes,logs:[...(task.logs||[]),entry]},`Voto de aprovação registrado (${votes.length} de ${approversForCompany.length}).`);
      notifyTask(task,`${votes.length} de ${approversForCompany.length} aprovaram (${names}). Confirme manualmente antes de despachar.`,'Aprovação',task.status,effectiveUser.id,{actorName:effectiveUser.name,at:eventAt});
      setClientForm(null);
      notifySettingsSaved('Aprovação registrada');
      return;
    }
    const entry={id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'comment',visibility:isClient?'client':'internal',at:eventAt,text:`${effectiveUser.name} aprovou a tarefa.`,resolved:false,statusAtTime:task.status};
    updateTask(task.id,{status:'agendamento',logs:[...(task.logs||[]),entry],statusLogText:`${effectiveUser.name} aprovou a tarefa`});
    setClientForm(null);
    notifySettingsSaved('Tarefa aprovada');
  }
  function approveCopy(){
    if(!createPostStatusId) return alert('Não foi possível identificar o próximo status após Aprovar copy.');
    const eventAt=now();
    if(isMultiApprover){
      if((task.copyApprovalVotes||[]).some(v=>v.userId===effectiveUser.id)){
        alert('Você já registrou sua aprovação da copy para esta tarefa.');
        setClientForm(null);
        return;
      }
      const votes=[...(task.copyApprovalVotes||[]),{userId:effectiveUser.id,userName:effectiveUser.name,at:eventAt}];
      const names=votes.map(v=>v.userName).join(', ');
      const entry={id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'comment',visibility:isClient?'client':'internal',at:eventAt,text:`${effectiveUser.name} aprovou a copy. (${votes.length} de ${approversForCompany.length} aprovaram)`,resolved:false,statusAtTime:task.status};
      updateTask(task.id,{copyApprovalVotes:votes,logs:[...(task.logs||[]),entry]},`Voto de aprovação de copy registrado (${votes.length} de ${approversForCompany.length}).`);
      notifyTask(task,`${votes.length} de ${approversForCompany.length} aprovaram a copy (${names}). Confirme manualmente antes de despachar.`,'Aprovação',task.status,effectiveUser.id,{actorName:effectiveUser.name,at:eventAt});
      setClientForm(null);
      notifySettingsSaved('Aprovação de copy registrada');
      return;
    }
    const entry={id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'comment',visibility:isClient?'client':'internal',at:eventAt,text:`${effectiveUser.name} aprovou a copy.`,resolved:false,statusAtTime:task.status};
    updateTask(task.id,{status:createPostStatusId,logs:[...(task.logs||[]),entry],statusLogText:`${effectiveUser.name} aprovou a copy`});
    setClientForm(null);
    notifySettingsSaved('Copy aprovada');
  }
  function requestCopyChange(){
    const desc=String(clientForm?.copyDescription||'').trim();
    if(!desc) return alert('Descreva o que precisa ser alterado na copy.');
    const text=`Solicitação de alteração na copy\nDescrição: ${desc}`;
    const eventAt=now();
    const entry={id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'comment',visibility:isClient?'client':'internal',at:eventAt,text,resolved:false,statusAtTime:task.status};
    updateTask(task.id,{status:createCopyStatusId,logs:[...(task.logs||[]),entry],statusLogText:`${effectiveUser.name} solicitou alteração na copy`});
    if(isClient){
      notifyTask(task,text,CLIENT_REQUEST_NOTIFICATION_EVENT,createCopyStatusId,effectiveUser.id,{actorName:effectiveUser.name,logId:entry.id,at:eventAt});
    }
    setClientForm(null);
    notifySettingsSaved('Alteração de copy solicitada');
  }
  function requestChange(){
    const items=[];
    if(clientForm?.artChange) items.push('Alterar arte/vídeo');
    if(clientForm?.text) items.push('Alterar texto na arte/vídeo');
    if(clientForm?.captionChange) items.push('Alterar legenda');
    if(clientForm?.redo) items.push('Refazer o post');
    if(!items.length) return alert('Selecione pelo menos uma opção de alteração.');
    const desc=String(clientForm?.description||'').trim();
    if(!desc) return alert('Descreva as alterações que você gostaria de aplicar.');
    const text=`Solicitação de alteração
Itens marcados: ${items.join(', ')}
Descrição: ${desc}`;
    const eventAt=now();
    const entry={id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'comment',visibility:isClient?'client':'internal',at:eventAt,text,resolved:false,statusAtTime:task.status};
    updateTask(task.id,{status:'alteracao',alterationCount:(task.alterationCount||0)+1,logs:[...(task.logs||[]),entry]});
    if(isClient){
      notifyTask(task,text,CLIENT_REQUEST_NOTIFICATION_EVENT,'alteracao',effectiveUser.id,{actorName:effectiveUser.name,logId:entry.id,at:eventAt});
    }
    setClientForm(null);
    notifySettingsSaved('Alteração solicitada');
  }
  function reopenFromApproval(){ const nextStatus=task.previousWorkStatus||'edicao'; updateTask(task.id,{status:nextStatus,startedAt:now(),startedById:effectiveUser.id,timerHeartbeatAt:now()},`Tarefa reaberta para ${statusById[nextStatus]?.name||nextStatus}.`); notifySettingsSaved('Tarefa reaberta'); }
  function reviewAgain(){ updateTask(task.id,{status:'aprovacao'},'Cliente voltou para revisão.'); }
  function retractVote(){
    const votes=(task.approvalVotes||[]).filter(v=>v.userId!==effectiveUser.id);
    updateTask(task.id,{approvalVotes:votes},`${effectiveUser.name} retirou o voto de aprovação (${votes.length} de ${approversForCompany.length}).`);
    notifySettingsSaved('Voto retirado');
  }
  function retractCopyVote(){
    const votes=(task.copyApprovalVotes||[]).filter(v=>v.userId!==effectiveUser.id);
    updateTask(task.id,{copyApprovalVotes:votes},`${effectiveUser.name} retirou o voto de aprovação da copy (${votes.length} de ${approversForCompany.length}).`);
    notifySettingsSaved('Voto de copy retirado');
  } 
  async function copyTaskLink(){
    const url=taskShareUrl(task.id);
    try{
      await navigator.clipboard.writeText(url);
      notifySettingsSaved('Link da tarefa copiado');
    }catch(err){
      prompt('Copie o link da tarefa:', url);
    }
  }
  function duplicateTaskFromDetail(){
    if(!isAdmin || !setTasks || !task) return;
    const createdAt=now();
    const newId=safeUUID();
    const cloned={
      ...task,
      id:newId,
      title:`${task.title||'Tarefa'} (cópia)`,
      archived:false,
      startedAt:null,
      startedById:null,
      timerHeartbeatAt:null,
      duplicatedFromTaskId:task.id,
      logs:[{id:safeUUID(),user:effectiveUser.name,userId:effectiveUser.id,type:'log',visibility:'internal',at:createdAt,text:`${effectiveUser.name} duplicou esta tarefa a partir de ${taskShareUrl(task.id)}`}],
      comments:[],
      createdAt,
      updatedAt:createdAt
    };
    setTasks(prev=>[...prev,cloned]);
    alert('Tarefa duplicada.');
  }
  function deleteTaskFromDetail(){
    if(!isAdmin || !setTasks || !task) return;
    const typed=prompt('Digite EXCLUIR para apagar permanentemente esta tarefa.');
    if(typed!=='EXCLUIR') return;
    setTasks(prev=>prev.filter(t=>t.id!==task.id));
    back();
  }
  function addComment(){ if(!comment.trim()) return; addLog(task.id,comment,'comment',isClient?'client':'internal'); setComment(''); notifySettingsSaved('Comentário adicionado'); }
  function resolveLog(logId){ updateTask(task.id,{logs:(task.logs||[]).map(l=>l.id===logId?{...l,resolved:!l.resolved,resolvedAt:!l.resolved?now():null,resolvedBy:!l.resolved?effectiveUser.name:null}:l)}); }
  return <section><div className="task-topbar task-topbar-split"><button onClick={handleTaskBack}>← Voltar</button><div className="task-nav-actions task-top-nav"><button disabled={!previousClientTask} onClick={()=>goToClientTask(previousClientTask)}>← Tarefa anterior</button><button disabled={!nextClientTask} onClick={()=>goToClientTask(nextClientTask)}>Próxima tarefa →</button></div></div><div className={'task-page '+(isClient?'client-task':'')}><div className="task-left">
  {canViewDetail('title')&&<div className="task-title">{canEditDetail('title')?<input className="task-title-input" value={task.title||''} data-task-id={task.id} data-task-field="title" onChange={e=>updateTask(task.id,{title:e.target.value})} aria-label="Nome da tarefa"/>:<h1>{task.title}</h1>}{(canViewDetail('status')||isClient)&&<span style={{borderColor:statusById[task.status]?.color,color:statusById[task.status]?.color}}>{statusById[task.status]?.name}</span>}</div>}
  {canViewDetail('preview')&&<div className="insta"><div className="insta-top"><AvatarMini value={company?.logo} label={company?.name}/><b>{company?.name}</b><button type="button" className="insta-copy-link" onClick={copyTaskLink} aria-label="Copiar link da tarefa" title="Copiar link da tarefa"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button></div><div className="media-box adaptive-media-box">{links.length?<><Media url={links[Math.min(slide,links.length-1)]} type={task.type} slide={Math.min(slide,links.length-1)} total={links.length}/>{links.length>1&&<div className="slide-controls"><button onClick={(e)=>{e.preventDefault();e.stopPropagation();setSlide(v=>Math.max(0,v-1));}}>‹</button><button onClick={(e)=>{e.preventDefault();e.stopPropagation();setSlide(v=>Math.min(links.length-1,v+1));}}>›</button></div>}</>:<div className="empty-media">Sem material pronto ainda</div>}</div><InstagramIcons/><div className="insta-caption"><b>{company?.name}</b> <RichTextDisplay value={task.caption||''}/></div></div>}
  <div className="content-fields">
    {!hiddenTeam&&canViewDetail('copyInstructions')&&(canEditDetail('copyInstructions')?<RichTextField label="Instruções ao copy" value={task.copyInstructions||''} taskId={task.id} taskField="copyInstructions" onChange={e=>updateTask(task.id,{copyInstructions:e.target.value})}/>:<ReadOnlyInstruction title="Instruções ao copy" text={task.copyInstructions||''}/>) }
    {!hiddenTeam&&canViewDetail('editorInstructions')&&(canEditDetail('editorInstructions')?<RichTextField label="Instruções ao editor" value={task.editorInstructions||''} taskId={task.id} taskField="editorInstructions" onChange={e=>updateTask(task.id,{editorInstructions:e.target.value})}/>:<ReadOnlyInstruction title="Instruções ao editor" text={task.editorInstructions||''}/>) }
    {!hiddenTeam&&canViewDetail('usefulLinks')&&(canEditDetail('usefulLinks')?<RichTextField label="Links úteis" value={task.usefulLinks||''} taskId={task.id} taskField="usefulLinks" onChange={e=>updateTask(task.id,{usefulLinks:e.target.value})} placeholder="Cole links e descreva para que serve cada um."/>:<ReadOnlyInstruction title="Links úteis" text={task.usefulLinks||''}/>) }
    <hr className="content-fields-divider"/>
    {canViewDetail('copy')&&(canEditDetail('copy')?<RichTextField label="Copy" value={task.copy||''} taskId={task.id} taskField="copy" onChange={e=>updateTask(task.id,{copy:e.target.value})}/>:<ReadOnlyInstruction title="Copy" text={task.copy||''}/>) }
    {canViewDetail('caption')&&(canEditDetail('caption')?<RichTextField label="Legenda" value={task.caption||''} taskId={task.id} taskField="caption" onChange={e=>updateTask(task.id,{caption:e.target.value})}/>:<ReadOnlyInstruction title="Legenda" text={task.caption||''}/>) }
    <hr className="content-fields-divider"/>
    {canViewDetail('finalLink')&&(isClient
      ? (['agendamento','pronto'].includes(task.status) && task.finalLink
          ? <ReadOnlyInstruction title="Download dos arquivos" text={task.finalLink||''}/>
          : null)
      : (canEditDetail('finalLink')?<RichTextField label="Link da pasta final" value={task.finalLink||''} taskId={task.id} taskField="finalLink" onChange={e=>updateTask(task.id,{finalLink:e.target.value})} placeholder="Cole o link final liberado após a aprovação"/>:<ReadOnlyInstruction title="Link da pasta final" text={task.finalLink||''}/>)
    ) }
    {!isClient&&canViewDetail('materialLinks')&&(canEditDetail('materialLinks')?<TaskLinksEditor task={task} updateTask={updateTask} field="materialLinks" title="Links de material finalizado" placeholder="Adicionar material finalizado"/>:<ReadOnlyReadyLinks title="Links de material finalizado" text={task.materialLinks||''}/>) }
  </div>
</div><aside className="task-side">{['companyId','responsibleId','type','status','internalDate','postDate'].some(canViewDetail)&&<div className="panel panel-config"><h2>Configurações</h2>
  {canViewDetail('companyId')&&<label>Cliente<div className="select-entity"><EntityLabel value={company?.logo} label={company?.name||'Empresa'}/><select disabled={!canEditDetail('companyId')} value={task.companyId} onChange={e=>updateTask(task.id,{companyId:e.target.value})}>{[...companies].sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR',{sensitivity:'base'})).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div></label>}
  {canViewDetail('responsibleId')&&<label>Responsável<div className="select-entity"><EntityLabel value={users.find(u=>u.id===task.responsibleId)?.avatar} label={users.find(u=>u.id===task.responsibleId)?.name||'Responsável'}/><select disabled={!canEditDetail('responsibleId')} value={task.responsibleId} onChange={e=>updateTask(task.id,{responsibleId:e.target.value})}>{users.filter(u=>u.active&&(u.role==='team'||u.role==='admin')).sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR',{sensitivity:'base'})).map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></div></label>}
  {canViewDetail('type')&&<label>Tipo<select disabled={!canEditDetail('type')} value={task.type} onChange={e=>updateTask(task.id,{type:e.target.value})}>{types.map(t=><option key={t}>{t}</option>)}</select></label>}
  {canViewDetail('status')&&<label>Status<div className="status-select" style={{borderColor:statusById[task.status]?.color||undefined,'--status-color':statusById[task.status]?.color||'var(--line)'}}>{statusDot(statusById[task.status])}<select disabled={!canEditDetail('status')} value={task.status} onChange={e=>updateTask(task.id,{status:e.target.value})}>{statuses.map(s=><option value={s.id} key={s.id} style={{background:`${s.color}20`,color:s.color}}>{s.name}</option>)}</select></div></label>}
  {canViewDetail('internalDate')&&<label className={'date-field '+priorityClass(task.internalDate)}>Prazo<input disabled={!canEditDetail('internalDate')} type="date" value={task.internalDate||''} onChange={e=>updateTask(task.id,{internalDate:e.target.value})}/></label>}
  {canViewDetail('postDate')&&<label>Data do post<input disabled={!canEditDetail('postDate')} type="date" value={task.postDate||''} onChange={e=>updateTask(task.id,{postDate:e.target.value})}/></label>}
</div>}{canViewDetail('stats')&&<div className="panel panel-stats"><h2>Estatísticas</h2><p>Alterações: <b>{task.alterationCount||0}</b></p><p>Tempo geral: <b>{fmtSec((task.totalEditSeconds||0)+(task.totalAlterSeconds||0))}</b></p><p>Tempo em edição: <b>{fmtSec(task.totalEditSeconds)}</b></p><p>Tempo em alteração: <b>{fmtSec(task.totalAlterSeconds)}</b></p></div>}<div className="panel panel-actions"><h2>Ações</h2>{isMultiApprover&&task.status==='aprovacao'&&(task.approvalVotes?.length>0)&&<div className="approval-votes-banner">⚠ {task.approvalVotes.length} de {approversForCompany.length} usuários aprovaram ({task.approvalVotes.map(v=>v.userName).join(', ')}). Confirme manualmente antes de despachar.</div>}{isMultiApprover&&isApproveCopyStatus&&(task.copyApprovalVotes?.length>0)&&<div className="approval-votes-banner">⚠ {task.copyApprovalVotes.length} de {approversForCompany.length} usuários aprovaram a copy ({task.copyApprovalVotes.map(v=>v.userName).join(', ')}). Confirme manualmente antes de despachar.</div>}{isTeam&&!canAccess&&['edicao','alteracao','aguardando'].includes(task.status)&&<button className="primary" onClick={start}>{task.status==='aguardando'?'Reabrir tarefa':'Acessar tarefa'}</button>}{isTeam&&!task.startedAt&&task.status==='aprovacao'&&<button className="primary" onClick={reopenFromApproval}>Reabrir tarefa</button>}{isTeam&&task.startedAt&&<div className="status-action-row" style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="status-tinted" style={actionStyle('copy')} onClick={returnToCopy}>Retornar ao copy</button><button className="status-tinted" style={actionStyle('aguardando')} onClick={markWaiting}>Marcar aguardando</button><button className="status-tinted" style={actionStyle('aprovacao')} onClick={sendApproval}>Enviar para aprovação</button></div>}{isAdmin&&isMultiApprover&&task.status==='aprovacao'&&(task.approvalVotes?.length>0)&&<button className="status-tinted" style={actionStyle('agendamento')} onClick={()=>{ if(confirm('Avançar esta tarefa para Agendamento mesmo sem todos os votos do comitê?')) updateTask(task.id,{status:'agendamento',approvalVotes:[]},`${effectiveUser.name} avançou manualmente para Agendamento (comitê: ${task.approvalVotes.length} de ${approversForCompany.length}).`); }}>Avançar mesmo assim</button>}{isAdmin&&isMultiApprover&&isApproveCopyStatus&&createPostStatusId&&(task.copyApprovalVotes?.length>0)&&<button className="status-tinted" style={actionStyle('aprovacao')} onClick={()=>{ if(confirm('Avançar a copy desta tarefa mesmo sem todos os votos do comitê?')) updateTask(task.id,{status:createPostStatusId,copyApprovalVotes:[]},`${effectiveUser.name} avançou a copy manualmente (comitê: ${task.copyApprovalVotes.length} de ${approversForCompany.length}).`); }}>Avançar mesmo assim</button>}{isAdmin&&<div className="admin-task-actions-row"><button onClick={()=>{ if(confirm(task.archived?'Desarquivar esta tarefa?':'Arquivar esta tarefa?')) updateTask(task.id,{archived:!task.archived}, task.archived?'Tarefa desarquivada.':'Tarefa arquivada.')}}>{task.archived?'Desarquivar':'Arquivar'}</button><button onClick={duplicateTaskFromDetail}>Duplicar</button><button className="danger" onClick={deleteTaskFromDetail}>Excluir</button></div>}{canApprovePosts&&task.status==='aprovacao'&&!myVoteAlready&&<ClientApprovalForm form={clientForm} setForm={setClientForm} approve={approve} requestChange={requestChange} statusById={statusById}/>} {canApprovePosts&&task.status==='aprovacao'&&myVoteAlready&&<button className="status-tinted" style={actionStyle('aprovacao')} onClick={retractVote}>Revisar novamente</button>} {canApprovePosts&&isApproveCopyStatus&&!myCopyVoteAlready&&<CopyApprovalForm form={clientForm} setForm={setClientForm} approveCopy={approveCopy} requestCopyChange={requestCopyChange} statusById={statusById} createPostStatusId={createPostStatusId} createCopyStatusId={createCopyStatusId}/>} {canApprovePosts&&isApproveCopyStatus&&myCopyVoteAlready&&<button className="status-tinted" style={actionStyle('aprovacao')} onClick={retractCopyVote}>Revisar novamente</button>} {canApprovePosts&&task.status==='agendamento'&&<button className="status-tinted" style={actionStyle('aprovacao')} onClick={reviewAgain}>Revisar novamente</button>} {isClient&&task.status==='aguardando'&&<p>Aguardando informações. Use os comentários se precisar responder.</p>}</div>{canViewDetail('comments')&&(!hiddenTeam||isAdmin||isClient)&&<div className="panel comments-panel"><h2>Linha do tempo</h2>{canEditDetail('comments')&&!(isClient&&(['agendamento','pronto'].includes(task.status)||(task.status==='aprovacao'&&myVoteAlready)||(isApproveCopyStatus&&myCopyVoteAlready)))&&<div className="comment-line"><AutoTextarea className="comment-compose" value={comment} onChange={e=>setComment(e.target.value)} minHeight={42} rows={1} placeholder="Adicionar comentário..."/><button onClick={addComment}>Enviar</button></div>}{isClient&&['agendamento','pronto'].includes(task.status)&&<p className="muted-note">Esta tarefa já avançou na produção — comentários de cliente ficam desabilitados a partir daqui.</p>}{isClient&&!['agendamento','pronto'].includes(task.status)&&((task.status==='aprovacao'&&myVoteAlready)||(isApproveCopyStatus&&myCopyVoteAlready))&&<p className="muted-note">Você já registrou sua decisão — comentários ficam disponíveis novamente se você revisar.</p>}{(canViewDetail('history')?timeline:comments).length?(canViewDetail('history')?timeline:comments).map(l=>{const isComment=l.type==='comment';const fromSt=l.fromStatusId?statusById[l.fromStatusId]:null;const toSt=l.toStatusId?statusById[l.toStatusId]:null;const atSt=l.statusAtTime?statusById[l.statusAtTime]:null;return <div className={'timeline-entry '+(isComment?'is-comment':'is-log')+(l.resolved?' resolved':'')} key={l.id}><div className="timeline-entry-head"><b>{l.user}</b><small>{timelineTimeLabel(l.at)}</small>{fromSt&&toSt&&<span className="status-transition"><span style={{color:fromSt.color}}>{fromSt.name}</span> → <span style={{color:toSt.color}}>{toSt.name}</span></span>}</div>{isComment&&<p>{linkify(cleanCommentText(l))}</p>}{isComment&&atSt&&<span className="status-pill status-pill-small" style={{color:atSt.color,background:`${atSt.color}20`,borderColor:atSt.color}}>em: {atSt.name}</span>}{!isComment&&!(fromSt&&toSt)&&<p className="timeline-log-text">{linkify(l.text)}</p>}{isComment&&!isClient&&<button className="resolve-btn" onClick={()=>resolveLog(l.id)}>{l.resolved?'Reabrir':'Resolver'}</button>}{l.resolved&&<small className="resolved-note">Resolvido por {l.resolvedBy||'equipe'}{l.resolvedAt?' · '+timelineTimeLabel(l.resolvedAt):''}</small>}</div>;}):<p className="muted-note">Nenhuma atividade ainda.</p>}</div>}</aside></div>{showBackToTop&&<button type="button" className="app-back-top" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="Voltar ao topo" title="Voltar ao topo"><BackToTopGlyph/></button>}</section> 
}
function InstagramIcons(){ return <div className="insta-icons insta-real-icons">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6c-1.7-1.9-4.4-2-6.2-.3L12 6.7 9.4 4.3C7.6 2.6 4.9 2.7 3.2 4.6c-1.8 2-1.6 5.1.4 7l8.4 7.8 8.4-7.8c2-1.9 2.2-5 .4-7Z"/></svg>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.7 8.2 9.2 9.2 0 0 1-3.7-.8L3 20l1.3-5.1a7.8 7.8 0 0 1-.8-3.4A8.4 8.4 0 0 1 12 3.3a8.4 8.4 0 0 1 9 8.2Z"/></svg>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 3 9.8 14.6M22 3l-7 19-5.2-7.4L2 11.2 22 3Z"/></svg>
  <svg className="save-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>
</div> }
function CopyApprovalForm({form,setForm,approveCopy,requestCopyChange,statusById,createPostStatusId,createCopyStatusId}){
  const f=form||{};
  const F=(k,v)=>setForm({...f,[k]:v});
  const buttonStyle=(statusId)=>{ const color=statusById?.[statusId]?.color||'var(--gold)'; return {borderColor:color,color,'--tint':color}; };
  const canRequest=String(f.copyDescription||'').trim().length>0;
  return <div className="client-actions copy-approval-form">
    <h3>Aprovar copy</h3>
    <p className="muted-note">Confirme a copy para seguir para a criação do post.</p>
    <button className="status-tinted" style={buttonStyle(createPostStatusId)} onClick={approveCopy}>Aprovar copy</button>
    <h3>Solicitar alteração</h3>
    <AutoTextarea value={f.copyDescription||''} onChange={e=>F('copyDescription',e.target.value)} minHeight={88} placeholder="Descreva o que precisa ser alterado na copy"/>
    <button className="status-tinted" style={canRequest?buttonStyle(createCopyStatusId):undefined} disabled={!canRequest} onClick={requestCopyChange}>Solicitar alteração</button>
    {!canRequest&&<small>Descreva o ajuste para liberar a solicitação.</small>}
  </div>;
}

function ClientApprovalForm({form,setForm,approve,requestChange,statusById}){ 
  const f=form||{}; 
  const F=(k,v)=>setForm({...f,[k]:v}); 
  const hasChange=!!(f.artChange||f.text||f.captionChange||f.redo);
  const buttonStyle=(statusId)=>{ const color=statusById?.[statusId]?.color||'var(--gold)'; return {borderColor:color,color,'--tint':color}; };
  const canRequest=hasChange && String(f.description||'').trim().length>0;
  function toggleRedo(checked){
    if(checked){
      const ok=confirm('Tem certeza que deseja solicitar o refazimento do post? Essa opção indica uma alteração maior. Informe o motivo com detalhes na caixa de texto.');
      if(!ok) return F('redo',false);
    }
    F('redo',checked);
  }
  return <div className="client-actions"><h3>Aprovar</h3><label><input type="checkbox" checked={!!f.art} onChange={e=>F('art',e.target.checked)}/> Artes/vídeos aprovados</label><label><input type="checkbox" checked={!!f.caption} onChange={e=>F('caption',e.target.checked)}/> Legenda aprovada</label><button className="status-tinted" style={buttonStyle('agendamento')} onClick={approve}>Aprovar</button><h3>Solicitar alteração</h3><label><input type="checkbox" checked={!!f.artChange} onChange={e=>F('artChange',e.target.checked)}/> Alterar arte/vídeo</label><label><input type="checkbox" checked={!!f.text} onChange={e=>F('text',e.target.checked)}/> Alterar texto na arte/vídeo</label><label><input type="checkbox" checked={!!f.captionChange} onChange={e=>F('captionChange',e.target.checked)}/> Alterar legenda</label><label><input type="checkbox" checked={!!f.redo} onChange={e=>toggleRedo(e.target.checked)}/> <span className="danger-text">Refazer o post</span></label><textarea value={f.description||''} onChange={e=>F('description',e.target.value)} placeholder="Descreva as alterações que você gostaria de aplicar"/><button className="status-tinted" style={canRequest?buttonStyle('alteracao'):undefined} disabled={!canRequest} onClick={requestChange}>Solicitar alteração</button>{hasChange&&!canRequest&&<small>Descreva o motivo para liberar a solicitação.</small>}</div> 
}
function DriveAdaptiveMedia({url}){
  const [fallback,setFallback]=useState(false);
  // Round130: rollback cirúrgico para o comportamento estável da round43.
  // Drive primeiro tenta renderizar como prévia direta; se falhar, cai para o preview do próprio Drive.
  // Não decide pelo tipo do post e não força player direto do Drive, que estava gerando tela cinza/interrogação.
  if(fallback) return <iframe className="drive-fallback-frame round130-drive-frame" title="preview" src={drivePreview(url)} allow="autoplay; fullscreen"/>;
  return <img className="media-fit-image" src={driveDirect(url)} onError={()=>setFallback(true)} alt="Prévia do material"/>;
}
function Media({url}){ 
  const direct=driveDirect(url);
  const lower=(url||'').toLowerCase();
  const isImg=/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower);
  const isVid=/\.(mp4|webm|mov)(\?|$)/.test(lower);
  const isDrive=(url||'').includes('drive.google.com');
  return <div className="media-inner round130-media-preview">{isDrive?<DriveAdaptiveMedia url={url}/>:isVid?<video className="media-fit-image" muted playsInline loop autoPlay src={direct}/>:isImg?<img className="media-fit-image" src={direct} alt="Prévia do material"/>:<a className="media-open outside" target="_blank" href={url}>Abrir material</a>}</div> 
}
function CompaniesPage({companies,setCompanies,tasks=[],setTasks=()=>{},users=[],setUsers=()=>{}}){
  const preferencesStorageKey='argos_settings_companies_preferences';
  const initialPreferences=load(preferencesStorageKey,{sort:'created',showArchived:false});
  const [editing,setEditing]=useState(null);
  const [sort,setSort]=useState(initialPreferences.sort||'created');
  const [showArchived,setShowArchived]=useState(!!initialPreferences.showArchived);
  useEffect(()=>{ save(preferencesStorageKey,{sort,showArchived}); },[sort,showArchived]);
  const visibleCompanies=companies.filter(c=>showArchived ? c.active===false : c.active!==false);
  const sortedCompanies=sortEntities(visibleCompanies,sort,c=>c.name);
  function saveCompany(c){
    const exists=companies.some(x=>x.id===c.id);
    const data={...c,id:c.id||slug(c.name)||safeUUID(),createdAt:c.createdAt||now(),active:c.active!==false};
    setCompanies(exists?companies.map(x=>x.id===data.id?data:x):[...companies,data]);
    setEditing(null);
    notifySettingsSaved('Empresa salva');
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
  return <div className="settings-section"><div className="section-header section-header-actions-only"><div className="settings-toolbar"><label className="toggle-archived"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Mostrar só arquivadas</label><SortControl value={sort} setValue={setSort} options={[{value:'created',label:'Data de criação'},{value:'name',label:'Nome'}]}/><button className="primary" onClick={()=>setEditing({id:'',name:'',instagram:'',logo:'',entryDate:'',active:true,createdAt:now()})}>+ Nova empresa</button></div></div><div className="client-grid compact-admin-grid" style={{display:'flex',flexDirection:'column',gap:12}}>{sortedCompanies.map(c=><div className={'panel '+(c.active===false?'archived-card':'')} key={c.id}><div className="mini-title"><AvatarMini value={c.logo} label={c.name}/><div><h2>{c.name}</h2><small>{c.instagram || 'Sem Instagram'} {c.active===false?'• Arquivada':''}</small></div></div><div className="row-actions"><button onClick={()=>setEditing(c)}>Editar</button></div></div>)}</div>{editing&&<CompanyEditor c={editing} users={users} save={saveCompany} cancel={()=>setEditing(null)} onArchive={archiveCompany} onDelete={deleteCompany}/>}</div>
}
function ClientUsersPage({users,setUsers,companies,statuses,currentUser=null,accessDefaults=null}){
  const preferencesStorageKey=`argos_settings_clients_preferences_${currentUser?.id||'admin'}`;
  const initialPreferences=load(preferencesStorageKey,{sort:'company',showArchived:false});
  const [editing,setEditing]=useState(null);
  const [configuring,setConfiguring]=useState(null);
  const [sort,setSort]=useState(initialPreferences.sort||'company');
  const [showArchived,setShowArchived]=useState(!!initialPreferences.showArchived);
  useEffect(()=>{ save(preferencesStorageKey,{sort,showArchived}); },[preferencesStorageKey,sort,showArchived]);
  const clients=users.filter(u=>u.role==='client' && (showArchived ? u.active===false : u.active!==false));
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
  async function excludeClient(u){
    if(!confirm(`Excluir permanentemente o responsável "${u.name}"? Isso deve remover o cadastro do painel e o acesso no Supabase Auth.`)) return;
    try{
      if(isSupabaseConfigured) await deleteManagedAppUser(u);
      setUsers(users.filter(x=>x.id!==u.id));
      setEditing(null);
    }catch(err){
      console.error(err);
      alert('Não foi possível excluir o acesso no Supabase Auth. Instale/atualize a Edge Function manage-app-user e tente novamente. Erro: '+(err.message||err));
    }
  }
  async function saveClient(u){
    const exists=users.some(x=>x.id===u.id);
    try{
      let data={...u,role:'client',createdAt:u.createdAt||now(),visibleStatuses:u.visibleStatuses||CLIENT_DEFAULT,active:u.active!==false};
      if(isSupabaseConfigured && !exists){
        data=await createManagedAppUser(data);
      } else {
        data={...data,id:data.id||safeUUID()};
        if(isSupabaseConfigured && exists) data=await updateAuthBackedAppUserProfile(data);
      }
      setUsers(exists?users.map(x=>x.id===data.id?data:x):[...users,data]);
      setEditing(null);
      notifySettingsSaved('Responsável salvo');
    }catch(err){
      console.error(err);
      alert('Não foi possível criar o acesso deste responsável: '+(err.message||err));
    }
  }
  async function resetPassword(u){
    const password=prompt(`Nova senha para ${u.name}:`);
    if(password===null) return;
    try{
      await resetManagedAppUserPassword(u,password);
      alert('Senha atualizada no Supabase Auth.');
    }catch(err){
      console.error(err);
      alert('Não foi possível redefinir a senha. Instale/atualize a Edge Function manage-app-user. Erro: '+(err.message||err));
    }
  }
  async function repairAccess(u){
    try{
      const data=await repairExistingUserAuthAccess({...u,role:'client'});
      const fixed={...u,...data,id:u.id||data.id,role:'client',active:u.active!==false};
      setUsers(users.map(x=>x.id===u.id?fixed:x));
      setEditing(null);
      alert('Acesso criado/reparado. Teste o login com o e-mail e senha preenchidos.');
    }catch(err){
      console.error(err);
      const msg=String(err?.message||err||'Não foi possível reparar o acesso.');
      alert(msg.includes('already')||msg.includes('exist')||msg.includes('registered')?'Esse e-mail já existe no Supabase Auth. Nesse caso, faça reset de senha no Supabase Auth ou recrie o usuário no Auth.':msg);
    }
  }
  async function saveClientSettings(nextUser){
    if(isSupabaseConfigured && nextUser?.accessInheritance?.statuses==='custom'){
      await updateAuthBackedAppUserProfile(nextUser);
    }
    setUsers(prev=>prev.map(x=>x.id===nextUser.id?nextUser:x));
    setConfiguring(null);
    notifySettingsSaved('Configurações do responsável salvas');
  }
  return <div className="settings-section"><div className="section-header section-header-actions-only"><div className="settings-toolbar"><label className="toggle-archived"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Mostrar só arquivados</label><SortControl value={sort} setValue={setSort} options={[{value:'company',label:'Empresa'},{value:'name',label:'Nome'},{value:'created',label:'Data de criação'}]}/><button className="primary" onClick={()=>setEditing({role:'client',name:'',email:'',password:'123456',active:true,avatar:'',companyIds:[],visibleStatuses:CLIENT_DEFAULT,createdAt:now()})}>+ Novo responsável</button></div></div><div className="client-grid compact-admin-grid" style={{display:'flex',flexDirection:'column',gap:12}}>{sortedClients.map(u=><div className={'panel '+(u.active===false?'archived-card':'')} key={u.id}><div className="mini-title"><AvatarMini value={u.avatar} label={u.name}/><div><h2 title={userHasCustomAccess(u)?`Acesso personalizado: ${userCustomAccessLabels(u).join(', ')}`:undefined}>{userHasCustomAccess(u)&&<span className="item-custom-dot" style={{marginRight:6}}/>}{u.name}</h2><small className="linked-companies">{(u.companyIds||[]).map(id=>companies.find(c=>c.id===id)?.name).filter(Boolean).join(', ') || 'Sem empresa'} {u.active===false?'• Arquivado':''}</small></div></div><div className="row-actions"><button onClick={()=>setEditing(u)}>Editar</button><button onClick={()=>setConfiguring(u)}>Configurações</button></div></div>)}</div>{editing&&<UserEditor u={editing} save={saveClient} cancel={()=>setEditing(null)} clientMode currentUser={currentUser} onArchive={archiveClient} onDelete={excludeClient} onResetPassword={resetPassword}/>} {configuring&&<UserSystemSettings user={configuring} companies={companies} statuses={statuses} save={saveClientSettings} cancel={()=>setConfiguring(null)} currentUser={currentUser} accessDefaults={accessDefaults}/>}</div>
}
function TeamPage({users,setUsers,statuses,tasks=[],currentUser=null,accessDefaults=null}){
  const preferencesStorageKey=`argos_settings_team_preferences_${currentUser?.id||'admin'}`;
  const initialPreferences=load(preferencesStorageKey,{sort:'role',showArchived:false});
  const [editing,setEditing]=useState(null);
  const [sort,setSort]=useState(initialPreferences.sort||'role');
  const [showArchived,setShowArchived]=useState(!!initialPreferences.showArchived);
  useEffect(()=>{ save(preferencesStorageKey,{sort,showArchived}); },[preferencesStorageKey,sort,showArchived]);
  const [configuring,setConfiguring]=useState(null);
  const people=users.filter(u=>(u.role==='team'||u.role==='admin') && (showArchived ? u.active===false : u.active!==false));
  const sortedPeople=sortEntities(people,sort,u=>u.name);
  const events=NOTIFICATION_VISIBLE_EVENTS;
  async function archiveTeamUser(u){
    if(u.id===currentUser?.id) return alert('Você não pode arquivar seu próprio usuário.');
    const nextActive = u.active===false;
    if(!nextActive && !confirm(`Arquivar o usuário "${u.name}"?`)) return;
    const next={...u,active:nextActive};
    try{ if(isSupabaseConfigured) await updateAuthBackedAppUserProfile(next); }catch(err){ console.warn(err); }
    setUsers(users.map(x=>x.id===u.id?next:x));
    setEditing(null);
  }
  async function excludeTeamUser(u){
    if(u.id===currentUser?.id) return alert('Você não pode excluir o próprio usuário logado.');
    if(!confirm(`Excluir permanentemente o usuário "${u.name}"? Isso deve remover o cadastro do painel e o acesso no Supabase Auth.`)) return;
    try{
      if(isSupabaseConfigured) await deleteManagedAppUser(u);
      setUsers(users.filter(x=>x.id!==u.id));
      setEditing(null);
    }catch(err){
      console.error(err);
      alert('Não foi possível excluir o acesso no Supabase Auth. Instale/atualize a Edge Function manage-app-user e tente novamente. Erro: '+(err.message||err));
    }
  }
  async function saveTeamUser(u){
    const role=u.role||'team';
    const exists=users.some(x=>x.id===u.id);
    try{
      let data={...u,role,createdAt:u.createdAt||now(),visibleStatuses:role==='admin'?[]:(u.visibleStatuses||TEAM_DEFAULT),active:u.active!==false};
      if(isSupabaseConfigured && !exists){
        data=await createManagedAppUser(data);
      } else {
        data={...data,id:data.id||safeUUID()};
        if(isSupabaseConfigured && exists) data=await updateAuthBackedAppUserProfile(data);
      }
      setUsers(exists?users.map(x=>x.id===data.id?data:x):[...users,data]);
      setEditing(null);
      notifySettingsSaved('Usuário salvo');
    }catch(err){
      console.error(err);
      alert('Não foi possível criar o acesso deste usuário: '+(err.message||err));
    }
  }
  async function resetPassword(u){
    const password=prompt(`Nova senha para ${u.name}:`);
    if(password===null) return;
    try{
      await resetManagedAppUserPassword(u,password);
      alert('Senha atualizada no Supabase Auth.');
    }catch(err){
      console.error(err);
      alert('Não foi possível redefinir a senha. Instale/atualize a Edge Function manage-app-user. Erro: '+(err.message||err));
    }
  }
  async function repairAccess(u){
    try{
      const role=u.role||'team';
      const data=await repairExistingUserAuthAccess({...u,role});
      const fixed={...u,...data,id:u.id||data.id,role,active:u.active!==false};
      setUsers(users.map(x=>x.id===u.id?fixed:x));
      setEditing(null);
      alert('Acesso criado/reparado. Teste o login com o e-mail e senha preenchidos.');
    }catch(err){
      console.error(err);
      const msg=String(err?.message||err||'Não foi possível reparar o acesso.');
      alert(msg.includes('already')||msg.includes('exist')||msg.includes('registered')?'Esse e-mail já existe no Supabase Auth. Nesse caso, faça reset de senha no Supabase Auth ou recrie o usuário no Auth.':msg);
    }
  }
  async function saveTeamSettings(nextUser){
    try{
      if(isSupabaseConfigured){
        await updateProfileNotificationPrefs(nextUser.id, {
          notificationPrefs: nextUser.notificationPrefs || events,
          notificationStatusPrefs: nextUser.notificationStatusPrefs || {}
        });
      }
      if(nextUser?.accessInheritance?.statuses==='custom') await updateAuthBackedAppUserProfile(nextUser);
      setUsers(prev=>prev.map(x=>x.id===nextUser.id?nextUser:x));
      setConfiguring(null);
      notifySettingsSaved('Configurações do usuário salvas');
    }catch(err){
      alert('Não foi possível salvar notificações no perfil: '+(err.message||err));
    }
  }
  return <div className="settings-section"><div className="section-header section-header-actions-only"><div className="settings-toolbar"><label className="toggle-archived"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Mostrar só arquivados</label><SortControl value={sort} setValue={setSort} options={[{value:'role',label:'Tipo de usuário'},{value:'name',label:'Nome'},{value:'created',label:'Data de criação'}]}/><button className="primary" onClick={()=>setEditing({role:'team',name:'',email:'',password:'123456',active:true,avatar:'',title:'',visibleStatuses:TEAM_DEFAULT,createdAt:now()})}>+ Novo usuário</button></div></div><div className="client-grid compact-admin-grid" style={{display:'flex',flexDirection:'column',gap:12}}>{sortedPeople.map(u=><div className={'panel team-user-panel '+(u.active===false?'archived-card':'')} key={u.id}>
      <div className="mini-title"><AvatarMini value={u.avatar} label={u.name}/><div><h2 title={userHasCustomAccess(u)?`Acesso personalizado: ${userCustomAccessLabels(u).join(', ')}`:undefined}>{userHasCustomAccess(u)&&<span className="item-custom-dot" style={{marginRight:6}}/>}{u.name}</h2><small>{u.role==='admin'?'Admin':(u.title||'Equipe')} {u.active===false?'• Arquivado':''}</small></div></div>
      <div className="row-actions"><button onClick={()=>setEditing(u)}>Editar</button><button onClick={()=>setConfiguring(u)}>Configurações</button></div>
    </div>)}</div>{editing&&<UserEditor u={editing} save={saveTeamUser} cancel={()=>setEditing(null)} currentUser={currentUser} onArchive={archiveTeamUser} onDelete={excludeTeamUser} onResetPassword={resetPassword}/>} {configuring&&<UserSystemSettings user={configuring} companies={[]} statuses={statuses} save={saveTeamSettings} cancel={()=>setConfiguring(null)} currentUser={currentUser} accessDefaults={accessDefaults}/>}</div>
}
function CompanyEditor({c,users=[],save,cancel,onArchive,onDelete}){
  const [f,setF]=useState(c);
  const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
  const isExisting=!!f.id;
  return <div className="modal-bg"><div className="modal"><ModalDismiss onClose={cancel}/><h2>Empresa</h2><label>Nome<input value={f.name||''} onChange={e=>set('name',e.target.value)}/></label><label>Instagram<input value={f.instagram} onChange={e=>set('instagram',e.target.value)}/></label><label>Logo ou link de imagem<input value={f.logo} onChange={e=>set('logo',e.target.value)} placeholder="Inicial, URL pública ou link do Drive"/><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,v=>set('logo',v),`companies/${f.id||slug(f.name)||'pending'}`)}/></label><label>Entrada<input type="date" value={f.entryDate||''} onChange={e=>set('entryDate',e.target.value)}/></label>{isExisting&&<div className="danger-zone"><h3>Zona de risco</h3><p>Use arquivar para esconder sem perder histórico. Excluir remove o cadastro do painel.</p><div className="danger-zone-actions"><button onClick={()=>onArchive?.(f)}>{f.active===false?'Restaurar empresa':'Arquivar empresa'}</button><button className="danger-button" onClick={()=>onDelete?.(f)}>Excluir empresa</button></div></div>}<div className="modal-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={async()=>await save(f)}>Salvar</button></div></div></div>
}

function AccessConfigCard({title,active=null,disabled=false,open=false,onToggleActive=null,onToggleOpen=null,children,accent=false,customized=false}){
  const hasToggle=typeof active==='boolean';
  return <div className="panel" style={{padding:0,overflow:'hidden',borderColor:open?'rgba(var(--accent-rgb),.48)':'var(--line)'}}>
    <div
      role="button"
      tabIndex={0}
      onClick={()=>onToggleOpen?.()}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onToggleOpen?.();}}}
      style={{display:'flex',alignItems:'center',gap:10,minHeight:52,padding:'0 14px',cursor:'pointer',background:open?'rgba(var(--accent-rgb),.045)':'transparent'}}
    >
      {hasToggle&&<input
        type="checkbox"
        checked={active}
        disabled={disabled}
        onClick={e=>e.stopPropagation()}
        onChange={e=>onToggleActive?.(e.target.checked)}
        style={{width:16,height:16,minWidth:16,margin:0}}
      />}
      <span className="status-dot" style={{background:customized?'var(--gold)':'transparent'}}></span>
      <b style={{flex:1,color:customized?'var(--text)':'var(--muted)',fontSize:14,opacity:customized?1:.72}}>{title}</b>
      <span aria-hidden="true" style={{fontSize:18,color:open?'var(--gold)':'var(--muted)',transform:open?'rotate(90deg)':'none',transition:'transform .16s ease'}}>›</span>
    </div>
    {open&&<div style={{padding:'14px',borderTop:'1px solid var(--line)'}}>{children}</div>}
  </div>;
}

function TaskOpenPermissionList({config,onTogglePermission,onToggleApproval,disabled=false}){
  const nonEditable=['preview','stats','history'];
  const mainTextStyle={
    display:'block',
    flex:1,
    textAlign:'left',
    fontSize:12,
    lineHeight:1.35,
    color:'var(--muted)'
  };
  const editTextStyle={
    display:'block',
    flex:1,
    textAlign:'left',
    fontSize:11,
    lineHeight:1.3,
    color:'var(--muted)'
  };

  return <div style={{display:'block',width:'100%',textAlign:'left'}}>
    {TASK_DETAIL_FIELDS.map(field=>{
      const visible=config?.visible?.[field.id]!==false;
      const editable=config?.editable?.[field.id]===true;
      const supportsEdit=!nonEditable.includes(field.id);

      return <div key={field.id} style={{width:'100%',borderBottom:'1px solid rgba(255,255,255,.08)',padding:'8px 4px',boxSizing:'border-box',textAlign:'left'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-start',width:'100%',gap:8,textAlign:'left'}}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={visible}
            onChange={e=>onTogglePermission('visible',field.id,e.target.checked)}
            style={{width:14,height:14,minWidth:14,margin:0,flex:'0 0 auto'}}
          />
          <span style={mainTextStyle}>{field.label}</span>
        </div>

        {visible&&supportsEdit&&<div style={{display:'flex',alignItems:'center',justifyContent:'flex-start',width:'100%',gap:8,marginTop:6,paddingLeft:22,textAlign:'left',boxSizing:'border-box'}}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={editable}
            onChange={e=>onTogglePermission('editable',field.id,e.target.checked)}
            style={{width:13,height:13,minWidth:13,margin:0,flex:'0 0 auto'}}
          />
          <span style={editTextStyle}>Permitir edição</span>
        </div>}
      </div>;
    })}

    <div style={{display:'flex',alignItems:'center',justifyContent:'flex-start',width:'100%',gap:8,padding:'8px 4px',textAlign:'left',boxSizing:'border-box'}}>
      <input
        type="checkbox"
        disabled={disabled}
        checked={config?.canApprovePosts===true}
        onChange={e=>onToggleApproval(e.target.checked)}
        style={{width:14,height:14,minWidth:14,margin:0,flex:'0 0 auto'}}
      />
      <span style={mainTextStyle}>Aprovar posts ou solicitar alterações</span>
    </div>
  </div>;
}

function UserSystemSettings({user,companies=[],statuses=[],save,cancel,currentUser=null,accessDefaults=null}){
  const [f,setF]=useState(()=>clonePayload(user));
  const [openSection,setOpenSection]=useState(null);
  const events=NOTIFICATION_VISIBLE_EVENTS;
  function deepPermEqual(a,b){
    if(a===b) return true;
    if(Array.isArray(a)||Array.isArray(b)){
      const as=Array.isArray(a)?[...a].sort():[];
      const bs=Array.isArray(b)?[...b].sort():[];
      if(as.length!==bs.length) return false;
      return as.every((v,i)=>v===bs[i]);
    }
    if(a&&b&&typeof a==='object'&&typeof b==='object'){
      const keys=new Set([...Object.keys(a),...Object.keys(b)]);
      for(const k of keys){ if(!deepPermEqual(a[k],b[k])) return false; }
      return true;
    }
    return a===b;
  }
  const editingOtherAdmin=f.role==='admin' && currentUser?.id && f.id!==currentUser.id;
  const masterCustom=userHasCustomAccess(f);
  const panelPermissionMode=masterCustom?'custom':'default';
  const roleDefault=accessDefaultForRole({accessDefaults},f.role);
  const defaultIds=PANEL_CATALOG.filter(panel=>roleDefault.panels.visible?.[panel.id]===true).map(panel=>panel.id);
  const statusInheritance=masterCustom?'custom':'default';
  const typeInheritance=masterCustom?'custom':'default';
  const notificationInheritance=masterCustom?'custom':'default';
  const dashboardInheritance=masterCustom?'custom':'default';
  const actionsInheritance=masterCustom?'custom':'default';
  const taskDetailInheritance=masterCustom?'custom':'default';
  const kanbanInheritance=masterCustom?'custom':'default';
  const calendarInheritance=masterCustom?'custom':'default';
  const portfolioInheritance=masterCustom?'custom':'default';
  const planningInheritance=masterCustom?'custom':'default';
  const documentsInheritance=masterCustom?'custom':'default';
  const tasksListInheritance=masterCustom?'custom':'default';
  const customVisible=f.panelPermissions?.visible&&typeof f.panelPermissions.visible==='object'
    ? f.panelPermissions.visible
    : Object.fromEntries(PANEL_CATALOG.map(panel=>[panel.id,defaultIds.includes(panel.id)]));
  const resolvedVisible=panelPermissionMode==='custom'
    ? customVisible
    : Object.fromEntries(PANEL_CATALOG.map(panel=>[panel.id,defaultIds.includes(panel.id)]));
  const set=(key,value)=>setF(prev=>({...prev,[key]:value}));
  function setInheritance(section,mode){
    setF(prev=>({
      ...prev,
      accessInheritance:{...(prev.accessInheritance||{}),[section]:mode},
      ...(section==='statuses'&&mode==='custom'?{visibleStatuses:[...(roleDefault.visibleStatuses||[])]}:{}),
      ...(section==='types'&&mode==='custom'?{visibleTypes:[...(roleDefault.visibleTypes||TASK_TYPES)]}:{}),
      ...(section==='notifications'&&mode==='custom'?{
        notificationPrefs:[...(roleDefault.notificationPrefs||[])],
        notificationStatusPrefs:{...(roleDefault.notificationStatusPrefs||{})}
      }:{}),
      ...(section==='dashboard'&&mode==='custom'?{
        dashboardPermissions:{visible:{...(roleDefault.dashboard?.visible||fullDashboardVisibility())}}
      }:{}),
      ...(section==='actions'&&mode==='custom'?{
        taskPermissions:{
          ...(prev.taskPermissions||{}),
          canCreate:roleDefault.tasks?.canCreate===true,
          creationMode:roleDefault.tasks?.creationMode||'task',
          createFields:{...(roleDefault.tasks?.createFields||{})},
        }
      }:{}),
      ...(section==='taskDetail'&&mode==='custom'?{
        taskPermissions:{
          ...(prev.taskPermissions||{}),
          canApprovePosts:roleDefault.tasks?.canApprovePosts===true,
          detailFields:{
            visible:{...(roleDefault.tasks?.detailFields?.visible||{})},
            editable:{...(roleDefault.tasks?.detailFields?.editable||{})},
          }
        }
      }:{}),
      ...(section==='kanban'&&mode==='custom'?{
        kanbanPermissions:{...(roleDefault.kanban||builtInKanbanPermissionsForRole(f.role))}
      }:{}),
      ...(section==='calendar'&&mode==='custom'?{
        calendarPermissions:{...(roleDefault.calendar||builtInCalendarPermissionsForRole(f.role))}
      }:{}),
      ...(section==='portfolio'&&mode==='custom'?{
        portfolioPermissions:{...(roleDefault.portfolio||builtInPortfolioPermissionsForRole(f.role))}
      }:{}),
      ...(section==='planning'&&mode==='custom'?{
        planningPermissions:{...(roleDefault.planning||builtInPlanningPermissionsForRole(f.role))}
      }:{}),
      ...(section==='documents'&&mode==='custom'?{
        documentPermissions:{...(roleDefault.documents||builtInDocumentPermissionsForRole(f.role))}
      }:{}),
      ...(section==='tasksList'&&mode==='custom'?{
        tasksListPermissions:{...(roleDefault.tasksList||builtInTasksListPermissionsForRole(f.role))}
      }:{})
    }));
  }
  function setMode(mode){
    set('panelPermissions',mode==='default'?{mode:'default'}:{mode:'custom',visible:{...resolvedVisible},order:Array.isArray(f.panelPermissions?.order)?f.panelPermissions.order:[]});
  }
  function setCustomAccessMode(enabled){
    if(!enabled){
      setF(prev=>({...prev,accessInheritance:{},panelPermissions:{mode:'default'}}));
      return;
    }
    setF(prev=>({
      ...prev,
      accessInheritance:{statuses:'custom',types:'custom',notifications:'custom',dashboard:'custom',actions:'custom',taskDetail:'custom',kanban:'custom',calendar:'custom',portfolio:'custom',planning:'custom',documents:'custom',tasksList:'custom'},
      visibleStatuses:[...(roleDefault.visibleStatuses||[])],
      visibleTypes:[...(roleDefault.visibleTypes||TASK_TYPES)],
      notificationPrefs:[...(roleDefault.notificationPrefs||[])],
      notificationStatusPrefs:{...(roleDefault.notificationStatusPrefs||{})},
      notificationPanelPermissions:{...(roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(prev.role))},
      dashboardPermissions:{visible:{...(roleDefault.dashboard?.visible||fullDashboardVisibility())}},
      taskPermissions:{
        ...(prev.taskPermissions||{}),
        canCreate:roleDefault.tasks?.canCreate===true,
        creationMode:roleDefault.tasks?.creationMode||'task',
        createFields:{...(roleDefault.tasks?.createFields||{})},
        canApprovePosts:roleDefault.tasks?.canApprovePosts===true,
        detailFields:{
          visible:{...(roleDefault.tasks?.detailFields?.visible||{})},
          editable:{...(roleDefault.tasks?.detailFields?.editable||{})},
        }
      },
      kanbanPermissions:{...(roleDefault.kanban||builtInKanbanPermissionsForRole(prev.role))},
      calendarPermissions:{...(roleDefault.calendar||builtInCalendarPermissionsForRole(prev.role))},
      portfolioPermissions:{...(roleDefault.portfolio||builtInPortfolioPermissionsForRole(prev.role))},
      planningPermissions:{...(roleDefault.planning||builtInPlanningPermissionsForRole(prev.role))},
      documentPermissions:{...(roleDefault.documents||builtInDocumentPermissionsForRole(prev.role))},
      tasksListPermissions:{...(roleDefault.tasksList||builtInTasksListPermissionsForRole(prev.role))},
      panelPermissions:{mode:'custom',visible:{...resolvedVisible},order:Array.isArray(prev.panelPermissions?.order)?prev.panelPermissions.order:[]},
    }));
  }
  function togglePanel(id,checked){
    if(editingOtherAdmin) return;
    if(f.role==='admin'&&id==='settings'&&!checked) return alert('Configurações precisa permanecer visível para o próprio administrador.');
    const current={...resolvedVisible};
    const next=id==='tasks'?{...current,kanban:checked,calendar:checked,tasks:checked}:{...current,[id]:checked};
    if(!Object.values(next).some(Boolean)) return alert('O usuário precisa ter pelo menos um painel visível.');
    set('panelPermissions',{mode:'custom',visible:next,order:Array.isArray(f.panelPermissions?.order)?f.panelPermissions.order:[]});
    if(!checked&&openSection===`panel:${id}`) setOpenSection(null);
  }
  function toggleTaskViewVisibility(id,checked){
    if(editingOtherAdmin) return;
    const current={...resolvedVisible};
    const next={...current,[id]:checked};
    if(!Object.values(next).some(Boolean)) return alert('O usuário precisa ter pelo menos um painel visível.');
    set('panelPermissions',{mode:'custom',visible:next,order:Array.isArray(f.panelPermissions?.order)?f.panelPermissions.order:[]});
  }
  function toggleStatus(id,checked){
    const current=statusInheritance==='custom'?(f.visibleStatuses||[]):(roleDefault.visibleStatuses||[]);
    set('visibleStatuses',checked?[...new Set([...current,id])]:current.filter(x=>x!==id));
  }
  function toggleType(type,checked){
    const current=typeInheritance==='custom'?(f.visibleTypes||[]):(roleDefault.visibleTypes||TASK_TYPES);
    set('visibleTypes',checked?[...new Set([...current,type])]:current.filter(x=>x!==type));
  }
  function toggleEvent(ev,checked){
    const current=notificationInheritance==='custom'?(f.notificationPrefs||[]):(roleDefault.notificationPrefs||events);
    set('notificationPrefs',checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev));
  }
  const notificationPanelConfig=notificationInheritance==='custom'
    ? {...(roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role)),...(f.notificationPanelPermissions||{})}
    : (roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role));
  function toggleNotificationPanelPermission(id,checked){
    const current=notificationInheritance==='custom'?{...(f.notificationPanelPermissions||{})}:{...(roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role))};
    set('notificationPanelPermissions',{...current,[id]:checked});
  }
  function toggleDashboardWidget(id,checked){
    const current=dashboardInheritance==='custom'
      ? {...(f.dashboardPermissions?.visible||{})}
      : {...(roleDefault.dashboard?.visible||fullDashboardVisibility())};
    set('dashboardPermissions',{visible:{...current,[id]:checked}});
  }
  function setTaskPermission(key,value){
    const current=actionsInheritance==='custom'?{...(f.taskPermissions||{})}:{...(roleDefault.tasks||{})};
    set('taskPermissions',{...(f.taskPermissions||{}),...current,[key]:value,createFields:{...(current.createFields||{})},detailFields:{...(f.taskPermissions?.detailFields||current.detailFields||{})}});
  }
  function toggleCreateField(id,checked){
    const current=actionsInheritance==='custom'?{...(f.taskPermissions||{})}:{...(roleDefault.tasks||{})};
    set('taskPermissions',{...(f.taskPermissions||{}),...current,createFields:{...(current.createFields||{}),[id]:checked},detailFields:{...(f.taskPermissions?.detailFields||current.detailFields||{})}});
  }
  function toggleTaskDetailPermission(section,id,checked){
    const current=taskDetailInheritance==='custom'?{...(f.taskPermissions||{})}:{...(roleDefault.tasks||{})};
    const detail=current.detailFields||roleDefault.tasks?.detailFields||builtInTaskDetailPermissionsForRole(f.role);
    const nextDetail={
      visible:{...(detail.visible||{})},
      editable:{...(detail.editable||{})},
    };
    nextDetail[section][id]=checked;
    if(section==='visible'&&!checked) nextDetail.editable[id]=false;
    if(section==='editable'&&checked) nextDetail.visible[id]=true;
    set('taskPermissions',{...(f.taskPermissions||{}),...current,createFields:{...(f.taskPermissions?.createFields||current.createFields||{})},detailFields:nextDetail});
  }
  function setTaskDetailAction(key,value){
    const current=taskDetailInheritance==='custom'?{...(f.taskPermissions||{})}:{...(roleDefault.tasks||{})};
    set('taskPermissions',{
      ...(f.taskPermissions||{}),
      ...current,
      [key]:value,
      createFields:{...(f.taskPermissions?.createFields||current.createFields||{})},
      detailFields:{
        visible:{...(current.detailFields?.visible||{})},
        editable:{...(current.detailFields?.editable||{})},
      }
    });
  }

  const actionConfig=actionsInheritance==='custom'
    ? {...roleDefault.tasks,...(f.taskPermissions||{}),createFields:{...(roleDefault.tasks?.createFields||{}),...(f.taskPermissions?.createFields||{})}}
    : roleDefault.tasks;
  const taskDetailConfig=taskDetailInheritance==='custom'
    ? {
        canApprovePosts:f.taskPermissions?.canApprovePosts??roleDefault.tasks?.canApprovePosts,
        visible:{...(roleDefault.tasks?.detailFields?.visible||{}),...(f.taskPermissions?.detailFields?.visible||{})},
        editable:{...(roleDefault.tasks?.detailFields?.editable||{}),...(f.taskPermissions?.detailFields?.editable||{})},
      }
    : {
        canApprovePosts:roleDefault.tasks?.canApprovePosts===true,
        visible:roleDefault.tasks?.detailFields?.visible||{},
        editable:roleDefault.tasks?.detailFields?.editable||{},
      };
  const kanbanConfig=kanbanInheritance==='custom'
    ? {...(roleDefault.kanban||builtInKanbanPermissionsForRole(f.role)),...(f.kanbanPermissions||{})}
    : (roleDefault.kanban||builtInKanbanPermissionsForRole(f.role));
  const calendarConfig=calendarInheritance==='custom'
    ? {...(roleDefault.calendar||builtInCalendarPermissionsForRole(f.role)),...(f.calendarPermissions||{})}
    : (roleDefault.calendar||builtInCalendarPermissionsForRole(f.role));
  const portfolioConfig=portfolioInheritance==='custom'
    ? {...(roleDefault.portfolio||builtInPortfolioPermissionsForRole(f.role)),...(f.portfolioPermissions||{})}
    : (roleDefault.portfolio||builtInPortfolioPermissionsForRole(f.role));
  const planningConfig=planningInheritance==='custom'
    ? {...(roleDefault.planning||builtInPlanningPermissionsForRole(f.role)),...(f.planningPermissions||{})}
    : (roleDefault.planning||builtInPlanningPermissionsForRole(f.role));
  const documentsConfig=documentsInheritance==='custom'
    ? {...(roleDefault.documents||builtInDocumentPermissionsForRole(f.role)),...(f.documentPermissions||{})}
    : (roleDefault.documents||builtInDocumentPermissionsForRole(f.role));
  const tasksListConfig=tasksListInheritance==='custom'
    ? {...(roleDefault.tasksList||builtInTasksListPermissionsForRole(f.role)),...(f.tasksListPermissions||{})}
    : (roleDefault.tasksList||builtInTasksListPermissionsForRole(f.role));

  // Diferença de verdade contra o padrão da função — "Personalizar" ligado
  // não significa que algo foi realmente alterado, então comparamos valor
  // a valor em vez de olhar só o modo.
  const statusesDiff=!deepPermEqual(f.visibleStatuses||[], roleDefault.visibleStatuses||[]);
  const typesDiff=!deepPermEqual(f.visibleTypes||TASK_TYPES, roleDefault.visibleTypes||TASK_TYPES);
  const notificationsDiff=!deepPermEqual(notificationPanelConfig, roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role))
    || !deepPermEqual(f.notificationPrefs||[], roleDefault.notificationPrefs||[])
    || !deepPermEqual(f.notificationStatusPrefs||{}, roleDefault.notificationStatusPrefs||{});
  const dashboardResolvedVisible=dashboardInheritance==='custom'?(f.dashboardPermissions?.visible||{}):(roleDefault.dashboard?.visible||fullDashboardVisibility());
  const dashboardDiff=!deepPermEqual(dashboardResolvedVisible, roleDefault.dashboard?.visible||fullDashboardVisibility());
  const actionsDiff=!deepPermEqual(
    {canCreate:actionConfig?.canCreate,creationMode:actionConfig?.creationMode,createFields:actionConfig?.createFields||{}},
    {canCreate:roleDefault.tasks?.canCreate,creationMode:roleDefault.tasks?.creationMode,createFields:roleDefault.tasks?.createFields||{}}
  );
  const taskDetailDiff=!deepPermEqual(taskDetailConfig, {
    canApprovePosts:roleDefault.tasks?.canApprovePosts===true,
    visible:roleDefault.tasks?.detailFields?.visible||{},
    editable:roleDefault.tasks?.detailFields?.editable||{},
  });
  const kanbanDiff=!deepPermEqual(kanbanConfig, roleDefault.kanban||builtInKanbanPermissionsForRole(f.role));
  const calendarDiff=!deepPermEqual(calendarConfig, roleDefault.calendar||builtInCalendarPermissionsForRole(f.role));
  const portfolioDiff=!deepPermEqual(portfolioConfig, roleDefault.portfolio||builtInPortfolioPermissionsForRole(f.role));
  const planningDiff=!deepPermEqual(planningConfig, roleDefault.planning||builtInPlanningPermissionsForRole(f.role));
  const documentsDiff=!deepPermEqual(documentsConfig, roleDefault.documents||builtInDocumentPermissionsForRole(f.role));
  const tasksListDiff=!deepPermEqual(tasksListConfig, roleDefault.tasksList||builtInTasksListPermissionsForRole(f.role));
  const panelsVisibleDiff=!deepPermEqual(resolvedVisible, Object.fromEntries(PANEL_CATALOG.map(panel=>[panel.id,defaultIds.includes(panel.id)])));
  function toggleKanbanPermission(id,checked){
    const current=kanbanInheritance==='custom'?{...(f.kanbanPermissions||{})}:{...(roleDefault.kanban||builtInKanbanPermissionsForRole(f.role))};
    set('kanbanPermissions',{...current,[id]:checked});
  }
  function toggleCalendarPermission(id,checked){
    const current=calendarInheritance==='custom'?{...(f.calendarPermissions||{})}:{...(roleDefault.calendar||builtInCalendarPermissionsForRole(f.role))};
    set('calendarPermissions',{...current,[id]:checked});
  }
  function togglePortfolioPermission(id,checked){
    const current=portfolioInheritance==='custom'?{...(f.portfolioPermissions||{})}:{...(roleDefault.portfolio||builtInPortfolioPermissionsForRole(f.role))};
    set('portfolioPermissions',{...current,[id]:checked});
  }
  function togglePlanningPermission(id,checked){
    const current=planningInheritance==='custom'?{...(f.planningPermissions||{})}:{...(roleDefault.planning||builtInPlanningPermissionsForRole(f.role))};
    set('planningPermissions',{...current,[id]:checked});
  }
  function toggleDocumentPermission(id,checked){
    const current=documentsInheritance==='custom'?{...(f.documentPermissions||{})}:{...(roleDefault.documents||builtInDocumentPermissionsForRole(f.role))};
    set('documentPermissions',{...current,[id]:checked});
  }
  function toggleTasksListPermission(id,checked){
    const current=tasksListInheritance==='custom'?{...(f.tasksListPermissions||{})}:{...(roleDefault.tasksList||builtInTasksListPermissionsForRole(f.role))};
    set('tasksListPermissions',{...current,[id]:checked});
  }

  function panelDetails(panel){
    if(panel.id==='notifications') return <div>
      <div style={notificationInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
        <h3 style={{display:'flex',alignItems:'center',gap:7}}>{notificationsDiff&&<span className="item-custom-dot"/>}<span style={{opacity:notificationsDiff?1:.62}}>Painel e ações</span></h3>
        <div className="checks one-col compact-checks-v3">{NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=>{const def=(roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role))?.[item.id];const itemDiff=notificationPanelConfig?.[item.id]!==def;return <label key={item.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={notificationPanelConfig?.[item.id]===true} onChange={e=>toggleNotificationPanelPermission(item.id,e.target.checked)}/>{item.label}</label>;})}</div>
        <div className="notification-prefs-grid" style={{marginTop:18}}>
          <div><h3>Eventos que geram notificação</h3><div className="checks one-col compact-checks-v3">{events.map(ev=>{const itemDiff=(roleDefault.notificationPrefs||[]).includes(ev)!==(f.notificationPrefs||[]).includes(ev);return <label key={ev} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={(f.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>;})}</div></div>
          <div><h3>Status que geram notificação</h3><div className="checks one-col status-notify-list compact-checks-v3">{statuses.map(st=>{const itemDiff=(roleDefault.notificationStatusPrefs?.[st.id]??true)!==(f.notificationStatusPrefs?.[st.id]??true);return <label key={st.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={f.notificationStatusPrefs?.[st.id]??true} onChange={e=>set('notificationStatusPrefs',{...(f.notificationStatusPrefs||{}),[st.id]:e.target.checked})}/><span className="status-dot" style={{background:st.color}}></span>{st.name}</label>;})}</div></div>
        </div>
      </div>
    </div>;
    if(panel.id==='dashboard') return <div>
      <div className="checks one-col compact-checks-v3" style={dashboardInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
        {DASHBOARD_WIDGETS.filter(item=>f.role==='admin'||!item.adminOnly).map(item=>{
          const val=dashboardInheritance==='custom'?(f.dashboardPermissions?.visible?.[item.id]??true):(roleDefault.dashboard?.visible?.[item.id]??true);
          const defaultVal=roleDefault.dashboard?.visible?.[item.id]??true;
          const itemDiff=val!==defaultVal;
          return <label key={item.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={val} onChange={e=>toggleDashboardWidget(item.id,e.target.checked)}/>{item.label}</label>;
        })}
      </div>
    </div>;
    if(panel.id==='tasks') return <div className="access-tasks-groups">
      <h3>Visualizações disponíveis</h3>
      <div className="checks one-col compact-checks-v3 task-view-visibility-checks">
        <label><input type="checkbox" disabled={editingOtherAdmin||panelPermissionMode!=='custom'} checked={resolvedVisible.kanban===true} onChange={e=>toggleTaskViewVisibility('kanban',e.target.checked)}/>Exibir Kanban</label>
        <label><input type="checkbox" disabled={editingOtherAdmin||panelPermissionMode!=='custom'} checked={resolvedVisible.calendar===true} onChange={e=>toggleTaskViewVisibility('calendar',e.target.checked)}/>Exibir Calendário</label>
        <label><input type="checkbox" disabled={editingOtherAdmin||panelPermissionMode!=='custom'} checked={resolvedVisible.tasks===true} onChange={e=>toggleTaskViewVisibility('tasks',e.target.checked)}/>Exibir Listas</label>
      </div>
      {panelPermissionMode!=='custom'&&<small className="muted">Para alterar quais visualizações aparecem, ative "Este usuário usa acesso personalizado?" no topo da tela.</small>}
      <h3 style={{marginTop:18,display:'flex',alignItems:'center',gap:7}}>{kanbanDiff&&<span className="item-custom-dot"/>}<span style={{opacity:kanbanDiff?1:.62}}>Kanban</span></h3><div className="checks one-col compact-checks-v3" style={kanbanInheritance!=='custom'?{pointerEvents:'none'}:undefined}>{KANBAN_PERMISSION_ITEMS.map(item=>{const itemDiff=kanbanConfig?.[item.id]!==(roleDefault.kanban||builtInKanbanPermissionsForRole(f.role))?.[item.id];return <label key={`kanban:${item.id}`} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={kanbanConfig?.[item.id]===true} onChange={e=>toggleKanbanPermission(item.id,e.target.checked)}/>{item.label}</label>;})}</div>
      <h3 style={{marginTop:18,display:'flex',alignItems:'center',gap:7}}>{calendarDiff&&<span className="item-custom-dot"/>}<span style={{opacity:calendarDiff?1:.62}}>Calendário</span></h3><div className="checks one-col compact-checks-v3" style={calendarInheritance!=='custom'?{pointerEvents:'none'}:undefined}>{CALENDAR_PERMISSION_ITEMS.map(item=>{const itemDiff=calendarConfig?.[item.id]!==(roleDefault.calendar||builtInCalendarPermissionsForRole(f.role))?.[item.id];return <label key={`calendar:${item.id}`} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={calendarConfig?.[item.id]===true} onChange={e=>toggleCalendarPermission(item.id,e.target.checked)}/>{item.label}</label>;})}</div>
      <h3 style={{marginTop:18,display:'flex',alignItems:'center',gap:7}}>{tasksListDiff&&<span className="item-custom-dot"/>}<span style={{opacity:tasksListDiff?1:.62}}>Listas</span></h3><div className="checks one-col compact-checks-v3" style={tasksListInheritance!=='custom'?{pointerEvents:'none'}:undefined}>{TASKS_LIST_PERMISSION_ITEMS.map(item=>{const itemDiff=tasksListConfig?.[item.id]!==(roleDefault.tasksList||builtInTasksListPermissionsForRole(f.role))?.[item.id];return <label key={`lists:${item.id}`} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={tasksListConfig?.[item.id]===true} onChange={e=>toggleTasksListPermission(item.id,e.target.checked)}/>{item.label}</label>;})}</div>
    </div>;
    if(panel.id==='teamhub') return <div>
      <div className="checks one-col compact-checks-v3" style={portfolioInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
        {PORTFOLIO_PERMISSION_ITEMS.map(item=>{const itemDiff=portfolioConfig?.[item.id]!==(roleDefault.portfolio||builtInPortfolioPermissionsForRole(f.role))?.[item.id];return <label key={item.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={portfolioConfig?.[item.id]===true} onChange={e=>togglePortfolioPermission(item.id,e.target.checked)}/>{item.label}</label>;})}
      </div>
    </div>;
    if(panel.id==='planning') return <div>
      <div className="checks one-col compact-checks-v3" style={planningInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
        {PLANNING_PERMISSION_ITEMS.map(item=>{const itemDiff=planningConfig?.[item.id]!==(roleDefault.planning||builtInPlanningPermissionsForRole(f.role))?.[item.id];return <label key={item.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={planningConfig?.[item.id]===true} onChange={e=>togglePlanningPermission(item.id,e.target.checked)}/>{item.label}</label>;})}
      </div>
    </div>;
    if(panel.id==='documents') return <div>
      <div className="checks one-col compact-checks-v3" style={documentsInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
        {DOCUMENT_PERMISSION_ITEMS.map(item=>{const itemDiff=documentsConfig?.[item.id]!==(roleDefault.documents||builtInDocumentPermissionsForRole(f.role))?.[item.id];return <label key={item.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={documentsConfig?.[item.id]===true} onChange={e=>toggleDocumentPermission(item.id,e.target.checked)}/>{item.label}</label>;})}
      </div>
    </div>;
    if(panel.id==='settings') return <p className="muted">Configurações é uma área exclusiva de Admin e não pode ser liberada para outros perfis.</p>;
    return null;
  }
  const toggleSection=id=>setOpenSection(current=>current===id?null:id);
  return <div className="modal-bg"><div className="modal"><ModalDismiss onClose={cancel}/><h2>Configurações de {f.name||'usuário'}</h2>
    <p className="muted">Defina as regras funcionais e, separadamente, os painéis exibidos no menu lateral.</p>

    {f.role==='client'&&<><h3>Empresas vinculadas</h3><div className="arg-linked-company-list-v2">{companies.map(c=><label className="arg-linked-company-row-v2" key={c.id}><input type="checkbox" checked={(f.companyIds||[]).includes(c.id)} onChange={e=>set('companyIds',e.target.checked?[...(f.companyIds||[]),c.id]:(f.companyIds||[]).filter(x=>x!==c.id))}/><AvatarMini value={c.logo} label={c.name}/><span>{c.name}</span></label>)}</div></>}

    <div className={'panel master-custom-access-toggle '+(masterCustom?'is-custom':'')} style={{marginTop:18,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <div><b style={{color:masterCustom?'var(--gold)':undefined}}>Este usuário usa acesso personalizado?</b><br/><small className="muted">Desligado, tudo segue o padrão da função. Ligado, libera editar cada seção abaixo pra esse usuário específico.</small></div>
      <select value={masterCustom?'custom':'default'} disabled={editingOtherAdmin} onChange={e=>setCustomAccessMode(e.target.value==='custom')} style={{width:'auto',minWidth:220}}>
        <option value="default">Usar padrão da função</option>
        <option value="custom">Personalizar para este usuário</option>
      </select>
    </div>
    <h3 style={{marginTop:18}}>Regras de acesso</h3>
    {!masterCustom&&<p className="muted" style={{marginTop:-6,marginBottom:10}}>As seções abaixo mostram o padrão da função, só pra consulta. Ative a personalização acima pra poder editar.</p>}
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {f.role!=='admin'&&<AccessConfigCard title="Status disponíveis" open={openSection==='rule:statuses'} onToggleOpen={()=>toggleSection('rule:statuses')} accent customized={statusesDiff}>
        <label style={{color:statusInheritance==='custom'?'var(--gold)':undefined}}>Configuração dos status<small className="muted" style={{marginLeft:8}}>{masterCustom?'(personalizado)':'(padrão da função)'}</small></label>
        <div style={statusInheritance!=='custom'?{opacity:.62,pointerEvents:'none'}:undefined}>
          <StatusVisibilityChecks statuses={statuses} selected={statusInheritance==='custom'?(f.visibleStatuses||[]):(roleDefault.visibleStatuses||[])} onToggle={toggleStatus}/>
        </div>
      </AccessConfigCard>}

      {f.role!=='admin'&&<AccessConfigCard title="Tipos de tarefas disponíveis" open={openSection==='rule:types'} onToggleOpen={()=>toggleSection('rule:types')} accent customized={typesDiff}>
        <label style={{color:typeInheritance==='custom'?'var(--gold)':undefined}}>Configuração dos tipos<small className="muted" style={{marginLeft:8}}>{masterCustom?'(personalizado)':'(padrão da função)'}</small></label>
        <div style={typeInheritance!=='custom'?{opacity:.62,pointerEvents:'none'}:undefined}>
          <TaskTypeVisibilityChecks selected={typeInheritance==='custom'?(f.visibleTypes||[]):(roleDefault.visibleTypes||TASK_TYPES)} onToggle={toggleType}/>
        </div>
      </AccessConfigCard>}

      <AccessConfigCard title="Tarefa aberta" open={openSection==='rule:taskDetail'} onToggleOpen={()=>toggleSection('rule:taskDetail')} accent customized={taskDetailDiff}>
        <label style={{color:taskDetailInheritance==='custom'?'var(--gold)':undefined}}>Configuração da tarefa aberta<small className="muted" style={{marginLeft:8}}>{masterCustom?'(personalizado)':'(padrão da função)'}</small></label>
        <div style={taskDetailInheritance!=='custom'?{opacity:.62,pointerEvents:'none'}:undefined}>
          <TaskOpenPermissionList
            config={taskDetailConfig}
            disabled={editingOtherAdmin||taskDetailInheritance!=='custom'}
            onToggleApproval={checked=>setTaskDetailAction('canApprovePosts',checked)}
            onTogglePermission={toggleTaskDetailPermission}
          />
        </div>
      </AccessConfigCard>

      <AccessConfigCard
        title="Botão de tarefa"
        active={actionConfig?.canCreate===true}
        disabled={editingOtherAdmin||actionsInheritance!=='custom'}
        open={openSection==='rule:taskButton'}
        onToggleOpen={()=>toggleSection('rule:taskButton')}
        onToggleActive={checked=>setTaskPermission('canCreate',checked)}
        customized={actionsDiff}
      >
        <label style={{color:actionsInheritance==='custom'?'var(--gold)':undefined}}>Configuração do botão<small className="muted" style={{marginLeft:8}}>{masterCustom?'(personalizado)':'(padrão da função)'}</small></label>
        <div style={actionsInheritance!=='custom'?{opacity:.62,pointerEvents:'none'}:undefined}>
          <label>Texto do botão<select value={actionConfig?.creationMode||'task'} onChange={e=>setTaskPermission('creationMode',e.target.value)}><option value="task">Nova tarefa</option><option value="request">Nova solicitação</option></select></label>
          <h4 style={{margin:'14px 0 8px'}}>Campos disponíveis</h4>
          <div className="checks one-col compact-checks-v3">{CREATE_TASK_FIELDS.map(field=><label key={field.id}><input type="checkbox" checked={actionConfig?.createFields?.[field.id]===true} onChange={e=>toggleCreateField(field.id,e.target.checked)}/>{field.label}</label>)}</div>
        </div>
      </AccessConfigCard>
    </div>

    <h3 style={{marginTop:22}}>Painéis do menu lateral</h3>
    <p className="muted" style={{marginTop:-4}}>{masterCustom?'Ative ou desative os painéis e abra cada item para configurar.':'Os painéis acompanham automaticamente o padrão da função.'}</p>
    <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:14}}>
      {SIDEBAR_PANEL_CATALOG.filter(panel=>f.role==='admin'||!panel.adminOnly).map(panel=>{
        const enabled=panel.id==='tasks'?['kanban','calendar','tasks'].some(id=>resolvedVisible[id]===true):resolvedVisible[panel.id]===true;
        const sectionId=`panel:${panel.id}`;
        const panelCustomizedMap={
          notifications:notificationsDiff,
          dashboard:dashboardDiff,
          tasks:kanbanDiff||calendarDiff||tasksListDiff,
          teamhub:portfolioDiff,
          planning:planningDiff,
          documents:documentsDiff,
        };
        return <AccessConfigCard
          key={panel.id}
          title={panel.label}
          active={enabled}
          disabled={editingOtherAdmin||panelPermissionMode==='default'||(f.role==='admin'&&panel.id==='settings')}
          open={openSection===sectionId}
          onToggleOpen={()=>toggleSection(sectionId)}
          onToggleActive={checked=>togglePanel(panel.id,checked)}
          customized={(panelPermissionMode==='custom'&&resolvedVisible[panel.id]!==(defaultIds.includes(panel.id)))||!!panelCustomizedMap[panel.id]}
        >
          {enabled?panelDetails(panel):<p className="muted">Ative este painel para configurar suas opções.</p>}
        </AccessConfigCard>;
      })}
    </div>

    <div className="modal-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={()=>save({...f,notificationPrefsFromProfile:true})}>Salvar configurações</button></div>
  </div></div>;
}
function UserEditor({u,companies=[],statuses,save,cancel,clientMode=false,currentUser=null,onArchive=null,onDelete=null,onResetPassword=null}){
  const [f,setF]=useState(u);
  const [uploading,setUploading]=useState(false);
  const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
  const isAdminRole=f.role==='admin';
  const editingOtherAdmin = !clientMode && u?.id && u.role==='admin' && currentUser?.id && u.id!==currentUser.id;
  const isExisting=!!f.id;
  const canArchive = isExisting && (!currentUser?.id || f.id!==currentUser.id);
  const canDelete = isExisting && (!currentUser?.id || f.id!==currentUser.id);
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
  return <div className="modal-bg"><div className="modal"><ModalDismiss onClose={cancel}/><h2>{clientMode?'Responsável':'Usuário'}</h2>
    {!clientMode&&<label>Tipo de usuário<select value={f.role||'team'} disabled={editingOtherAdmin} onChange={e=>set('role',e.target.value)}><option value="team">Equipe</option><option value="admin">Admin</option></select>{editingOtherAdmin&&<small>Permissões de outro admin não podem ser alteradas.</small>}</label>}
    <label>Nome<input value={f.name||''} onChange={e=>set('name',e.target.value)}/></label>
    <label>Cargo<input value={f.title||''} onChange={e=>set('title',e.target.value)} placeholder={clientMode?'Responsável':'Designer, Editor, Admin...'}/></label>
    <label>Login<input disabled={isExisting} value={f.email||''} onChange={e=>set('email',e.target.value)}/><small className="profile-save-note">Depois de criado, o login fica travado para não desalinhar com o Supabase Auth.</small></label>
    <label>Senha<input disabled={isExisting} value={isExisting?'••••••••':(f.password||'')} onChange={e=>set('password',e.target.value)}/><small className="profile-save-note">Para usuário já criado, use o botão Redefinir senha.</small></label>{isExisting&&onResetPassword&&<button type="button" className="auth-secondary-action" onClick={()=>onResetPassword(f)}>Redefinir senha</button>}
    <label>Foto/avatar<input value={f.avatar||''} onChange={e=>set('avatar',e.target.value)} placeholder="Inicial, URL ou upload"/><input type="file" accept="image/*" onChange={uploadUserAvatar}/>{uploading&&<small>Enviando imagem...</small>}</label>
    <p className="muted">Painéis, status, empresas vinculadas e notificações ficam no botão Configurações.</p>

    {isExisting&&<div className="danger-zone"><h3>Zona de risco</h3><p>Arquivar esconde o cadastro sem apagar histórico. Excluir remove do painel.</p><div className="danger-zone-actions">{canArchive?<button onClick={()=>onArchive?.(f)}>{f.active===false?'Restaurar usuário':'Arquivar usuário'}</button>:<button disabled>Arquivar usuário</button>}{canDelete?<button className="danger-button" onClick={()=>onDelete?.(f)}>Excluir usuário</button>:<button className="danger-button" disabled>Excluir usuário</button>}</div>{!canArchive&&<small>Você não pode arquivar seu próprio usuário.</small>}{isAdminRole&&<small>Admins não podem ser excluídos.</small>}</div>}
    <div className="modal-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={async()=>await save(f)}>Salvar</button></div>
  </div></div>
}

function AccessDefaultsEditor({system,setSystem,statuses=[]}){
  const [mode,setMode]=useState('team');
  const role=mode==='client'?'client':'team';
  const [draft,setDraft]=useState(()=>clonePayload(accessDefaultForRole(system,'team')));
  const [openSection,setOpenSection]=useState(null);
  const [panelOrder,setPanelOrder]=useState(()=>sidebarPanelOrder(system));
  useEffect(()=>{if(mode==='order')return;setDraft(clonePayload(accessDefaultForRole(system,role)));setOpenSection(null);},[mode,role,system?.accessDefaults]);
  useEffect(()=>{setPanelOrder(sidebarPanelOrder(system));},[system?.panelOrder]);

  function setDraftValue(key,value){setDraft(prev=>({...prev,[key]:value}));}
  function togglePanel(id,checked){
    const current={...(draft.panels?.visible||{})};
    const next=id==='tasks'
      ? {...current,kanban:checked,calendar:checked,tasks:checked}
      : {...current,[id]:checked};
    const operationalIds=PANEL_CATALOG.filter(panel=>!['financial','settings'].includes(panel.id)).map(panel=>panel.id);
    if(!operationalIds.some(panelId=>next[panelId]===true)) return alert('O padrão precisa ter pelo menos um painel ativo.');
    setDraft(prev=>({...prev,panels:{...(prev.panels||{}),visible:next}}));
    if(!checked&&openSection===`panel:${id}`)setOpenSection(null);
  }
  function toggleDefaultTaskViewVisibility(id,checked){
    setDraft(prev=>({...prev,panels:{...(prev.panels||{}),visible:{...(prev.panels?.visible||{}),[id]:checked}}}));
  }
  function toggleStatus(id,checked){
    const current=draft.visibleStatuses||[];
    setDraftValue('visibleStatuses',checked?[...new Set([...current,id])]:current.filter(x=>x!==id));
  }
  function toggleType(type,checked){
    const current=draft.visibleTypes||TASK_TYPES;
    setDraftValue('visibleTypes',checked?[...new Set([...current,type])]:current.filter(x=>x!==type));
  }
  function toggleEvent(ev,checked){
    const current=draft.notificationPrefs||[];
    setDraftValue('notificationPrefs',checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev));
  }
  function toggleNotificationPanelPermission(id,checked){
    setDraft(prev=>({...prev,notificationPanel:{...(prev.notificationPanel||builtInNotificationPanelPermissionsForRole(role)),[id]:checked}}));
  }
  function toggleDashboardWidget(id,checked){
    setDraft(prev=>({...prev,dashboard:{visible:{...(prev.dashboard?.visible||fullDashboardVisibility()),[id]:checked}}}));
  }
  function toggleKanbanPermission(id,checked){
    setDraft(prev=>({...prev,kanban:{...(prev.kanban||builtInKanbanPermissionsForRole(role)),[id]:checked}}));
  }
  function toggleCalendarPermission(id,checked){
    setDraft(prev=>({...prev,calendar:{...(prev.calendar||builtInCalendarPermissionsForRole(role)),[id]:checked}}));
  }
  function togglePortfolioPermission(id,checked){
    setDraft(prev=>({...prev,portfolio:{...(prev.portfolio||builtInPortfolioPermissionsForRole(role)),[id]:checked}}));
  }
  function togglePlanningPermission(id,checked){
    setDraft(prev=>({...prev,planning:{...(prev.planning||builtInPlanningPermissionsForRole(role)),[id]:checked}}));
  }
  function toggleDocumentPermission(id,checked){
    setDraft(prev=>({...prev,documents:{...(prev.documents||builtInDocumentPermissionsForRole(role)),[id]:checked}}));
  }
  function toggleTasksListPermission(id,checked){
    setDraft(prev=>({...prev,tasksList:{...(prev.tasksList||builtInTasksListPermissionsForRole(role)),[id]:checked}}));
  }
  function setTaskPermission(key,value){
    setDraft(prev=>({...prev,tasks:{...(prev.tasks||{}),[key]:value,createFields:{...(prev.tasks?.createFields||{})}}}));
  }
  function toggleCreateField(id,checked){
    setDraft(prev=>({...prev,tasks:{...(prev.tasks||{}),createFields:{...(prev.tasks?.createFields||{}),[id]:checked}}}));
  }
  function toggleTaskDetailPermission(section,id,checked){
    setDraft(prev=>{
      const detail=prev.tasks?.detailFields||builtInTaskDetailPermissionsForRole(role);
      const nextDetail={
        visible:{...(detail.visible||{})},
        editable:{...(detail.editable||{})},
      };
      nextDetail[section][id]=checked;
      if(section==='visible'&&!checked) nextDetail.editable[id]=false;
      if(section==='editable'&&checked) nextDetail.visible[id]=true;
      return {...prev,tasks:{...(prev.tasks||{}),createFields:{...(prev.tasks?.createFields||{})},detailFields:nextDetail}};
    });
  }
  function setTaskDetailAction(key,value){
    setDraft(prev=>({...prev,tasks:{...(prev.tasks||{}),[key]:value,createFields:{...(prev.tasks?.createFields||{})},detailFields:{
      visible:{...(prev.tasks?.detailFields?.visible||{})},
      editable:{...(prev.tasks?.detailFields?.editable||{})},
    }}}));
  }
  function moveSidebarPanel(index,direction){
    const target=index+direction;
    if(target<0||target>=panelOrder.length)return;
    setPanelOrder(current=>{const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next;});
  }
  function savePanelOrder(){
    setSystem({...system,panelOrder:[...panelOrder]});
    notifySettingsSaved('Ordenação dos painéis salva');
  }
  function restorePanelOrder(){
    setPanelOrder([...DEFAULT_SIDEBAR_PANEL_ORDER]);
    setSystem({...system,panelOrder:[...DEFAULT_SIDEBAR_PANEL_ORDER]});
  }
  function saveDefaults(){
    setSystem({...system,accessDefaults:{...(system?.accessDefaults||{}),[role]:clonePayload(draft)}});
    notifySettingsSaved('Padrão de acesso salvo');
  }
  function restoreBuiltIn(){
    if(!confirm('Restaurar o padrão original desta função?'))return;
    const restored=builtInAccessDefaultForRole(role);
    setDraft(clonePayload(restored));
    setSystem({...system,accessDefaults:{...(system?.accessDefaults||{}),[role]:restored}});
  }
  const roleLabel=role==='admin'?'Admin':role==='team'?'Equipe':'Responsável';
  const toggleSection=id=>setOpenSection(current=>current===id?null:id);
  function panelDefaultDetails(panel){
    if(panel.id==='notifications') return <div>
      <h4>Painel e ações</h4><div className="checks one-col compact-checks-v3">{NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=><label key={item.id}><input type="checkbox" checked={draft.notificationPanel?.[item.id]===true} onChange={e=>toggleNotificationPanelPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div>
      <div className="notification-prefs-grid" style={{marginTop:18}}><div><h4>Eventos</h4><div className="checks one-col compact-checks-v3">{NOTIFICATION_VISIBLE_EVENTS.map(ev=><label key={ev}><input type="checkbox" checked={(draft.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>)}</div></div><div><h4>Status que geram notificação</h4><div className="checks one-col status-notify-list compact-checks-v3">{statuses.map(st=><label key={st.id}><input type="checkbox" checked={(draft.notificationStatusPrefs?.[st.id]??true)} onChange={e=>setDraftValue('notificationStatusPrefs',{...(draft.notificationStatusPrefs||{}),[st.id]:e.target.checked})}/><span className="status-dot" style={{background:st.color}}></span>{st.name}</label>)}</div></div></div>
    </div>;
    if(panel.id==='dashboard') return <div><h4>Abas, filtros, cards e gráficos</h4><div className="checks one-col compact-checks-v3">{DASHBOARD_WIDGETS.filter(item=>!item.adminOnly).map(item=><label key={item.id}><input type="checkbox" checked={(draft.dashboard?.visible?.[item.id]??true)} onChange={e=>toggleDashboardWidget(item.id,e.target.checked)}/>{item.label}</label>)}</div></div>;
    if(panel.id==='tasks') return <div className="access-tasks-groups">
      <h4>Visualizações disponíveis</h4><div className="checks one-col compact-checks-v3 task-view-visibility-checks">
        <label><input type="checkbox" checked={draft.panels?.visible?.kanban===true} onChange={e=>toggleDefaultTaskViewVisibility('kanban',e.target.checked)}/>Exibir Kanban</label>
        <label><input type="checkbox" checked={draft.panels?.visible?.calendar===true} onChange={e=>toggleDefaultTaskViewVisibility('calendar',e.target.checked)}/>Exibir Calendário</label>
        <label><input type="checkbox" checked={draft.panels?.visible?.tasks===true} onChange={e=>toggleDefaultTaskViewVisibility('tasks',e.target.checked)}/>Exibir Listas</label>
      </div>
      <h4>Kanban</h4><div className="checks one-col compact-checks-v3">{KANBAN_PERMISSION_ITEMS.map(item=><label key={`kanban:${item.id}`}><input type="checkbox" checked={draft.kanban?.[item.id]===true} onChange={e=>toggleKanbanPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div>
      <h4>Calendário</h4><div className="checks one-col compact-checks-v3">{CALENDAR_PERMISSION_ITEMS.map(item=><label key={`calendar:${item.id}`}><input type="checkbox" checked={draft.calendar?.[item.id]===true} onChange={e=>toggleCalendarPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div>
      <h4>Listas</h4><div className="checks one-col compact-checks-v3">{TASKS_LIST_PERMISSION_ITEMS.map(item=><label key={`lists:${item.id}`}><input type="checkbox" checked={draft.tasksList?.[item.id]===true} onChange={e=>toggleTasksListPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div>
    </div>;
    if(panel.id==='teamhub') return <div><h4>Perfis e trabalhos visíveis</h4><div className="checks one-col compact-checks-v3">{PORTFOLIO_PERMISSION_ITEMS.map(item=><label key={item.id}><input type="checkbox" checked={draft.portfolio?.[item.id]===true} onChange={e=>togglePortfolioPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div></div>;
    if(panel.id==='planning') return <div><h4>Semanas, templates e geração</h4><div className="checks one-col compact-checks-v3">{PLANNING_PERMISSION_ITEMS.map(item=><label key={item.id}><input type="checkbox" checked={draft.planning?.[item.id]===true} onChange={e=>togglePlanningPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div></div>;
    if(panel.id==='documents') return <div><h4>Pastas, conteúdo e ações</h4><div className="checks one-col compact-checks-v3">{DOCUMENT_PERMISSION_ITEMS.map(item=><label key={item.id}><input type="checkbox" checked={draft.documents?.[item.id]===true} onChange={e=>toggleDocumentPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div></div>;
    return <p className="muted">As configurações internas deste painel serão adicionadas no módulo correspondente. A visibilidade já está funcional.</p>;
  }
  return <div className="settings-section">
    <div className="view-tabs access-role-tabs">{[['team','Equipe'],['client','Responsável'],['order','Ordenação']].map(([id,label])=><button key={id} className={mode===id?'active primary':''} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</div>
    {mode==='order'?<div className="panel access-order-panel"><h2>Ordenação dos painéis</h2><p className="muted">Define a ordem-base da barra lateral para todos os perfis. Financeiro e Configurações aparecem somente para Admin, mas também respeitam esta ordem.</p><div className="access-order-list">{panelOrder.map((id,index)=>{const panel=SIDEBAR_PANEL_CATALOG.find(item=>item.id===id);return <div className="access-order-row" key={id}><b>{index+1}. {panel?.label||id}</b><div><button onClick={()=>moveSidebarPanel(index,-1)} disabled={index===0}>↑ Subir</button><button onClick={()=>moveSidebarPanel(index,1)} disabled={index===panelOrder.length-1}>↓ Descer</button></div></div>})}</div><div className="modal-actions"><button onClick={restorePanelOrder}>Restaurar ordem</button><button className="primary" onClick={savePanelOrder}>Salvar ordenação</button></div></div>:<div className="panel"><h2>Padrão de {roleLabel}</h2>

      <h3>Regras de acesso</h3>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {role!=='admin'&&<AccessConfigCard title="Status disponíveis" open={openSection==='rule:statuses'} onToggleOpen={()=>toggleSection('rule:statuses')} accent>
          <StatusVisibilityChecks statuses={statuses} selected={draft.visibleStatuses||[]} onToggle={toggleStatus}/>
        </AccessConfigCard>}

        {role!=='admin'&&<AccessConfigCard title="Tipos de tarefas disponíveis" open={openSection==='rule:types'} onToggleOpen={()=>toggleSection('rule:types')} accent>
          <TaskTypeVisibilityChecks selected={draft.visibleTypes||TASK_TYPES} onToggle={toggleType}/>
        </AccessConfigCard>}

        <AccessConfigCard title="Tarefa aberta" open={openSection==='rule:taskDetail'} onToggleOpen={()=>toggleSection('rule:taskDetail')} accent>
          <TaskOpenPermissionList
            config={{canApprovePosts:draft.tasks?.canApprovePosts===true,visible:draft.tasks?.detailFields?.visible||{},editable:draft.tasks?.detailFields?.editable||{}}}
            onToggleApproval={checked=>setTaskDetailAction('canApprovePosts',checked)}
            onTogglePermission={toggleTaskDetailPermission}
          />
        </AccessConfigCard>

        <AccessConfigCard
          title="Botão de tarefa"
          active={draft.tasks?.canCreate===true}
          open={openSection==='rule:taskButton'}
          onToggleOpen={()=>toggleSection('rule:taskButton')}
          onToggleActive={checked=>setTaskPermission('canCreate',checked)}
        >
          <label>Texto do botão<select value={draft.tasks?.creationMode||'task'} onChange={e=>setTaskPermission('creationMode',e.target.value)}><option value="task">Nova tarefa</option><option value="request">Nova solicitação</option></select></label>
          <h4 style={{margin:'14px 0 8px'}}>Campos disponíveis</h4>
          <div className="checks one-col compact-checks-v3">{CREATE_TASK_FIELDS.map(field=><label key={field.id}><input type="checkbox" checked={draft.tasks?.createFields?.[field.id]===true} onChange={e=>toggleCreateField(field.id,e.target.checked)}/>{field.label}</label>)}</div>
        </AccessConfigCard>
      </div>

      <h3 style={{marginTop:22}}>Painéis do menu lateral</h3>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {SIDEBAR_PANEL_CATALOG.filter(panel=>!panel.adminOnly).map(panel=>{
          const active=panel.id==='tasks'
            ? ['kanban','calendar','tasks'].some(id=>draft.panels?.visible?.[id]===true)
            : draft.panels?.visible?.[panel.id]===true;
          const sectionId=`panel:${panel.id}`;
          return <AccessConfigCard
            key={panel.id}
            title={panel.label}
            active={active}
            open={openSection===sectionId}
            onToggleOpen={()=>toggleSection(sectionId)}
            onToggleActive={checked=>togglePanel(panel.id,checked)}
          >
            {active?panelDefaultDetails(panel):<p className="muted">Ative este painel para configurar suas opções.</p>}
          </AccessConfigCard>;
        })}
      </div>

      <div className="modal-actions"><button onClick={restoreBuiltIn}>Restaurar padrão original</button><button className="primary" onClick={saveDefaults}>Salvar padrão</button></div>
    </div>}
  </div>;
}


/* Round206A — confirmação única das abas e retorno visual de salvamento.
   Inserido após o estilo legado para valer igualmente no desktop e mobile. */


let settingsNoticeTimer;
function notifySettingsSaved(message='Alterações salvas'){
  if(typeof document==='undefined') return;
  let notice=document.getElementById('argos-settings-save-notice');
  if(!notice){
    notice=document.createElement('div');
    notice.id='argos-settings-save-notice';
    notice.className='settings-save-notice';
    notice.setAttribute('role','status');
    notice.setAttribute('aria-live','polite');
    document.body.appendChild(notice);
  }
  notice.replaceChildren();
  const icon=document.createElement('span');
  icon.setAttribute('aria-hidden','true');
  icon.textContent='✓';
  const text=document.createElement('span');
  text.textContent=String(message);
  notice.append(icon,text);
  notice.classList.add('show');
  clearTimeout(settingsNoticeTimer);
  settingsNoticeTimer=setTimeout(()=>notice.classList.remove('show'),2600);
}

const FINANCIAL_LAB_KEY='argos_financial_lab_v1';
const FINANCIAL_SETTINGS_TABLE='app_financial_settings';


function financialNumber(value){const parsed=Number(value);return Number.isFinite(parsed)?Math.max(0,parsed):0;}
function financialMoney(value){const parsed=Number(value);return (Number.isFinite(parsed)?parsed:0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function financialMonth(){return todayStr().slice(0,7);}
function freshFinancialLab(){
  return {
    market:Object.fromEntries(TASK_TYPES.map(type=>[type,{sale:0,cost:0}])),
    companies:{},
    users:{},
  };
}
function normalizeFinancialLab(raw){
  const base=freshFinancialLab();
  const source=raw&&typeof raw==='object'?raw:{};
  TASK_TYPES.forEach(type=>{base.market[type]={sale:financialNumber(source.market?.[type]?.sale),cost:financialNumber(source.market?.[type]?.cost)};});
  base.companies=source.companies&&typeof source.companies==='object'?source.companies:{};
  base.users=source.users&&typeof source.users==='object'?source.users:{};
  return base;
}
async function loadFinancialSettings(organizationId){
  const {data,error}=await supabase.from(FINANCIAL_SETTINGS_TABLE).select('config').eq('organization_id',organizationId).maybeSingle();
  if(error) throw error;
  return data?.config?normalizeFinancialLab(data.config):null;
}
async function saveFinancialSettings(organizationId,userId,config){
  const {error}=await supabase.from(FINANCIAL_SETTINGS_TABLE).upsert({organization_id:organizationId,config:normalizeFinancialLab(config),updated_by:userId||null,updated_at:now()},{onConflict:'organization_id'});
  if(error) throw error;
}
function FinancialLab({tasks=[],companies=[],users=[],currentUser=null}){
  const [tab,setTab]=useState('summary');
  const financialPreferencesKey=`argos_financial_preferences_${currentUser?.id||'admin'}`;
  const initialFinancialPreferences=load(financialPreferencesKey,{month:financialMonth()});
  const [month,setMonth]=useState(initialFinancialPreferences.month||financialMonth());
  const [companySort,setCompanySort]=useState('name');
  const [teamSort,setTeamSort]=useState('name');
  const [config,setConfig]=useState(()=>normalizeFinancialLab(load(FINANCIAL_LAB_KEY,freshFinancialLab())));
  const [settingsReady,setSettingsReady]=useState(!isSupabaseConfigured);
  const [settingsStatus,setSettingsStatus]=useState(isSupabaseConfigured?'Carregando valores...':'Salvo neste navegador');
  useEffect(()=>{ save(financialPreferencesKey,{month}); },[financialPreferencesKey,month]);
  const organizationId=currentUser?.organizationId;
  const activeCompanies=companies.filter(company=>company.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
  const team=users.filter(user=>user.active!==false&&(user.role==='team'||user.role==='admin')).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
  const [companyId,setCompanyId]=useState(()=>activeCompanies[0]?.id||'');
  const [userId,setUserId]=useState(()=>team[0]?.id||'');
  useEffect(()=>{
    if(currentUser?.role!=='admin') return;
    let alive=true;
    (async()=>{
      try{
        if(!isSupabaseConfigured||!organizationId){if(alive)setSettingsReady(true);return;}
        const remote=await loadFinancialSettings(organizationId);
        const initial=remote||normalizeFinancialLab(load(FINANCIAL_LAB_KEY,freshFinancialLab()));
        if(!remote) await saveFinancialSettings(organizationId,currentUser.id,initial);
        if(alive){setConfig(initial);save(FINANCIAL_LAB_KEY,initial);setSettingsReady(true);setSettingsStatus('Valores sincronizados');}
      }catch(error){
        console.error('financial settings load failed',error);
        if(alive){setSettingsReady(false);setSettingsStatus(`Tabela financeira indisponível: ${error.message||error}`);}
      }
    })();
    return()=>{alive=false;};
  },[currentUser?.id,currentUser?.role,organizationId]);
  useEffect(()=>{
    save(FINANCIAL_LAB_KEY,config);
    if(!settingsReady||!isSupabaseConfigured||!organizationId||currentUser?.role!=='admin') return;
    setSettingsStatus('Salvando...');
    const timer=setTimeout(()=>{
      saveFinancialSettings(organizationId,currentUser.id,config)
        .then(()=>setSettingsStatus('Valores sincronizados'))
        .catch(error=>{console.error('financial settings save failed',error);setSettingsStatus(`Erro ao salvar: ${error.message||error}`);});
    },650);
    return()=>clearTimeout(timer);
  },[config,settingsReady,organizationId,currentUser?.id,currentUser?.role]);
  useEffect(()=>{if(!activeCompanies.some(item=>item.id===companyId))setCompanyId(activeCompanies[0]?.id||'');},[companies,companyId]);
  useEffect(()=>{if(!team.some(item=>item.id===userId))setUserId(team[0]?.id||'');},[users,userId]);
  if(currentUser?.role!=='admin') return <section><h1>Acesso negado</h1><div className="panel"><p className="muted">Financeiro é uma área exclusiva de Admin.</p></div></section>;

  const monthTasks=tasks.filter(task=>!task.archived&&String(task.postDate||task.internalDate||'').slice(0,7)===month);
  const marketSaleFor=task=>financialNumber(config.market?.[task.type]?.sale);
  const marketCostFor=task=>financialNumber(config.market?.[task.type]?.cost);
  const clientRows=activeCompanies.map(company=>{
    const companyTasks=monthTasks.filter(task=>task.companyId===company.id);
    const rule=config.companies?.[company.id]||{};
    const mode=rule.mode||'fixed';
    const fixed=mode==='fixed'||mode==='hybrid'?financialNumber(rule.fixed):0;
    const variable=mode==='variable'||mode==='hybrid'?companyTasks.reduce((sum,task)=>sum+financialNumber(rule.rates?.[task.type]),0):0;
    const market=companyTasks.reduce((sum,task)=>sum+marketSaleFor(task),0);
    const actual=fixed+variable;
    return {id:company.id,name:company.name,count:companyTasks.length,market,actual,difference:actual-market,average:companyTasks.length?actual/companyTasks.length:0};
  });
  const teamRows=team.map(user=>{
    const userTasks=monthTasks.filter(task=>task.responsibleId===user.id);
    const rule=config.users?.[user.id]||{};
    const mode=rule.mode||'fixed';
    const fixed=mode==='fixed'||mode==='hybrid'?financialNumber(rule.fixed):0;
    const variable=mode==='variable'||mode==='hybrid'?userTasks.reduce((sum,task)=>sum+financialNumber(rule.rates?.[task.type]),0):0;
    const desired=userTasks.reduce((sum,task)=>sum+marketCostFor(task),0);
    const actual=fixed+variable;
    const generated=userTasks.reduce((sum,task)=>sum+marketSaleFor(task),0);
    return {id:user.id,name:user.name,count:userTasks.length,desired,actual,difference:actual-desired,average:userTasks.length?actual/userTasks.length:0,generated};
  });
  const sortFinancialRows=(rows,sort)=>[...rows].sort((a,b)=>{
    if(sort==='name') return String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'});
    const field=sort==='count'?'count':sort==='desired'?'desired':sort==='actual'?'actual':sort==='difference'?'difference':'average';
    return (Number(b[field])||0)-(Number(a[field])||0)||String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'});
  });
  const sortedClientRows=sortFinancialRows(clientRows,companySort);
  const sortedTeamRows=sortFinancialRows(teamRows,teamSort);
  const totalMarket=clientRows.reduce((sum,row)=>sum+row.market,0);
  const totalRevenue=clientRows.reduce((sum,row)=>sum+row.actual,0);
  const desiredCost=teamRows.reduce((sum,row)=>sum+row.desired,0);
  const realCost=teamRows.reduce((sum,row)=>sum+row.actual,0);
  const margin=totalRevenue-realCost;
  const clientTaskTotal=clientRows.reduce((sum,row)=>sum+row.count,0);
  const clientDifference=totalRevenue-totalMarket;
  const clientAverage=clientTaskTotal?totalRevenue/clientTaskTotal:0;
  const teamTaskTotal=teamRows.reduce((sum,row)=>sum+row.count,0);
  const teamDifference=realCost-desiredCost;
  const teamAverage=teamTaskTotal?realCost/teamTaskTotal:0;
  const companyRule=normalizeFinancialRule(config.companies?.[companyId]);
  const userRule=normalizeFinancialRule(config.users?.[userId]);
  const patchMarket=(type,field,value)=>setConfig(prev=>({...prev,market:{...prev.market,[type]:{...(prev.market?.[type]||{}),[field]:financialNumber(value)}}}));
  const patchCompany=patch=>setConfig(prev=>({...prev,companies:{...prev.companies,[companyId]:{...normalizeFinancialRule(prev.companies?.[companyId]),...patch}}}));
  const patchCompanyRate=(type,value)=>patchCompany({rates:{...companyRule.rates,[type]:financialNumber(value)}});
  const patchUser=patch=>setConfig(prev=>({...prev,users:{...prev.users,[userId]:{...normalizeFinancialRule(prev.users?.[userId]),...patch}}}));
  const patchUserRate=(type,value)=>patchUser({rates:{...userRule.rates,[type]:financialNumber(value)}});
  const resetLab=()=>{if(confirm('Limpar somente as simulações financeiras salvas neste navegador?'))setConfig(freshFinancialLab());};
  return <section className="financial-lab"><PanelTabsHeader title="Financeiro" tabs={[["summary","Resumo"],["market","Referências"],["companies","Clientes"],["team","Equipe"]]} active={tab} onChange={setTab}/>
    <div className="financial-toolbar"><div className="financial-toolbar-main"><label>Mês analisado<input type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label></div></div>
    <span className="financial-help financial-month-help">{monthTasks.length} tarefa(s) consideradas pela data do post ou, quando vazia, pelo prazo interno.</span>
    {tab==='summary'&&<>
      <div className="financial-cards"><div className="panel financial-card"><small>Valor de mercado entregue</small><strong>{financialMoney(totalMarket)}</strong><em>Venda desejada por tipo de tarefa</em></div><div className="panel financial-card"><small>Receita real simulada</small><strong>{financialMoney(totalRevenue)}</strong><em>Contratos + produção variável</em></div><div className="panel financial-card"><small>Custo real da equipe</small><strong>{financialMoney(realCost)}</strong><em>Fixos + pagamentos variáveis</em></div><div className="panel financial-card"><small>Margem simulada</small><strong className={margin<0?'financial-negative':'financial-positive'}>{financialMoney(margin)}</strong><em>{totalRevenue?`${Math.round(margin/totalRevenue*100)}% da receita`:'Preencha os valores para calcular'}</em></div></div>
    </>}
    {tab==='market'&&<div className="panel"><h2>Valores de referência da Argos</h2><p className="financial-help">Defina quanto a Argos gostaria de cobrar e pagar por cada tipo, independentemente do acordo real.</p><div className="financial-table-wrap"><table><thead><tr><th>Tipo de tarefa</th><th>Venda desejada</th><th>Custo desejado</th><th>Margem desejada</th></tr></thead><tbody>{TASK_TYPES.map(type=>{const sale=financialNumber(config.market?.[type]?.sale);const cost=financialNumber(config.market?.[type]?.cost);return <tr key={type}><td>{type}</td><td><MoneyInput value={sale} onChange={value=>patchMarket(type,'sale',value)}/></td><td><MoneyInput value={cost} onChange={value=>patchMarket(type,'cost',value)}/></td><td>{financialMoney(sale-cost)}</td></tr>})}</tbody></table></div></div>}
    {tab==='companies'&&<><FinancialOverview title="Visão rápida dos clientes" entityLabel="Cliente" rows={sortedClientRows} desiredKey="market" selectedId={companyId} onSelect={setCompanyId} sort={companySort} setSort={setCompanySort} totals={{count:clientTaskTotal,desired:totalMarket,actual:totalRevenue,difference:clientDifference,average:clientAverage}}/><div className="financial-editor"><div className="panel"><h2>Contrato do cliente</h2><label>Cliente<select value={companyId} onChange={event=>setCompanyId(event.target.value)}>{activeCompanies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>Modelo<select value={companyRule.mode} onChange={event=>patchCompany({mode:event.target.value})}><option value="fixed">Fixo</option><option value="variable">Variável</option><option value="hybrid">Fixo + variável</option></select></label>{companyRule.mode!=='variable'&&<label>Contrato fixo mensal<MoneyInput value={companyRule.fixed} onChange={value=>patchCompany({fixed:financialNumber(value)})}/></label>}<p className="financial-help">No híbrido, o valor variável é somado ao contrato. Neste laboratório, todas as tarefas do mês usam a tabela ao lado.</p></div><div className="panel"><h2>Valor real por tipo</h2><div className="financial-type-grid">{TASK_TYPES.map(type=><label className="financial-type-row" key={type}><span>{type}</span><MoneyInput value={companyRule.rates[type]||0} onChange={value=>patchCompanyRate(type,value)} disabled={companyRule.mode==='fixed'}/></label>)}</div></div></div></>}
    {tab==='team'&&<><FinancialOverview title="Visão rápida da equipe" entityLabel="Equipe" rows={sortedTeamRows} desiredKey="desired" selectedId={userId} onSelect={setUserId} sort={teamSort} setSort={setTeamSort} totals={{count:teamTaskTotal,desired:desiredCost,actual:realCost,difference:teamDifference,average:teamAverage}}/><div className="financial-editor"><div className="panel"><h2>Custo da pessoa</h2><label>Funcionário<select value={userId} onChange={event=>setUserId(event.target.value)}>{team.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>Modelo<select value={userRule.mode} onChange={event=>patchUser({mode:event.target.value})}><option value="fixed">Fixo</option><option value="variable">Variável</option><option value="hybrid">Fixo + variável</option></select></label>{userRule.mode!=='variable'&&<label>Salário/custo fixo mensal<MoneyInput value={userRule.fixed} onChange={value=>patchUser({fixed:financialNumber(value)})}/></label>}<p className="financial-help">A média por tarefa divide o custo real da pessoa pela produção registrada no mês.</p></div><div className="panel"><h2>Pagamento real por tipo</h2><div className="financial-type-grid">{TASK_TYPES.map(type=><label className="financial-type-row" key={type}><span>{type}</span><MoneyInput value={userRule.rates[type]||0} onChange={value=>patchUserRate(type,value)} disabled={userRule.mode==='fixed'}/></label>)}</div></div></div></>}
  </section>;
}
const FINANCIAL_SORTS=[['name','Nome'],['count','Qt. de tarefas'],['desired','Valor desejado'],['actual','Valor real'],['difference','Diferença'],['average','Média']];
function FinancialOverview({title,entityLabel,rows,desiredKey,selectedId,onSelect,sort,setSort,totals}){
  const currentIndex=Math.max(0,FINANCIAL_SORTS.findIndex(([id])=>id===sort));
  const nextSort=()=>setSort(FINANCIAL_SORTS[(currentIndex+1)%FINANCIAL_SORTS.length][0]);
  return <div className="panel financial-overview"><div className="financial-overview-head"><h2>{title}</h2><button type="button" className="financial-sort-button" onClick={nextSort} title="Clique para alterar a ordenação">Ordenar: {FINANCIAL_SORTS[currentIndex][1]}</button></div><div className="financial-table-wrap"><table><thead><tr><th>{entityLabel}</th><th>Qt. de tarefas</th><th>Valor desejado</th><th>Valor real</th><th>Diferença</th><th>Média</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className={selectedId===row.id?'selected':''} onClick={()=>onSelect(row.id)}><td>{row.name}</td><td>{row.count}</td><td>{financialMoney(row[desiredKey])}</td><td>{financialMoney(row.actual)}</td><td className={row.difference<0?'financial-negative':'financial-positive'}>{row.difference<0?'- ':''}{financialMoney(Math.abs(row.difference))}</td><td>{financialMoney(row.average)}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td>{totals.count}</td><td>{financialMoney(totals.desired)}</td><td>{financialMoney(totals.actual)}</td><td className={totals.difference<0?'financial-negative':'financial-positive'}>{totals.difference<0?'- ':''}{financialMoney(Math.abs(totals.difference))}</td><td>{financialMoney(totals.average)}</td></tr></tfoot></table></div></div>;
}
function normalizeFinancialRule(rule){return {mode:['fixed','variable','hybrid'].includes(rule?.mode)?rule.mode:'fixed',fixed:financialNumber(rule?.fixed),rates:Object.fromEntries(TASK_TYPES.map(type=>[type,financialNumber(rule?.rates?.[type])]))};}
function MoneyInput({value,onChange,disabled=false}){return <input type="number" min="0" step="0.01" inputMode="decimal" value={value??0} disabled={disabled} onChange={event=>onChange(event.target.value)} aria-label="Valor em reais"/>;}

function SettingsPage({statuses,setStatuses,tasks,setTasks,companies,setCompanies,users,setUsers,system,setSystem,reset,currentUser=null}){ 
  const preferencesStorageKey=`argos_settings_preferences_${currentUser?.id||'admin'}`;
  const initialPreferences=load(preferencesStorageKey,{tab:'status'});
  const [tab,setTab]=useState(initialPreferences.tab||'status');
  useEffect(()=>{ save(preferencesStorageKey,{tab}); },[preferencesStorageKey,tab]); 
  const [editing,setEditing]=useState(null); 
  function del(s){ if(tasks.some(t=>t.status===s.id)) return alert('Existem tarefas usando este status. Mova essas tarefas antes de excluir.'); setStatuses(statuses.filter(x=>x.id!==s.id)); } 
  function saveStatus(s){ const next={...s,id:s.id||slug(s.name)}; setStatuses(statuses.some(x=>x.id===next.id)?statuses.map(x=>x.id===next.id?next:x):[...statuses,next]); setEditing(null); notifySettingsSaved('Status salvo'); } 
  function moveStatus(index,direction){ const target=index+direction; if(target<0||target>=statuses.length) return; const next=[...statuses]; [next[index],next[target]]=[next[target],next[index]]; setStatuses(next); } 
  const tabs=[['status','Status'],['accessDefaults','Padrões de acesso'],['companies','Empresas'],['clients','Responsáveis'],['team','Equipe'],['portfolioPublic','Portfólio público'],['approvalReminders','Lembretes de aprovação'],['general','Aparência']];
  if(currentUser?.role!=='admin') return <section><h1>Acesso negado</h1><div className="panel"><p className="muted">Configurações é uma área exclusiva de Admin.</p></div></section>;
  return <section><PanelTabsHeader title="Configurações" tabs={tabs} active={tab} onChange={setTab}/>{tab==='status'&&<div className="settings-section"><div className="section-header section-header-actions-only"><button className="primary" onClick={()=>setEditing({id:'',name:'',color:'#ffffff',active:true,final:false})}>+ Novo status</button></div><div className="client-grid compact-admin-grid status-grid" style={{display:'flex',flexDirection:'column',gap:12}}>{statuses.map((s,i)=><div className="panel" key={s.id} style={{borderLeft:`4px solid ${s.color}`,borderTop:'1px solid rgba(var(--accent-rgb),.25)','--status-color':s.color}}><h2>{s.name}</h2><small>{tasks.filter(t=>t.status===s.id).length} tarefa(s)</small><div className="row-actions"><button onClick={()=>moveStatus(i,-1)} disabled={i===0}>↑ Subir</button><button onClick={()=>moveStatus(i,1)} disabled={i===statuses.length-1}>↓ Descer</button><button onClick={()=>setEditing(s)}>Editar</button><button onClick={()=>del(s)}>Excluir</button></div></div>)}</div>{editing&&<StatusEditor s={editing} save={saveStatus} cancel={()=>setEditing(null)}/>}</div>}{tab==='accessDefaults'&&<AccessDefaultsEditor system={system} setSystem={setSystem} statuses={statuses}/>} {tab==='companies'&&<CompaniesPage companies={companies} setCompanies={setCompanies} tasks={tasks} setTasks={setTasks} users={users} setUsers={setUsers}/>} {tab==='clients'&&<ClientUsersPage users={users} setUsers={setUsers} companies={companies} statuses={statuses} currentUser={currentUser} accessDefaults={system?.accessDefaults}/>} {tab==='team'&&<TeamPage users={users} setUsers={setUsers} statuses={statuses} tasks={tasks} currentUser={currentUser} accessDefaults={system?.accessDefaults}/>} {tab==='portfolioPublic'&&<PublicPortfolioSettings currentUser={currentUser}/>} {tab==='approvalReminders'&&<ApprovalReminderSettings currentUser={currentUser} statuses={statuses}/>} {tab==='general'&&<AppearanceSettings system={system} setSystem={setSystem}/>}</section> 
}
function NotificationSettings({users,setUsers,statuses,currentUser=null}){
  const events=NOTIFICATION_VISIBLE_EVENTS;
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
          <div><h3>Eventos</h3><div className="checks one-col">{events.map(ev=><label key={ev}><input type="checkbox" disabled={!canEdit} checked={(Array.isArray(u.notificationPrefs)?u.notificationPrefs:defaultNotificationPrefsForRole(u.role)).includes(ev)} onChange={e=>{if(!canEdit) return; const checked=e.target.checked; setUsers(prev=>prev.map(x=>{ if(x.id!==u.id) return x; const cur=Array.isArray(x.notificationPrefs)?x.notificationPrefs:defaultNotificationPrefsForRole(x.role); const next=checked?[...new Set([...cur,ev])]:cur.filter(item=>item!==ev); return {...x,notificationPrefs:next}; }));}}/>{ev}</label>)}</div></div>
          <div><h3>Status que geram notificação</h3><div className="checks one-col status-notify-list">{statuses.map(st=><label key={st.id}><input type="checkbox" disabled={!canEdit} checked={(u.notificationStatusPrefs?.[st.id]??true)} onChange={e=>{if(!canEdit) return; const checked=e.target.checked; setUsers(prev=>prev.map(x=>x.id===u.id?{...x,notificationStatusPrefs:{...(x.notificationStatusPrefs||{}),[st.id]:checked}}:x));}}/><span className="status-dot" style={{background:st.color}}></span>{st.name}</label>)}</div></div>
        </div>
      </>}
    </div>
  })}</div></div>
}
function StatusEditor({s,save,cancel}){ const [f,setF]=useState(s); const set=(k,v)=>setF({...f,[k]:v}); return <div className="modal-bg"><div className="modal status-editor-modal"><ModalDismiss onClose={cancel}/><h2>Status</h2><div className="status-editor-fields"><label>Nome<input value={f.name||''} onChange={e=>set('name',e.target.value)}/></label><label>Cor<input type="color" value={f.color} onChange={e=>set('color',e.target.value)}/></label></div><div className="status-editor-checks"><label><input type="checkbox" checked={f.active} onChange={e=>set('active',e.target.checked)}/><span>Ativo</span></label><label><input type="checkbox" checked={f.final} onChange={e=>set('final',e.target.checked)}/><span>Conta como finalizado</span></label></div><div className="modal-actions status-editor-actions"><button onClick={cancel}>Cancelar</button><button className="primary" onClick={async()=>await save(f)}>Salvar</button></div></div></div> }


function PublicPortfolioSettings({currentUser}){
  const organizationId=currentUser?.organizationId;
  const [form,setForm]=useState({
    publicSlug:'argos',
    profileName:'Argos',
    profileUsername:'@argosmarketing',
    avatarUrl:'',
    bio:'',
    ctaText:'Solicitar orçamento',
    ctaUrl:'',
    socialLinks:{
      whatsapp:'',
      instagram:'',
      youtube:'',
      tiktok:'',
      linkedin:'',
      facebook:'',
      site:'',
    },
    active:true,
  });
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const set=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  const setSocial=(key,value)=>setForm(prev=>({...prev,socialLinks:{...(prev.socialLinks||{}),[key]:value}}));

  useEffect(()=>{
    let alive=true;
    if(!organizationId){
      setLoading(false);
      setError('Organização não identificada.');
      return ()=>{alive=false};
    }
    (async()=>{
      try{
        setLoading(true);
        setError('');
        const row=await loadPublicPortfolioSettings(organizationId);
        if(!alive) return;
        if(row){
          setForm({
            publicSlug:row.public_slug||'argos',
            profileName:row.profile_name||'Argos',
            profileUsername:row.profile_username||'@argosmarketing',
            avatarUrl:row.avatar_url||'',
            bio:row.bio||'',
            ctaText:row.cta_text||'Solicitar orçamento',
            ctaUrl:row.cta_url||'',
            socialLinks:{
              whatsapp:row.social_links?.whatsapp||'',
              instagram:row.social_links?.instagram||'',
              youtube:row.social_links?.youtube||'',
              tiktok:row.social_links?.tiktok||'',
              linkedin:row.social_links?.linkedin||'',
              facebook:row.social_links?.facebook||'',
              site:row.social_links?.site||'',
            },
            active:row.active!==false,
          });
        }
      }catch(err){
        if(alive) setError(err.message||'Não foi possível carregar as configurações.');
      }finally{
        if(alive) setLoading(false);
      }
    })();
    return()=>{alive=false};
  },[organizationId]);

  async function uploadAvatar(event){
    const file=event.target.files?.[0];
    if(!file) return;
    try{
      setError('');
      const url=await uploadImageToSupabase(file,'public-portfolio/avatar');
      set('avatarUrl',url);
    }catch(err){
      setError('Não foi possível enviar a foto: '+(err.message||err));
    }finally{
      event.target.value='';
    }
  }

  async function saveSettings(){
    const cta=String(form.ctaUrl||'').trim();
    if(cta && !/^https?:\/\//i.test(cta)){
      setError('O link do orçamento precisa começar com http:// ou https://.');
      setMessage('');
      return;
    }
    const invalidSocial=Object.entries(form.socialLinks||{}).find(([,value])=>{
      const link=String(value||'').trim();
      return link && !/^https?:\/\//i.test(link);
    });
    if(invalidSocial){
      setError('Os links das redes sociais precisam começar com http:// ou https://.');
      setMessage('');
      return;
    }
    try{
      setSaving(true);
      setError('');
      setMessage('');
      const row=await savePublicPortfolioSettings(organizationId,form);
      setForm({
        publicSlug:row.public_slug||'argos',
        profileName:row.profile_name||'Argos',
        profileUsername:row.profile_username||'@argosmarketing',
        avatarUrl:row.avatar_url||'',
        bio:row.bio||'',
        ctaText:row.cta_text||'Solicitar orçamento',
        ctaUrl:row.cta_url||'',
        socialLinks:{
          whatsapp:row.social_links?.whatsapp||'',
          instagram:row.social_links?.instagram||'',
          youtube:row.social_links?.youtube||'',
          tiktok:row.social_links?.tiktok||'',
          linkedin:row.social_links?.linkedin||'',
          facebook:row.social_links?.facebook||'',
          site:row.social_links?.site||'',
        },
        active:row.active!==false,
      });
      setMessage('Configurações do portfólio público salvas.');
      notifySettingsSaved('Portfólio público salvo');
    }catch(err){
      setError(err.message||'Não foi possível salvar as configurações.');
    }finally{
      setSaving(false);
    }
  }

  if(loading) return <div className="settings-section"><div className="panel public-portfolio-settings"><p>Carregando configurações...</p></div></div>;

  return <div className="settings-section"><div className="panel public-portfolio-settings">
    <div className="public-portfolio-settings-head">
      <div><p>Configure o perfil público da Argos. Os trabalhos em Pronto aparecem automaticamente, inclusive os arquivados.</p></div>
      <label className="public-portfolio-active"><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/><span>Portfólio ativo</span></label>
    </div>
    {error&&<div className="cloud-error">{error}</div>}
    {message&&<div className="public-portfolio-success">{message}</div>}
    <div className="public-portfolio-profile-row">
      <div className="public-portfolio-avatar-preview"><AvatarMini value={form.avatarUrl} label={form.profileName}/></div>
      <div className="public-portfolio-avatar-fields"><label>Foto do perfil<input value={form.avatarUrl} onChange={e=>set('avatarUrl',e.target.value)} placeholder="URL, link do Drive ou upload"/></label><input type="file" accept="image/*" onChange={uploadAvatar}/></div>
    </div>
    <div className="form-two"><label>Nome do perfil<input value={form.profileName} onChange={e=>set('profileName',e.target.value)} placeholder="Argos"/></label><label>Usuário público<input value={form.profileUsername} onChange={e=>set('profileUsername',e.target.value)} placeholder="@argosmarketing"/></label></div>
    <label>Bio<textarea value={form.bio} onChange={e=>set('bio',e.target.value)} placeholder="Apresente a Argos em poucas linhas."/></label>
    <div className="form-two"><label>Texto do botão<input value={form.ctaText} onChange={e=>set('ctaText',e.target.value)} placeholder="Solicitar orçamento"/></label><label>Link do orçamento<input value={form.ctaUrl} onChange={e=>set('ctaUrl',e.target.value)} placeholder="https://wa.me/..."/></label></div>
    <div className="public-portfolio-social-settings">
      <h3>Redes sociais</h3>
      <p>Somente redes com link preenchido aparecem no portfólio público.</p>
      <div className="form-two">
        <label>WhatsApp<input value={form.socialLinks?.whatsapp||''} onChange={e=>setSocial('whatsapp',e.target.value)} placeholder="https://wa.me/..."/></label>
        <label>Instagram<input value={form.socialLinks?.instagram||''} onChange={e=>setSocial('instagram',e.target.value)} placeholder="https://instagram.com/..."/></label>
        <label>YouTube<input value={form.socialLinks?.youtube||''} onChange={e=>setSocial('youtube',e.target.value)} placeholder="https://youtube.com/..."/></label>
        <label>TikTok<input value={form.socialLinks?.tiktok||''} onChange={e=>setSocial('tiktok',e.target.value)} placeholder="https://tiktok.com/@..."/></label>
        <label>LinkedIn<input value={form.socialLinks?.linkedin||''} onChange={e=>setSocial('linkedin',e.target.value)} placeholder="https://linkedin.com/..."/></label>
        <label>Facebook<input value={form.socialLinks?.facebook||''} onChange={e=>setSocial('facebook',e.target.value)} placeholder="https://facebook.com/..."/></label>
        <label>Site<input value={form.socialLinks?.site||''} onChange={e=>setSocial('site',e.target.value)} placeholder="https://..."/></label>
      </div>
    </div>
    <label>Endereço público<input value={form.publicSlug} disabled/><small>Endereço usado pela página pública do portfólio.</small></label>
    <div className="row-actions"><button className="primary" onClick={saveSettings} disabled={saving||!organizationId}>{saving?'Salvando...':'Salvar portfólio público'}</button></div>
  </div></div>
}

function AppearanceSettings({system,setSystem}){
  const [f,setF]=useState({...system,accentColor:normalizeAccentColor(system?.accentColor)});
  useEffect(()=>{setF({...system,accentColor:normalizeAccentColor(system?.accentColor)});},[system]);
  const set=(k,v)=>setF({...f,[k]:v});
  const saveAppearance=()=>{
    const next={...f,accentColor:normalizeAccentColor(f.accentColor)};
    setF(next);
    setSystem(next);
    applySystemAccent(next.accentColor);
    notifySettingsSaved('Aparência salva');
  };
  return <div className="settings-section"><div className="panel general-panel appearance-panel">
    <h3>Geral</h3>
    <label className="appearance-system-name"><strong>Nome do sistema</strong><input value={f.title||''} onChange={e=>{set('title',e.target.value);set('loginTitle',e.target.value)}} placeholder="Painel de Aprovação"/><small>Esse é o nome do sistema: aparece na tela de login e no painel (aba do navegador e menu lateral).</small></label>
    <h3>Identidade visual</h3>
    <label>Cor de destaque<div className="appearance-accent-control"><input className="appearance-color-input" type="color" value={normalizeAccentColor(f.accentColor)} onChange={e=>set('accentColor',e.target.value)}/><input className="appearance-color-text" value={f.accentColor||''} onChange={e=>set('accentColor',e.target.value)} onBlur={()=>set('accentColor',normalizeAccentColor(f.accentColor))} placeholder="#cbae6c"/></div><small>Usada em abas ativas, botões principais, gráficos e outros destaques institucionais. Cores funcionais de status e urgência não são alteradas.</small></label>
    <label>Logo do sistema<input value={f.logo||''} onChange={e=>set('logo',e.target.value)} placeholder="URL, link do Drive ou upload"/><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,v=>set('logo',v),'system/logo')}/></label>
    <label>Favicon do navegador<input value={f.favicon||''} onChange={e=>set('favicon',e.target.value)} placeholder="URL, link do Drive ou upload"/><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,v=>set('favicon',v),'system/favicon')}/><small>Ícone pequeno que aparece na aba do navegador.</small></label>
    <h3>Tela de login</h3>
    <label>Texto de apoio da tela de login<input value={f.loginSubtitle||''} onChange={e=>set('loginSubtitle',e.target.value)} placeholder="Entre com seu acesso."/></label>
    <label>Logo da tela de login<input value={f.loginLogo||''} onChange={e=>set('loginLogo',e.target.value)} placeholder="URL, link do Drive ou upload. Se vazio, usa a logo do sistema."/><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,v=>set('loginLogo',v),'system/login')}/></label>
    <div className="row-actions"><button onClick={()=>{setF({...system,accentColor:normalizeAccentColor(system?.accentColor)});applySystemAccent(system?.accentColor);}}>Cancelar</button><button className="primary" onClick={saveAppearance}>Salvar aparência</button></div>
  </div></div>
}


function ApprovalReminderSettings({currentUser,statuses}){
  const organizationId=currentUser?.organizationId;
  const [form,setForm]=useState({enabled:true,statusKeys:['aprovacao'],firstDayAfter:1,intervalDays:2});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    let alive=true;
    if(!organizationId){ setLoading(false); setError('Organização não identificada.'); return ()=>{alive=false}; }
    (async()=>{
      try{
        setLoading(true); setError('');
        const data=await loadApprovalReminderSettings(organizationId);
        if(alive) setForm(data);
      }catch(err){ if(alive) setError(err.message||'Não foi possível carregar as configurações.'); }
      finally{ if(alive) setLoading(false); }
    })();
    return()=>{alive=false};
  },[organizationId]);

  function toggleStatus(key){
    setForm(prev=>{
      const has=(prev.statusKeys||[]).includes(key);
      const next=has?prev.statusKeys.filter(k=>k!==key):[...(prev.statusKeys||[]),key];
      return {...prev,statusKeys:next};
    });
  }

  async function save(){
    if(!(form.statusKeys||[]).length){ setError('Selecione pelo menos um status.'); setMessage(''); return; }
    try{
      setSaving(true); setError(''); setMessage('');
      const saved=await saveApprovalReminderSettings(organizationId,form);
      setForm(saved);
      setMessage('Configurações de lembrete salvas.');
      notifySettingsSaved('Lembretes de aprovação salvos');
    }catch(err){ setError(err.message||'Não foi possível salvar as configurações.'); }
    finally{ setSaving(false); }
  }

  if(loading) return <div className="settings-section"><div className="panel"><p>Carregando configurações...</p></div></div>;

  return <div className="settings-section"><div className="panel approval-reminder-settings">
    <div className="public-portfolio-settings-head">
      <div><p>Controla o lembrete automático (push) enviado ao cliente quando um post fica parado num status. A equipe/admin recebe notificação instantânea à parte, espelhando o sino interno, sem precisar de configuração aqui.</p></div>
      <label className="public-portfolio-active"><input type="checkbox" checked={form.enabled} onChange={e=>setForm(prev=>({...prev,enabled:e.target.checked}))}/><span>Lembretes ativos</span></label>
    </div>
    {error&&<div className="cloud-error">{error}</div>}
    {message&&<div className="public-portfolio-success">{message}</div>}
    <h3>Status que geram lembrete</h3>
    <div className="checks one-col compact-checks-v3">
      {(statuses||[]).map(s=><label key={s.id}><input type="checkbox" checked={(form.statusKeys||[]).includes(s.id)} onChange={()=>toggleStatus(s.id)}/>{s.name}</label>)}
    </div>
    <div className="form-two">
      <label>Primeiro lembrete após (dias)<input type="number" min="0" value={form.firstDayAfter} onChange={e=>setForm(prev=>({...prev,firstDayAfter:e.target.value}))}/></label>
      <label>Repetir a cada (dias)<input type="number" min="1" value={form.intervalDays} onChange={e=>setForm(prev=>({...prev,intervalDays:e.target.value}))}/></label>
    </div>
    <small className="muted">Exemplo: primeiro lembrete 1 dia depois de entrar no status, repetindo a cada 2 dias — dias 1, 3, 5, 7... enquanto o post não sair do status escolhido.</small>
    <div className="row-actions"><button className="primary" onClick={save} disabled={saving||!organizationId}>{saving?'Salvando...':'Salvar lembretes'}</button></div>
  </div></div>
}

const DEFAULT_DOCUMENT_FOLDERS = ['Clientes','Funcionários','Financeiro','Processos','Modelos','Interno'];
function isFolderMarker(d){ return d?.documentKind==='folder'; }
function normalizeFolderName(name){ return String(name||'').trim().replace(/\s+/g,' '); }
function folderMarker(name,currentUser,patch={}){
  const folderName=normalizeFolderName(name)||'Nova pasta';
  return {id:safeUUID(),documentKind:'folder',folderName,title:folderName,folder:folderName,archived:false,deleted:false,createdAt:now(),updatedAt:now(),createdBy:currentUser?.id||'',updatedBy:currentUser?.id||'',...patch};
}
function documentFolders(documents){
  const folderState=new Map();
  (documents||[]).forEach(d=>{
    if(!isFolderMarker(d)) return;
    const name=normalizeFolderName(d.folderName||d.folder||d.title);
    if(name && !folderState.has(name)) folderState.set(name,{deleted:!!d.deleted,archived:!!d.archived,order:Number.isFinite(d.order)?d.order:null});
  });
  const names=[...DEFAULT_DOCUMENT_FOLDERS];
  (documents||[]).forEach(d=>{
    if(isFolderMarker(d)){
      const name=normalizeFolderName(d.folderName||d.folder||d.title);
      const state=folderState.get(name);
      if(name && state && !state.deleted && !state.archived) names.push(name);
    }else if(!d.archived && d.folder){
      names.push(normalizeFolderName(d.folder));
    }
  });
  const unique=[...new Set(names.filter(Boolean).filter(name=>{
    const state=folderState.get(name);
    return !(state?.deleted || state?.archived);
  }))];
  const defaultIndex=new Map(DEFAULT_DOCUMENT_FOLDERS.map((name,i)=>[name,i]));
  return unique.sort((a,b)=>{
    const ao=folderState.get(a)?.order;
    const bo=folderState.get(b)?.order;
    if(Number.isFinite(ao) || Number.isFinite(bo)) return (Number.isFinite(ao)?ao:9999)-(Number.isFinite(bo)?bo:9999);
    return (defaultIndex.has(a)?defaultIndex.get(a):9999)-(defaultIndex.has(b)?defaultIndex.get(b):9999) || a.localeCompare(b,'pt-BR');
  });
}
function blankDocument(currentUser){
  return {
    id:safeUUID(),
    title:'Novo documento',
    folder:'Clientes',
    type:'Informações gerais',
    linkType:'general',
    targetId:'',
    content:'',
    archived:false,
    createdAt:now(),
    updatedAt:now(),
    createdBy:currentUser?.id || '',
    updatedBy:currentUser?.id || ''
  };
}
function DocumentsPage({documents,setDocuments,companies,users,tasks,statuses,currentUser}){
  const permissions={...builtInDocumentPermissionsForRole(currentUser?.role),...(currentUser?.documentPermissions||{})};
  const visibleDocs=(documents||[]).filter(d=>!d.archived&&!isFolderMarker(d));
  const folders=documentFolders(documents);
  const [selected,setSelected]=useState(visibleDocs[0]?.id||documents.find(d=>!isFolderMarker(d))?.id||null);
  const [q,setQ]=useState('');
  const [openFolders,setOpenFolders]=useState(()=>Object.fromEntries(folders.map(f=>[f,true])));
  const [creatingFolder,setCreatingFolder]=useState(false);
  const [folderDraft,setFolderDraft]=useState('');
  const doc=documents.find(d=>!isFolderMarker(d)&&d.id===selected)||visibleDocs[0]||null;

  useEffect(()=>{
    if(!doc&&visibleDocs[0]) setSelected(visibleDocs[0].id);
  },[documents.length]);

  function createDoc(folder='Clientes'){
    if(!permissions.canCreateDocuments) return;
    const safeFolder=normalizeFolderName(folder)||folders[0]||'Clientes';
    const folderDocs=visibleDocs.filter(d=>(d.folder||'Clientes')===safeFolder);
    const next={...blankDocument(currentUser),folder:safeFolder,order:folderDocs.length};
    setDocuments(prev=>[next,...(prev||[])]);
    setSelected(next.id);
    setOpenFolders(prev=>({...prev,[safeFolder]:true}));
  }

  function createFolder(nameValue){
    if(!permissions.canCreateFolders) return false;
    const name=normalizeFolderName(nameValue);
    if(!name) return false;
    if(folders.some(f=>f.toLowerCase()===name.toLowerCase())){alert('Essa pasta já existe.');return false;}
    setDocuments(prev=>[folderMarker(name,currentUser,{order:folders.length}),...(prev||[])]);
    setOpenFolders(prev=>({...prev,[name]:true}));
    return true;
  }

  function commitFolderDraft(){
    if(createFolder(folderDraft)){
      setFolderDraft('');
      setCreatingFolder(false);
    }
  }

  function deleteFolder(folder){
    if(!permissions.canDeleteFolders) return;
    const safeFolder=normalizeFolderName(folder);
    const docsInFolder=visibleDocs.filter(d=>(d.folder||'Clientes')===safeFolder);
    const msg=docsInFolder.length?`Excluir a pasta "${safeFolder}" e arquivar ${docsInFolder.length} documento(s) dentro dela?`:`Excluir a pasta "${safeFolder}"?`;
    if(!confirm(msg)) return;
    const deletedMarker=folderMarker(safeFolder,currentUser,{archived:true,deleted:true,order:folders.indexOf(safeFolder)});
    setDocuments(prev=>{
      const hasMarker=(prev||[]).some(d=>isFolderMarker(d)&&normalizeFolderName(d.folderName||d.folder||d.title)===safeFolder);
      const next=(prev||[]).map(d=>{
        if(isFolderMarker(d)&&normalizeFolderName(d.folderName||d.folder||d.title)===safeFolder) return {...d,archived:true,deleted:true,updatedAt:now(),updatedBy:currentUser?.id||d.updatedBy};
        if(!isFolderMarker(d)&&(d.folder||'Clientes')===safeFolder) return {...d,archived:true,updatedAt:now(),updatedBy:currentUser?.id||d.updatedBy};
        return d;
      });
      return hasMarker?next:[deletedMarker,...next];
    });
    if(doc&&(doc.folder||'Clientes')===safeFolder){
      const next=visibleDocs.find(d=>(d.folder||'Clientes')!==safeFolder);
      setSelected(next?.id||null);
    }
  }

  function moveFolder(folder,dir){
    if(!permissions.canReorder) return;
    const idx=folders.indexOf(folder);
    const nextIdx=idx+dir;
    if(idx<0||nextIdx<0||nextIdx>=folders.length) return;
    const ordered=[...folders];
    [ordered[idx],ordered[nextIdx]]=[ordered[nextIdx],ordered[idx]];
    setDocuments(prev=>{
      const previous=prev||[];
      const markerByName=new Map(previous.filter(isFolderMarker).map(d=>[normalizeFolderName(d.folderName||d.folder||d.title),d]));
      const without=previous.filter(d=>!(isFolderMarker(d)&&ordered.includes(normalizeFolderName(d.folderName||d.folder||d.title))));
      const markers=ordered.map((name,i)=>{
        const old=markerByName.get(name);
        return {...(old||folderMarker(name,currentUser)),id:old?.id||safeUUID(),documentKind:'folder',folderName:name,title:name,folder:name,archived:false,deleted:false,order:i,updatedAt:now(),updatedBy:currentUser?.id||old?.updatedBy||''};
      });
      return [...markers,...without];
    });
  }

  function patchDoc(id,patch){
    setDocuments(prev=>(prev||[]).map(d=>d.id===id?{...d,...patch,updatedAt:now(),updatedBy:currentUser?.id||d.updatedBy}:d));
  }

  function deleteDoc(id){
    if(!permissions.canDeleteDocuments) return;
    if(!confirm('Excluir este documento? Esta ação remove o documento da lista.')) return;
    setDocuments(prev=>(prev||[]).filter(d=>d.id!==id));
    const next=visibleDocs.find(d=>d.id!==id);
    setSelected(next?.id||null);
  }

  function moveDoc(id,folder,dir){
    if(!permissions.canReorder) return;
    const orderedDocs=visibleDocs.filter(d=>(d.folder||'Clientes')===folder).sort((a,b)=>(a.order??9999)-(b.order??9999));
    const idx=orderedDocs.findIndex(d=>d.id===id);
    const nextIdx=idx+dir;
    if(idx<0||nextIdx<0||nextIdx>=orderedDocs.length) return;
    const next=[...orderedDocs];
    [next[idx],next[nextIdx]]=[next[nextIdx],next[idx]];
    const orderMap=new Map(next.map((d,i)=>[d.id,i]));
    setDocuments(prev=>(prev||[]).map(d=>orderMap.has(d.id)?{...d,order:orderMap.get(d.id),updatedAt:now(),updatedBy:currentUser?.id||d.updatedBy}:d));
  }

  const query=permissions.showSearch?(q||'').trim().toLowerCase():'';
  const baseOrder=new Map((documents||[]).map((d,i)=>[d.id,i]));
  const filteredDocs=visibleDocs.filter(d=>{
    if(!query) return true;
    const target=d.linkType==='company'?companies.find(c=>c.id===d.targetId)?.name:d.linkType==='user'?users.find(u=>u.id===d.targetId)?.name:'Geral';
    return `${d.title||''} ${d.folder||''} ${target||''} ${d.content||''}`.toLowerCase().includes(query);
  });
  const grouped=folders.map(folder=>({folder,docs:filteredDocs.filter(d=>(d.folder||'Clientes')===folder).sort((a,b)=>((a.order??9999)-(b.order??9999))||((baseOrder.get(a.id)||0)-(baseOrder.get(b.id)||0)))}));

  return <section className="documents-page docs-clickup-shell">
    <PanelTabsHeader title="Documentos" className="docs-topbar"/>
    <div className="docs-workspace">
      {doc?<DocumentEditor doc={doc} patchDoc={patchDoc} deleteDoc={deleteDoc} folders={folders} companies={companies} users={users} permissions={permissions}/>:<div className="docs-empty-editor"><h2>Nenhum documento</h2><p>{permissions.canCreateDocuments?'Crie uma pasta e depois um documento para começar.':'Nenhum documento disponível.'}</p></div>}

      {permissions.showFolders&&<aside className="docs-sidebar">
        <div className="docs-sidebar-head"><b>Arquivos</b>{permissions.showSearch&&<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar..."/>}</div>
        <div className="docs-folder-list">{grouped.map((group,folderIndex)=>{
          const isOpen=openFolders[group.folder]!==false;
          return <div className="docs-folder" key={group.folder}>
            <div className="docs-folder-row">
              <button className="docs-folder-toggle" onClick={()=>setOpenFolders(prev=>({...prev,[group.folder]:!isOpen}))}>{isOpen?'▾':'▸'}</button>
              <button className="docs-folder-name" onClick={()=>setOpenFolders(prev=>({...prev,[group.folder]:!isOpen}))}>{group.folder}</button>
              {permissions.canReorder&&<><button className="docs-folder-move" disabled={folderIndex===0} title="Subir pasta" onClick={()=>moveFolder(group.folder,-1)}>↑</button><button className="docs-folder-move" disabled={folderIndex===folders.length-1} title="Descer pasta" onClick={()=>moveFolder(group.folder,1)}>↓</button></>}
              {permissions.canCreateDocuments&&<button className="docs-folder-add" title="Novo documento nesta pasta" onClick={()=>createDoc(group.folder)}>+</button>}
              {permissions.canDeleteFolders&&<button className="docs-folder-delete" title="Excluir pasta" onClick={()=>deleteFolder(group.folder)}>×</button>}
            </div>
            {isOpen&&<div className="docs-page-list">{group.docs.length?group.docs.map((d,docIndex)=><div key={d.id} className={'docs-page-row '+(doc?.id===d.id?'active':'')}>
              <button className="docs-page-item" disabled={!permissions.canOpenDocuments} onClick={()=>permissions.canOpenDocuments&&setSelected(d.id)}><span>{d.title||'Sem título'}</span></button>
              {permissions.canReorder&&<><button className="docs-doc-move" disabled={docIndex===0} title="Subir documento" onClick={()=>moveDoc(d.id,group.folder,-1)}>↑</button><button className="docs-doc-move" disabled={docIndex===group.docs.length-1} title="Descer documento" onClick={()=>moveDoc(d.id,group.folder,1)}>↓</button></>}
            </div>):<small className="docs-folder-empty">Sem documentos</small>}</div>}
          </div>;
        })}</div>

        {permissions.canCreateFolders&&(creatingFolder?<div className="docs-new-folder-inline"><input autoFocus value={folderDraft} onChange={e=>setFolderDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')commitFolderDraft();if(e.key==='Escape'){setCreatingFolder(false);setFolderDraft('');}}} placeholder="Nome da pasta"/><button onClick={commitFolderDraft}>Criar</button><button onClick={()=>{setCreatingFolder(false);setFolderDraft('')}}>×</button></div>:<button className="docs-new-folder" onClick={()=>setCreatingFolder(true)}>+ Nova pasta</button>)}
      </aside>}
    </div>
  </section>;
}

function DocumentEditor({doc,patchDoc,deleteDoc,folders,companies,users,permissions}){
  const [metaOpen,setMetaOpen]=useState(false);
  const linkedOptions=doc.linkType==='company'?companies.filter(c=>c.active!==false):doc.linkType==='user'?users.filter(u=>u.active!==false&&u.role!=='client'):[];
  const linkedTarget=doc.linkType==='company'?companies.find(c=>c.id===doc.targetId):doc.linkType==='user'?users.find(u=>u.id===doc.targetId):null;
  const linkedAvatar=doc.linkType==='company'?linkedTarget?.logo:linkedTarget?.avatar;
  const linkedLabel=doc.linkType==='company'?'Empresa/cliente':doc.linkType==='user'?'Funcionário':'Sem vínculo';

  return <main className="docs-editor">
    <div className="docs-editor-head">
      <div className="docs-title-block">
        {permissions.canEditTitle
          ? <input className="docs-title-input" value={doc.title||''} onChange={e=>patchDoc(doc.id,{title:e.target.value})} placeholder="Título do documento"/>
          : <h2>{doc.title||'Sem título'}</h2>
        }
        <div className="docs-breadcrumb"><span>{doc.folder||'Clientes'}</span><span>•</span><span>Atualizado em {doc.updatedAt?new Date(doc.updatedAt).toLocaleString('pt-BR'):'agora'}</span></div>
        {permissions.showLinkedEntity&&linkedTarget&&<div className="docs-linked-card"><AvatarMini value={linkedAvatar} label={linkedTarget.name}/><div><small>{linkedLabel}</small><b>{linkedTarget.name}</b></div></div>}
      </div>
      {permissions.canEditMetadata&&<div className="docs-actions"><button onClick={()=>setMetaOpen(v=>!v)}>{metaOpen?'Ocultar configurações':'Configurações'}</button></div>}
    </div>

    {metaOpen&&permissions.canEditMetadata&&<div className="docs-meta-panel">
      <div className="form-two">
        <label>Pasta<select value={doc.folder||'Clientes'} onChange={e=>patchDoc(doc.id,{folder:e.target.value})}>{folders.map(f=><option key={f}>{f}</option>)}</select></label>
        <label>Vincular a<select value={doc.linkType||'general'} onChange={e=>patchDoc(doc.id,{linkType:e.target.value,targetId:''})}><option value="general">Geral / sem vínculo</option><option value="company">Empresa/cliente</option><option value="user">Funcionário</option></select></label>
      </div>
      {doc.linkType!=='general'&&<label>{doc.linkType==='user'?'Funcionário':'Empresa/cliente'}<select value={doc.targetId||''} onChange={e=>patchDoc(doc.id,{targetId:e.target.value})}><option value="">Selecione</option>{linkedOptions.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
      {permissions.canDeleteDocuments&&<div className="danger-zone"><h3>Documento</h3><p>Use apenas se tiver certeza. Esta ação remove o documento da biblioteca.</p><button onClick={()=>deleteDoc(doc.id)}>Excluir documento</button></div>}
    </div>}

    {permissions.canEditContent
      ? <RichTextField className="docs-rich-text-field" value={doc.content||''} onChange={e=>patchDoc(doc.id,{content:e.target.value})} placeholder="Escreva aqui briefing, acessos, preferências, combinados, observações internas..." minHeight="45vh"/>
      : <div className="docs-content-editor" style={{whiteSpace:'pre-wrap',overflow:'auto'}}>{doc.content?<RichTextDisplay value={doc.content}/>:<>Sem conteúdo.</>}</div>
    }
  </main>;
}


function NotificationsPage({notifications,setNotifications,open,tasks,companies,users,statuses,user,alertsEnabled,notificationPermission,enableAlerts}){ 
  const permissions={...builtInNotificationPanelPermissionsForRole(user?.role),...(user?.notificationPanelPermissions||{})};
  const [tab,setTab]=useState('open'); 
  const scoped=notifications.filter(n=>(!n.userId||n.userId===user.id));
  const effectiveTab=permissions.showTabs?tab:'open';
  const list=scoped.filter(n=>effectiveTab==='done'?n.done:!n.done); 
  const doneCount=scoped.filter(n=>n.done).length;
  const openCount=scoped.filter(n=>!n.done).length;
  function done(id){ if(!permissions.canComplete)return; setNotifications(prev=>prev.map(n=>n.id===id?{...n,done:true}:n)); }
  function doneAll(){
    if(!permissions.canCompleteAll||!openCount)return;
    if(!confirm(`Concluir ${openCount} notificação${openCount===1?'':'ões'} pendente${openCount===1?'':'s'}?`))return;
    setNotifications(prev=>prev.map(n=>(!n.userId||n.userId===user.id)&&!n.done?{...n,done:true}:n));
  }
  function clearDone(){
    if(!permissions.canDeleteCompleted||!doneCount) return;
    if(!confirm(`Limpar ${doneCount} notificação${doneCount===1?' concluída':' concluídas'}?`)) return;
    setNotifications(prev=>prev.filter(n=>!(n.done && (!n.userId || n.userId===user.id))));
  }
  function escapeRegExp(value){ return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function stripEmbeddedMeta(value,author){
    const raw=String(value||'').trim();
    const name=String(author||'').trim();
    if(!raw||!name) return raw;
    const prefix=new RegExp(`^${escapeRegExp(name)}\\s+\\d{1,2}\\/\\d{1,2}\\/\\d{4}(?:,)?\\s+\\d{1,2}:\\d{2}(?::\\d{2})?\\s*`,'i');
    return raw.replace(prefix,'').trim();
  }
  function closestLog(task,n,content){
    const logs=Array.isArray(task?.logs)?task.logs:[];
    const notificationTime=new Date(n.at).getTime();
    const preferredType=n.event==='Comentário na tarefa'?'comment':n.event==='Status da tarefa'?'status':null;
    const candidates=logs.filter(log=>!preferredType||log.type===preferredType);
    if(!candidates.length) return null;
    const normalized=String(content||'').trim();
    return [...candidates].sort((a,b)=>{
      const aText=String(a.text||'').trim();
      const bText=String(b.text||'').trim();
      const aMatch=normalized&&(aText===normalized||aText.endsWith(normalized))?0:1;
      const bMatch=normalized&&(bText===normalized||bText.endsWith(normalized))?0:1;
      if(aMatch!==bMatch) return aMatch-bMatch;
      return Math.abs(new Date(a.at).getTime()-notificationTime)-Math.abs(new Date(b.at).getTime()-notificationTime);
    })[0]||null;
  }
  function notificationInfo(n){
    const task=(tasks||[]).find(t=>t.id===n.taskId);
    if(!task) return {content:n.text||''};
    const rawText=String(n.text||'').trim();
    const currentPrefix=`${task.title}:`;
    const withoutTitle=rawText.startsWith(currentPrefix)
      ? rawText.slice(currentPrefix.length).trim()
      : rawText.replace(/^[^:\n]{1,160}:\s*/, '').trim();
    const exactLogId=n.logId||n.payload?.logId||null;
    const exactLog=exactLogId?(task.logs||[]).find(log=>String(log.id)===String(exactLogId)):null;
    const sourceLog=exactLog||closestLog(task,n,withoutTitle);
    const actorId=n.actorId||n.payload?.actorId||sourceLog?.userId||null;
    const actor=(users||[]).find(u=>u.id===actorId);
    const actorName=n.actorName||n.payload?.actorName||actor?.name||sourceLog?.user||'';
    const actorRole=n.actorRole||n.payload?.actorRole||actor?.role||sourceLog?.role||'';
    return {
      task,
      content:stripEmbeddedMeta(withoutTitle,actorName),
      actor,
      actorName,
      actorRole,
      originIsClient: actorRole==='client',
      company:(companies||[]).find(c=>c.id===task.companyId),
      responsible:(users||[]).find(u=>u.id===task.responsibleId),
      status:(statuses||[]).find(s=>s.id===task.status),
      postDate:task.postDate||'',
      deadline:task.internalDate||''
    };
  }
  function deadlineColor(date){
    const colors={late:'#ef4444',hot:'#f97316',warn:'#eab308',ok:'#22c55e',neutral:'#8b8b8b'};
    return colors[priorityClass(date)]||colors.neutral;
  }
  function softColor(color,alpha){
    const value=String(color||'');
    return /^#[0-9a-f]{6}$/i.test(value)?`${value}${alpha}`:'rgba(255,255,255,.05)';
  }
  const preparedNotifications=list.map(n=>({n,info:notificationInfo(n)}));
  const notificationGroups=preparedNotifications.reduce((groups,item)=>{
    const companyKey=item.info.task?.companyId||item.info.company?.id||'sem-empresa';
    const previous=groups[groups.length-1];
    if(previous&&previous.companyKey===companyKey) previous.items.push(item);
    else groups.push({companyKey,items:[item]});
    return groups;
  },[]);
  return <section><PanelTabsHeader title="Notificações" tabs={permissions.showTabs?[["open","Pendentes"],["done","Concluídas"]]:[]} active={effectiveTab} onChange={setTab}/>
    <div className="filters notification-top-controls">
      {effectiveTab==='open'&&permissions.canCompleteAll&&<button onClick={doneAll} disabled={!openCount}>Concluir todas</button>}
      {effectiveTab==='done'&&permissions.canDeleteCompleted&&<button onClick={clearDone} disabled={!doneCount}>Limpar concluídas</button>}
    </div>
    <div className="notifications-list">{list.length?notificationGroups.map((group,groupIndex)=><div className="panel notification-company-group" key={`${group.companyKey}-${groupIndex}`}>
      {group.items.map(({n,info})=>{const deadlineTone=deadlineColor(info.deadline);const statusTone=info.status?.color||'#8b8b8b';const canOpenRow=!!(permissions.canOpenTasks&&info.task);return <div className={'notification-item notification-list-row'+(canOpenRow?' is-clickable':'')+(info.originIsClient?' is-client-origin':'')} key={n.id} role={canOpenRow?'button':undefined} tabIndex={canOpenRow?0:undefined} onClick={canOpenRow?()=>open(n.taskId):undefined} onKeyDown={canOpenRow?(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(n.taskId);}}:undefined}>
      <span className="notification-leading-action">
        {!n.done&&permissions.canComplete&&<button type="button" className="notification-complete-x" aria-label="Concluir notificação" title="Concluir notificação" onClick={event=>{event.stopPropagation();done(n.id);}}>×</button>}
      </span>
      <div className="notification-list-main">
        <div className="notification-copy">
          <div className="notification-copy-line notification-copy-head">
            {info.task&&<b title={info.task.title}>{info.task.title}</b>}
            {permissions.showDateTime&&<small>{new Date(n.at).toLocaleString('pt-BR')}</small>}
          </div>
          <div className="notification-copy-line notification-copy-message" title={`${info.actorName?`${info.actorName}: `:''}${info.content||''}`}>
            {info.actorName&&<strong>{info.actorName}: </strong>}
            <span>{info.content}</span>
          </div>
        </div>
      </div>
      <div className="notification-list-meta">
        {permissions.showCompany&&<span className="notification-company-avatar" title={`Empresa: ${info.company?.name||'Sem empresa'}`}>{info.company&&<AvatarMini value={info.company.logo} label={info.company.name}/>}</span>}
        {permissions.showResponsible&&<span className="notification-responsible" title={`Responsável: ${info.responsible?.name||'Sem responsável'}`}>{info.responsible&&<AvatarMini value={info.responsible.avatar} label={info.responsible.name}/>}</span>}
        {permissions.showStatus&&<span className={`notification-status${info.status?'':' meta-empty'}`} style={info.status?{color:statusTone,background:softColor(statusTone,'18'),borderColor:softColor(statusTone,'66')}:undefined}>{info.status?.name||''}</span>}
        {permissions.showDeadline&&<span className={`notification-deadline${info.deadline?'':' meta-empty'}`} style={info.deadline?{color:deadlineTone,background:softColor(deadlineTone,'18'),borderColor:softColor(deadlineTone,'66')}:undefined}>{info.deadline?fmtDate(info.deadline):''}</span>}
        {permissions.showPostDate&&<span className="notification-postdate">{info.postDate?fmtDate(info.postDate):'Sem data'}</span>}
      </div>
    </div>})}
    </div>):<div className="panel notification-empty-state">
      <div className="notification-empty-icon" aria-hidden="true">✓</div>
      <p>Nenhuma notificação pendente para você, <strong>{String(user?.name||'Argonauta').trim().split(/\s+/)[0]}</strong>.</p>
      <strong className="notification-empty-congrats">Excelente trabalho, Argonauta!</strong>
    </div>}</div>
  </section> 
}


createRoot(document.getElementById('root')).render(<RootApp/>);



