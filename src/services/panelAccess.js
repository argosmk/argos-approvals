// Extraído do main.jsx (Fase 2): catálogos de painéis/permissões e
// funções puras de roteamento e acesso por perfil (admin/team/client).
// Nenhuma dependência de React, hooks ou Supabase — apenas dados e lógica pura.

export function parsePublicPortfolioRoute(){
  if(typeof window==='undefined') return null;
  const pathParts=String(window.location.pathname||'/').split('/').filter(Boolean).map(part=>decodeURIComponent(part));
  if(pathParts[0]==='portfolio') return {slug:pathParts[1]||'argos',legacy:false};
  const hashParts=String(window.location.hash||'').replace(/^#\/?/,'').split('/').filter(Boolean).map(part=>decodeURIComponent(part));
  if(hashParts[0]==='portfolio-publico') return {slug:hashParts[1]||'argos',legacy:true};
  return null;
}

export const ROUTE_SCREEN_ALIASES = {
  '': 'dashboard',
  '/': 'dashboard',
  dashboard: 'dashboard',
  notifications: 'notifications',
  planning: 'planning',
  calendar: 'calendar',
  kanban: 'kanban',
  tasks: 'tasks',
  portfolios: 'teamhub',
  portfolio: 'teamhub',
  teamhub: 'teamhub',
  documents: 'documents',
  docs: 'documents',
  financial: 'financial',
  financeiro: 'financial',
  settings: 'settings',
};
export const SCREEN_TO_ROUTE = {
  dashboard: 'dashboard',
  notifications: 'notifications',
  planning: 'planning',
  calendar: 'calendar',
  kanban: 'kanban',
  tasks: 'tasks',
  teamhub: 'portfolios',
  documents: 'documents',
  financial: 'financeiro',
  settings: 'settings',
};

// Round155A: catálogo central de painéis.
// Fundação invisível para permissões futuras, preservando integralmente
// a ordem e os acessos atuais de Admin, Equipe e Cliente.
export const PANEL_CATALOG = Object.freeze([
  Object.freeze({ id:'dashboard', label:'Dashboard', defaultRoles:['admin','team'] }),
  Object.freeze({ id:'notifications', label:'Notificações', defaultRoles:['admin','team'] }),
  Object.freeze({ id:'planning', label:'Planejamento', defaultRoles:['admin'] }),
  Object.freeze({ id:'calendar', label:'Calendário', defaultRoles:['admin','client'] }),
  Object.freeze({ id:'kanban', label:'Kanban', defaultRoles:['admin','team'] }),
  Object.freeze({ id:'tasks', label:'Listas', defaultRoles:['admin','team'] }),
  Object.freeze({ id:'teamhub', label:'Portfólios', defaultRoles:['admin','team'] }),
  Object.freeze({ id:'documents', label:'Documentos', defaultRoles:['admin'] }),
  Object.freeze({ id:'financial', label:'Financeiro', defaultRoles:['admin'] }),
  Object.freeze({ id:'settings', label:'Configurações', defaultRoles:['admin'] }),
]);

export const SIDEBAR_PANEL_CATALOG = Object.freeze([
  Object.freeze({id:'dashboard',label:'Dashboard'}),
  Object.freeze({id:'notifications',label:'Notificações'}),
  Object.freeze({id:'planning',label:'Planejamento'}),
  Object.freeze({id:'tasks',label:'Tarefas'}),
  Object.freeze({id:'teamhub',label:'Portfólios'}),
  Object.freeze({id:'documents',label:'Documentos'}),
  Object.freeze({id:'financial',label:'Financeiro',adminOnly:true}),
  Object.freeze({id:'settings',label:'Configurações',adminOnly:true}),
]);
export const DEFAULT_SIDEBAR_PANEL_ORDER = SIDEBAR_PANEL_CATALOG.map(panel=>panel.id);

export const DASHBOARD_WIDGETS = Object.freeze([
  Object.freeze({id:'showSummaryTab',label:'Aba Resumo'}),
  Object.freeze({id:'showTeamTab',label:'Aba Equipe',adminOnly:true}),
  Object.freeze({id:'showCompaniesTab',label:'Aba Clientes',adminOnly:true}),
  Object.freeze({id:'showTypesTab',label:'Aba Tipos',adminOnly:true}),
  Object.freeze({id:'showPeriodFilter',label:'Filtro de período'}),
  Object.freeze({id:'showCompanyFilter',label:'Filtro de cliente',adminOnly:true}),
  Object.freeze({id:'showTeamFilter',label:'Filtro de equipe',adminOnly:true}),
  Object.freeze({id:'showTypeFilter',label:'Filtro de tipo de post'}),
  Object.freeze({id:'activeCompanies',label:'Clientes ativos',adminOnly:true}),
  Object.freeze({id:'postCount',label:'Quantidade de posts',teamOnly:true}),
  Object.freeze({id:'periodPosts',label:'Posts no período / finalizados'}),
  Object.freeze({id:'alterations',label:'Alterações'}),
  Object.freeze({id:'reworkRate',label:'Taxa de retrabalho'}),
  Object.freeze({id:'totalTime',label:'Tempo total'}),
  Object.freeze({id:'averagePerPost',label:'Média por post'}),
  Object.freeze({id:'averageEditing',label:'Média em edição'}),
  Object.freeze({id:'averageAlteration',label:'Média em alteração'}),
  Object.freeze({id:'statusChart',label:'Gráfico por status'}),
  Object.freeze({id:'typeChart',label:'Gráfico por tipo'}),
  Object.freeze({id:'companyChart',label:'Gráfico por cliente'}),
  Object.freeze({id:'memberChart',label:'Gráfico por membro',adminOnly:true}),
  Object.freeze({id:'showCargaTab',label:'Aba Carga'}),
]);

export function fullDashboardVisibility(){
  return Object.fromEntries(DASHBOARD_WIDGETS.map(item=>[item.id,true]));
}

export const KANBAN_PERMISSION_ITEMS = Object.freeze([
  Object.freeze({id:'showPeriodFilter',label:'Filtro de período'}),
  Object.freeze({id:'showCompanyFilter',label:'Filtro de empresa'}),
  Object.freeze({id:'showResponsibleFilter',label:'Filtro de responsável'}),
  Object.freeze({id:'showTypeFilter',label:'Filtro de tipo'}),
  Object.freeze({id:'showSort',label:'Ordenação'}),
  Object.freeze({id:'showArchivedToggle',label:'Mostrar arquivadas'}),
  Object.freeze({id:'canOpenTasks',label:'Abrir tarefas'}),
  Object.freeze({id:'showPostDate',label:'Data do post nos cards'}),
  Object.freeze({id:'showDeadline',label:'Prazo nos cards'}),
  Object.freeze({id:'showCompany',label:'Empresa nos cards'}),
  Object.freeze({id:'showResponsible',label:'Responsável nos cards'}),
]);


export const NOTIFICATION_PANEL_PERMISSION_ITEMS = Object.freeze([
  Object.freeze({id:'showTabs',label:'Pendentes e concluídas'}),
  Object.freeze({id:'canEnableAlerts',label:'Ativar som e notificações'}),
  Object.freeze({id:'canOpenTasks',label:'Abrir tarefas'}),
  Object.freeze({id:'canComplete',label:'Concluir notificações'}),
  Object.freeze({id:'canCompleteAll',label:'Concluir todas as pendentes'}),
  Object.freeze({id:'canDeleteCompleted',label:'Limpar notificações concluídas'}),
  Object.freeze({id:'showDateTime',label:'Data e hora'}),
  Object.freeze({id:'showCompany',label:'Empresa'}),
  Object.freeze({id:'showResponsible',label:'Responsável'}),
  Object.freeze({id:'showPostDate',label:'Data do post'}),
  Object.freeze({id:'showDeadline',label:'Prazo'}),
  Object.freeze({id:'showStatus',label:'Status'}),
]);

export function builtInNotificationPanelPermissionsForRole(role){
  if(role==='admin') return Object.fromEntries(NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=>[item.id,true]));
  if(role==='team') return {showTabs:true,canEnableAlerts:true,canOpenTasks:true,canComplete:true,canCompleteAll:true,canDeleteCompleted:false,showDateTime:true,showCompany:true,showResponsible:true,showPostDate:true,showDeadline:true,showStatus:true};
  return {showTabs:true,canEnableAlerts:true,canOpenTasks:true,canComplete:true,canCompleteAll:false,canDeleteCompleted:false,showDateTime:true,showCompany:false,showResponsible:false,showPostDate:true,showDeadline:false,showStatus:true};
}

export const TASKS_LIST_PERMISSION_ITEMS = Object.freeze([
  Object.freeze({id:'showGrouping',label:'Agrupar tarefas'}),
  Object.freeze({id:'showTypeFilter',label:'Filtro por tipo'}),
  Object.freeze({id:'showArchivedToggle',label:'Visualizar arquivadas'}),
  Object.freeze({id:'canSelectTasks',label:'Selecionar tarefas'}),
  Object.freeze({id:'canBulkEdit',label:'Alterar tarefas em massa'}),
  Object.freeze({id:'canBulkArchive',label:'Arquivar em massa'}),
  Object.freeze({id:'canBulkDuplicate',label:'Duplicar em massa'}),
  Object.freeze({id:'canBulkDelete',label:'Excluir em massa'}),
  Object.freeze({id:'canCollapseGroups',label:'Recolher e expandir grupos'}),
  Object.freeze({id:'canOpenTasks',label:'Abrir tarefas'}),
  Object.freeze({id:'showPostDate',label:'Data do post'}),
  Object.freeze({id:'showDeadline',label:'Prazo'}),
  Object.freeze({id:'showStatus',label:'Status'}),
  Object.freeze({id:'showCompany',label:'Empresa'}),
  Object.freeze({id:'showResponsible',label:'Responsável'}),
]);

export function builtInTasksListPermissionsForRole(role){
  if(role==='admin') return Object.fromEntries(TASKS_LIST_PERMISSION_ITEMS.map(item=>[item.id,true]));
  if(role==='team') return {
    showGrouping:true,
    showTypeFilter:true,
    showArchivedToggle:false,
    canSelectTasks:false,
    canBulkEdit:false,
    canBulkArchive:false,
    canBulkDuplicate:false,
    canBulkDelete:false,
    canCollapseGroups:true,
    canOpenTasks:true,
    showPostDate:true,
    showDeadline:true,
    showStatus:true,
    showCompany:true,
    showResponsible:true,
  };
  return {
    showGrouping:true,
    showTypeFilter:true,
    showArchivedToggle:false,
    canSelectTasks:false,
    canBulkEdit:false,
    canBulkArchive:false,
    canBulkDuplicate:false,
    canBulkDelete:false,
    canCollapseGroups:true,
    canOpenTasks:true,
    showPostDate:true,
    showDeadline:false,
    showStatus:true,
    showCompany:false,
    showResponsible:false,
  };
}

export const DOCUMENT_PERMISSION_ITEMS = Object.freeze([
  Object.freeze({id:'showSearch',label:'Pesquisar documentos'}),
  Object.freeze({id:'showFolders',label:'Visualizar pastas'}),
  Object.freeze({id:'canOpenDocuments',label:'Abrir documentos'}),
  Object.freeze({id:'canCreateDocuments',label:'Criar documentos'}),
  Object.freeze({id:'canCreateFolders',label:'Criar pastas'}),
  Object.freeze({id:'canReorder',label:'Reorganizar pastas e documentos'}),
  Object.freeze({id:'canEditTitle',label:'Editar título'}),
  Object.freeze({id:'canEditContent',label:'Editar conteúdo'}),
  Object.freeze({id:'canEditMetadata',label:'Editar pasta e vínculo'}),
  Object.freeze({id:'showLinkedEntity',label:'Visualizar vínculo do documento'}),
  Object.freeze({id:'canDeleteDocuments',label:'Excluir documentos'}),
  Object.freeze({id:'canDeleteFolders',label:'Excluir pastas'}),
]);

export function builtInDocumentPermissionsForRole(role){
  if(role==='admin') return Object.fromEntries(DOCUMENT_PERMISSION_ITEMS.map(item=>[item.id,true]));
  if(role==='team') return {
    showSearch:true,
    showFolders:true,
    canOpenDocuments:true,
    canCreateDocuments:false,
    canCreateFolders:false,
    canReorder:false,
    canEditTitle:false,
    canEditContent:false,
    canEditMetadata:false,
    showLinkedEntity:true,
    canDeleteDocuments:false,
    canDeleteFolders:false,
  };
  return {
    showSearch:true,
    showFolders:true,
    canOpenDocuments:true,
    canCreateDocuments:false,
    canCreateFolders:false,
    canReorder:false,
    canEditTitle:false,
    canEditContent:false,
    canEditMetadata:false,
    showLinkedEntity:false,
    canDeleteDocuments:false,
    canDeleteFolders:false,
  };
}

export const PLANNING_PERMISSION_ITEMS = Object.freeze([
  Object.freeze({id:'showWeekControls',label:'Selecionar semana'}),
  Object.freeze({id:'showSort',label:'Ordenar clientes'}),
  Object.freeze({id:'showIndicators',label:'Período e indicadores'}),
  Object.freeze({id:'showCompanies',label:'Visualizar empresas'}),
  Object.freeze({id:'showTemplateSummary',label:'Resumo do template'}),
  Object.freeze({id:'canGenerateAll',label:'Gerar todos os pendentes'}),
  Object.freeze({id:'canGenerateCompany',label:'Gerar tarefas por empresa'}),
  Object.freeze({id:'canRegenerate',label:'Gerar novamente'}),
  Object.freeze({id:'canEditTemplate',label:'Criar ou editar template'}),
  Object.freeze({id:'canOpenGeneratedTasks',label:'Abrir tarefas geradas'}),
]);

export function builtInPlanningPermissionsForRole(role){
  if(role==='admin') return Object.fromEntries(PLANNING_PERMISSION_ITEMS.map(item=>[item.id,true]));
  if(role==='team') return {
    showWeekControls:true,
    showSort:true,
    showIndicators:true,
    showCompanies:true,
    showTemplateSummary:true,
    canGenerateAll:false,
    canGenerateCompany:false,
    canRegenerate:false,
    canEditTemplate:false,
    canOpenGeneratedTasks:true,
  };
  return {
    showWeekControls:false,
    showSort:false,
    showIndicators:false,
    showCompanies:false,
    showTemplateSummary:false,
    canGenerateAll:false,
    canGenerateCompany:false,
    canRegenerate:false,
    canEditTemplate:false,
    canOpenGeneratedTasks:false,
  };
}

export const PORTFOLIO_PERMISSION_ITEMS = Object.freeze([
  Object.freeze({id:'showMemberSelector',label:'Seletor de membros'}),
  Object.freeze({id:'canViewOtherMembers',label:'Visualizar outros membros'}),
  Object.freeze({id:'showProfileHeader',label:'Cabeçalho do perfil'}),
  Object.freeze({id:'showStats',label:'Estatísticas do perfil'}),
  Object.freeze({id:'canEditOwnProfile',label:'Editar o próprio recado e Instagram'}),
  Object.freeze({id:'showPosts',label:'Visualizar trabalhos'}),
  Object.freeze({id:'canOpenPosts',label:'Abrir tarefas pelos trabalhos'}),
  Object.freeze({id:'showPagination',label:'Paginação dos trabalhos'}),
]);

export function builtInPortfolioPermissionsForRole(role){
  if(role==='admin') return Object.fromEntries(PORTFOLIO_PERMISSION_ITEMS.map(item=>[item.id,true]));
  if(role==='team') return {
    showMemberSelector:true,
    canViewOtherMembers:true,
    showProfileHeader:true,
    showStats:true,
    canEditOwnProfile:true,
    showPosts:true,
    canOpenPosts:true,
    showPagination:true,
  };
  return {
    showMemberSelector:false,
    canViewOtherMembers:false,
    showProfileHeader:true,
    showStats:false,
    canEditOwnProfile:false,
    showPosts:true,
    canOpenPosts:true,
    showPagination:true,
  };
}

export const CALENDAR_PERMISSION_ITEMS = Object.freeze([
  Object.freeze({id:'showViewTabs',label:'Alternar entre mês, semana e dia'}),
  Object.freeze({id:'canExportExcel',label:'Exportar planilha Excel'}),
  Object.freeze({id:'showCompanyFilter',label:'Filtro de empresa'}),
  Object.freeze({id:'showResponsibleFilter',label:'Filtro de responsável'}),
  Object.freeze({id:'showTypeFilter',label:'Filtro de tipo'}),
  Object.freeze({id:'showStatusFilter',label:'Filtro de status'}),
  Object.freeze({id:'showArchivedToggle',label:'Mostrar arquivadas'}),
  Object.freeze({id:'showLegend',label:'Legenda de status'}),
  Object.freeze({id:'canNavigateDates',label:'Navegar entre datas'}),
  Object.freeze({id:'canOpenTasks',label:'Abrir tarefas'}),
  Object.freeze({id:'showTaskTitle',label:'Título das tarefas'}),
  Object.freeze({id:'showCompany',label:'Empresa nas tarefas'}),
  Object.freeze({id:'showResponsible',label:'Responsável nas tarefas'}),
  Object.freeze({id:'showStatus',label:'Status nas tarefas'}),
  Object.freeze({id:'showDeadline',label:'Prazo nas tarefas'}),
]);

export function builtInCalendarPermissionsForRole(role){
  if(role==='admin') return Object.fromEntries(CALENDAR_PERMISSION_ITEMS.map(item=>[item.id,true]));
  if(role==='team') return {
    showViewTabs:true,
    canExportExcel:true,
    showCompanyFilter:false,
    showResponsibleFilter:false,
    showTypeFilter:true,
    showStatusFilter:true,
    showArchivedToggle:true,
    showLegend:true,
    canNavigateDates:true,
    canOpenTasks:true,
    showTaskTitle:true,
    showCompany:true,
    showResponsible:true,
    showStatus:true,
    showDeadline:true,
  };
  return {
    showViewTabs:true,
    canExportExcel:true,
    showCompanyFilter:false,
    showResponsibleFilter:false,
    showTypeFilter:true,
    showStatusFilter:true,
    showArchivedToggle:false,
    showLegend:true,
    canNavigateDates:true,
    canOpenTasks:true,
    showTaskTitle:true,
    showCompany:false,
    showResponsible:false,
    showStatus:true,
    showDeadline:false,
  };
}

export function builtInKanbanPermissionsForRole(role){
  if(role==='admin') return Object.fromEntries(KANBAN_PERMISSION_ITEMS.map(item=>[item.id,true]));
  if(role==='team') return {
    showPeriodFilter:true,
    showCompanyFilter:false,
    showResponsibleFilter:false,
    showTypeFilter:true,
    showSort:true,
    showArchivedToggle:true,
    canOpenTasks:true,
    showPostDate:true,
    showDeadline:true,
    showCompany:true,
    showResponsible:true,
  };
  return {
    showPeriodFilter:true,
    showCompanyFilter:false,
    showResponsibleFilter:false,
    showTypeFilter:true,
    showSort:true,
    showArchivedToggle:false,
    canOpenTasks:true,
    showPostDate:true,
    showDeadline:false,
    showCompany:false,
    showResponsible:false,
  };
}

export const CREATE_TASK_FIELDS = Object.freeze([
  Object.freeze({id:'companyId',label:'Empresa'}),
  Object.freeze({id:'responsibleId',label:'Responsável'}),
  Object.freeze({id:'type',label:'Tipo de tarefa'}),
  Object.freeze({id:'status',label:'Status inicial'}),
  Object.freeze({id:'postDate',label:'Data do post'}),
  Object.freeze({id:'internalDate',label:'Prazo interno'}),
  Object.freeze({id:'copyInstructions',label:'Instruções ao copy'}),
  Object.freeze({id:'editorInstructions',label:'Instruções ao editor'}),
  Object.freeze({id:'copy',label:'Copy'}),
  Object.freeze({id:'caption',label:'Legenda'}),
  Object.freeze({id:'finalLink',label:'Link final'}),
  Object.freeze({id:'usefulLinks',label:'Links úteis'}),
  Object.freeze({id:'materialLinks',label:'Links de material pronto'}),
]);

export const TASK_DETAIL_FIELDS = Object.freeze([
  Object.freeze({id:'title',label:'Título da tarefa'}),
  Object.freeze({id:'preview',label:'Prévia do post'}),
  Object.freeze({id:'copyInstructions',label:'Instruções ao copy'}),
  Object.freeze({id:'editorInstructions',label:'Instruções ao editor'}),
  Object.freeze({id:'copy',label:'Copy'}),
  Object.freeze({id:'caption',label:'Legenda'}),
  Object.freeze({id:'finalLink',label:'Link final'}),
  Object.freeze({id:'usefulLinks',label:'Links úteis'}),
  Object.freeze({id:'materialLinks',label:'Links de material pronto'}),
  Object.freeze({id:'companyId',label:'Empresa'}),
  Object.freeze({id:'responsibleId',label:'Responsável'}),
  Object.freeze({id:'type',label:'Tipo'}),
  Object.freeze({id:'status',label:'Status'}),
  Object.freeze({id:'internalDate',label:'Prazo interno'}),
  Object.freeze({id:'postDate',label:'Data do post'}),
  Object.freeze({id:'stats',label:'Estatísticas'}),
  Object.freeze({id:'comments',label:'Comentários'}),
  Object.freeze({id:'history',label:'Histórico da tarefa'}),
]);

export function builtInTaskDetailPermissionsForRole(role){
  const visible=Object.fromEntries(TASK_DETAIL_FIELDS.map(field=>[field.id,true]));
  const editable=Object.fromEntries(TASK_DETAIL_FIELDS.map(field=>[field.id,false]));
  if(role==='admin'){
    TASK_DETAIL_FIELDS.forEach(field=>{ editable[field.id]=!['preview','stats','history'].includes(field.id); });
  }else if(role==='team'){
    ['usefulLinks','materialLinks','finalLink'].forEach(id=>{editable[id]=true;});
    editable.comments=true;
  }else{
    ['copyInstructions','editorInstructions','companyId','responsibleId','type','status','internalDate','stats','history'].forEach(id=>{visible[id]=false;});
    editable.usefulLinks=true;
    editable.comments=true;
  }
  return {visible,editable};
}

export function builtInTaskPermissionsForRole(role){
  const isClient=role==='client';
  const visible=Object.fromEntries(CREATE_TASK_FIELDS.map(field=>[field.id,!isClient]));
  if(isClient){
    visible.companyId=true;
    visible.type=true;
    visible.postDate=true;
    visible.editorInstructions=true;
    visible.usefulLinks=true;
    visible.materialLinks=false;
  }
  return {
    canCreate:role!=='client',
    creationMode:isClient?'request':'task',
    createFields:visible,
    canApprovePosts:role==='admin'||role==='client',
    detailFields:builtInTaskDetailPermissionsForRole(role),
  };
}

export function defaultPanelNavigationForRole(role){
  const normalizedRole = ['admin','team','client'].includes(role) ? role : 'client';
  return PANEL_CATALOG
    .filter(panel=>panel.defaultRoles.includes(normalizedRole))
    .map(panel=>[panel.id,panel.label]);
}

// Round155B: resolve permissões opcionais por usuário sem mudar os padrões atuais.
// Formato futuro esperado:
// panelPermissions: {
//   mode: 'custom',
//   visible: { dashboard:true, planning:false },
//   order: ['dashboard','tasks']
// }
// Usuários sem esse objeto continuam exatamente com o acesso definido pela função.
export function builtInAccessDefaultForRole(role){
  const normalizedRole=['admin','team','client'].includes(role)?role:'client';
  const panelIds=defaultPanelNavigationForRole(normalizedRole).map(([id])=>id);
  return {
    panels:{
      visible:Object.fromEntries(PANEL_CATALOG.map(panel=>[panel.id,panelIds.includes(panel.id)])),
      order:panelIds,
    },
    visibleStatuses:normalizedRole==='admin'?[]:(normalizedRole==='team'?[...TEAM_DEFAULT]:[...CLIENT_DEFAULT]),
    visibleTypes:normalizedRole==='admin'?[]:[...TASK_TYPES],
    notificationPrefs:defaultNotificationPrefsForRole(normalizedRole),
    notificationStatusPrefs:{},
    notificationPanel:builtInNotificationPanelPermissionsForRole(normalizedRole),
    dashboard:{visible:fullDashboardVisibility()},
    tasks:builtInTaskPermissionsForRole(normalizedRole),
    kanban:builtInKanbanPermissionsForRole(normalizedRole),
    calendar:builtInCalendarPermissionsForRole(normalizedRole),
    portfolio:builtInPortfolioPermissionsForRole(normalizedRole),
    planning:builtInPlanningPermissionsForRole(normalizedRole),
    documents:builtInDocumentPermissionsForRole(normalizedRole),
    tasksList:builtInTasksListPermissionsForRole(normalizedRole),
  };
}

export function accessDefaultForRole(system,role){
  const builtIn=builtInAccessDefaultForRole(role);
  const saved=system?.accessDefaults?.[role];
  if(!saved||typeof saved!=='object') return builtIn;
  return {
    panels:{
      visible:{...builtIn.panels.visible,...(saved.panels?.visible||{})},
      order:Array.isArray(saved.panels?.order)?saved.panels.order:builtIn.panels.order,
    },
    visibleStatuses:Array.isArray(saved.visibleStatuses)?saved.visibleStatuses:builtIn.visibleStatuses,
    visibleTypes:Array.isArray(saved.visibleTypes)?saved.visibleTypes:builtIn.visibleTypes,
    notificationPrefs:Array.isArray(saved.notificationPrefs)?((role==='admin'&&saved.notificationPrefs.length===BASE_NOTIFICATION_VISIBLE_EVENTS.length&&BASE_NOTIFICATION_VISIBLE_EVENTS.every(ev=>saved.notificationPrefs.includes(ev)))?[...saved.notificationPrefs,CLIENT_REQUEST_NOTIFICATION_EVENT]:saved.notificationPrefs):builtIn.notificationPrefs,
    notificationStatusPrefs:saved.notificationStatusPrefs&&typeof saved.notificationStatusPrefs==='object'?saved.notificationStatusPrefs:builtIn.notificationStatusPrefs,
    notificationPanel:{...builtIn.notificationPanel,...(saved.notificationPanel||{})},
    dashboard:{
      visible:{...builtIn.dashboard.visible,...(saved.dashboard?.visible||{})}
    },
    tasks:{
      ...builtIn.tasks,
      ...(saved.tasks||{}),
      createFields:{...builtIn.tasks.createFields,...(saved.tasks?.createFields||{})},
      detailFields:{
        visible:{...builtIn.tasks.detailFields.visible,...(saved.tasks?.detailFields?.visible||{})},
        editable:{...builtIn.tasks.detailFields.editable,...(saved.tasks?.detailFields?.editable||{})},
      }
    },
    kanban:{...builtIn.kanban,...(saved.kanban||{})},
    calendar:{...builtIn.calendar,...(saved.calendar||{})},
    portfolio:{...builtIn.portfolio,...(saved.portfolio||{})},
    planning:{...builtIn.planning,...(saved.planning||{})},
    documents:{...builtIn.documents,...(saved.documents||{})},
    tasksList:{...builtIn.tasksList,...(saved.tasksList||{})},
  };
}

export function resolveUserAccess(user,system){
  if(!user) return user;
  const defaults=accessDefaultForRole(system,user.role);
  const inheritance=user.accessInheritance||{};
  return {
    ...user,
    visibleStatuses:inheritance.statuses==='custom'?(user.visibleStatuses||[]):defaults.visibleStatuses,
    visibleTypes:inheritance.types==='custom'?(user.visibleTypes||[]):defaults.visibleTypes,
    notificationPrefs:inheritance.notifications==='custom'?(user.notificationPrefs||[]):defaults.notificationPrefs,
    notificationStatusPrefs:inheritance.notifications==='custom'?(user.notificationStatusPrefs||{}):defaults.notificationStatusPrefs,
    notificationPanelPermissions:inheritance.notifications==='custom'
      ? {...defaults.notificationPanel,...(user.notificationPanelPermissions||{})}
      : defaults.notificationPanel,
    dashboardPermissions:inheritance.dashboard==='custom'
      ? {visible:{...defaults.dashboard.visible,...(user.dashboardPermissions?.visible||{})}}
      : defaults.dashboard,
    taskPermissions:{
      ...defaults.tasks,
      ...((inheritance.actions==='custom'||inheritance.tasks==='custom')?{
        canCreate:user.taskPermissions?.canCreate??defaults.tasks.canCreate,
        creationMode:user.taskPermissions?.creationMode||defaults.tasks.creationMode,
        createFields:{...defaults.tasks.createFields,...(user.taskPermissions?.createFields||{})},
      }:{}),
      ...((inheritance.taskDetail==='custom'||inheritance.tasks==='custom')?{
        canApprovePosts:user.taskPermissions?.canApprovePosts??defaults.tasks.canApprovePosts,
        detailFields:{
          visible:{...defaults.tasks.detailFields.visible,...(user.taskPermissions?.detailFields?.visible||{})},
          editable:{...defaults.tasks.detailFields.editable,...(user.taskPermissions?.detailFields?.editable||{})},
        }
      }:{})
    },
    kanbanPermissions:inheritance.kanban==='custom'
      ? {...defaults.kanban,...(user.kanbanPermissions||{})}
      : defaults.kanban,
    calendarPermissions:inheritance.calendar==='custom'
      ? {...defaults.calendar,...(user.calendarPermissions||{})}
      : defaults.calendar,
    portfolioPermissions:inheritance.portfolio==='custom'
      ? {...defaults.portfolio,...(user.portfolioPermissions||{})}
      : defaults.portfolio,
    planningPermissions:inheritance.planning==='custom'
      ? {...defaults.planning,...(user.planningPermissions||{})}
      : defaults.planning,
    documentPermissions:inheritance.documents==='custom'
      ? {...defaults.documents,...(user.documentPermissions||{})}
      : defaults.documents,
    tasksListPermissions:inheritance.tasksList==='custom'
      ? {...defaults.tasksList,...(user.tasksListPermissions||{})}
      : defaults.tasksList,
    panelPermissions:user.role==='admin'
      ? user.panelPermissions
      : {
          ...(user.panelPermissions||{}),
          visible:{
            ...(user.panelPermissions?.visible||{}),
            financial:false,
            settings:false
          }
        },
  };
}

export function sidebarPanelOrder(system){
  const saved=Array.isArray(system?.panelOrder)?system.panelOrder.filter(id=>DEFAULT_SIDEBAR_PANEL_ORDER.includes(id)):[];
  return [...saved,...DEFAULT_SIDEBAR_PANEL_ORDER.filter(id=>!saved.includes(id))];
}
export function applySidebarPanelOrder(items=[],system){
  const order=sidebarPanelOrder(system);
  const index=new Map(order.map((id,i)=>[id,i]));
  const taskIds=new Set(['kanban','calendar','tasks']);
  return [...items].sort((a,b)=>{
    const ak=taskIds.has(a[0])?'tasks':a[0], bk=taskIds.has(b[0])?'tasks':b[0];
    const ai=index.has(ak)?index.get(ak):999, bi=index.has(bk)?index.get(bk):999;
    if(ai!==bi) return ai-bi;
    if(ak==='tasks'&&bk==='tasks') return ['kanban','calendar','tasks'].indexOf(a[0])-['kanban','calendar','tasks'].indexOf(b[0]);
    return 0;
  });
}
export function collapseTaskPanelsInNavigation(items=[]){
  const taskPanelIds=new Set(['kanban','calendar','tasks']);
  const firstTaskIndex=items.findIndex(([id])=>taskPanelIds.has(id));
  if(firstTaskIndex<0) return items;
  const collapsed=[];
  items.forEach(([id,label],index)=>{
    if(!taskPanelIds.has(id)){
      collapsed.push([id,label]);
      return;
    }
    if(index===firstTaskIndex) collapsed.push(['tasks','Tarefas']);
  });
  return collapsed;
}
export function taskTabsFromNavigation(items=[]){
  const labels={kanban:'Kanban',calendar:'Calendário',tasks:'Listas'};
  return ['kanban','calendar','tasks']
    .filter(id=>items.some(([panelId])=>panelId===id))
    .map(id=>[id,labels[id]]);
}
export function panelNavigationForUser(user,system){
  const defaults=accessDefaultForRole(system,user?.role);
  const fallback=PANEL_CATALOG
    .filter(panel=>defaults.panels.visible?.[panel.id]===true)
    .map(panel=>[panel.id,panel.label]);
  const permissions=user?.panelPermissions;
  if(!permissions||permissions.mode!=='custom') return fallback.length?fallback:defaultPanelNavigationForRole(user?.role);

  const visible=permissions.visible&&typeof permissions.visible==='object'?permissions.visible:{};
  const requestedOrder=Array.isArray(permissions.order)?permissions.order.filter(id=>PANEL_CATALOG.some(panel=>panel.id===id)):[];
  const defaultIds=new Set(fallback.map(([id])=>id));
  const allowedPanels=PANEL_CATALOG.filter(panel=>{
    const explicit=visible[panel.id];
    if(typeof explicit==='boolean') return explicit;
    return defaultIds.has(panel.id);
  });

  const orderIndex=new Map(requestedOrder.map((id,index)=>[id,index]));
  const defaultOrderIndex=new Map((defaults.panels.order||[]).map((id,index)=>[id,index]));
  const catalogIndex=new Map(PANEL_CATALOG.map((panel,index)=>[panel.id,index]));
  allowedPanels.sort((a,b)=>{
    const aCustom=orderIndex.has(a.id), bCustom=orderIndex.has(b.id);
    if(aCustom&&bCustom) return orderIndex.get(a.id)-orderIndex.get(b.id);
    if(aCustom) return -1;
    if(bCustom) return 1;
    const aDefault=defaultOrderIndex.has(a.id), bDefault=defaultOrderIndex.has(b.id);
    if(aDefault&&bDefault) return defaultOrderIndex.get(a.id)-defaultOrderIndex.get(b.id);
    if(aDefault) return -1;
    if(bDefault) return 1;
    return (catalogIndex.get(a.id)??999)-(catalogIndex.get(b.id)??999);
  });
  if(!allowedPanels.length) return fallback.length?fallback:defaultPanelNavigationForRole(user?.role);
  return allowedPanels.map(panel=>[panel.id,panel.label]);
}
export function parseAppRoute(){
  const raw = (typeof window !== 'undefined' ? window.location.hash : '') || '';
  const clean = raw.replace(/^#/, '').replace(/^\/?/, '');
  const parts = clean.split('/').filter(Boolean).map(x=>decodeURIComponent(x));
  if(parts[0] === 'task' && parts[1]) return { screen: 'tasks', taskId: parts[1] };
  const key = parts[0] || 'dashboard';
  return { screen: ROUTE_SCREEN_ALIASES[key] || 'dashboard', taskId: null };
}
export function taskShareUrl(taskId){
  if(typeof window === 'undefined') return `#/task/${encodeURIComponent(taskId)}`;
  return `${window.location.origin}${window.location.pathname}#/task/${encodeURIComponent(taskId)}`;
}
export function setAppRoute(route){
  if(typeof window === 'undefined') return;
  const next = route?.taskId
    ? `#/task/${encodeURIComponent(route.taskId)}`
    : `#/${SCREEN_TO_ROUTE[route?.screen || 'dashboard'] || 'dashboard'}`;
  if(window.location.hash !== next) window.location.hash = next;
}


export function userSortName(user){
  return String(user?.name || user?.display_name || user?.username || user?.email || '').trim();
}

export function sortMembersAdminFirst(list){
  return [...(list || [])].sort((a,b)=>{
    const adminA = a?.role === 'admin' ? 0 : 1;
    const adminB = b?.role === 'admin' ? 0 : 1;
    if(adminA !== adminB) return adminA - adminB;
    return userSortName(a).localeCompare(userSortName(b), 'pt-BR', { sensitivity: 'base' });
  });
}

export function safeUUID(){
  try{
    if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'){
      return crypto.randomUUID();
    }
    if(typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'){
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map(b=>b.toString(16).padStart(2,'0'));
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
    }
  }catch(e){}
  // Fallback para mobile/local HTTP antigo. Mantém formato UUID v4 aceito pelo Supabase.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0;
    const v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}


// Movidos do main.jsx nesta correção: builtInAccessDefaultForRole (acima)
// depende diretamente destes valores/função.
export const TASK_TYPES = ['Estático', 'Carrossel', 'Vídeo', 'Vídeo Inglês', 'Pacote de criativos', 'Outras demandas'];
export const TEAM_DEFAULT = ['edicao','alteracao','aguardando'];
export const CLIENT_DEFAULT = ['aguardando','aprovacao','agendamento'];
export const CLIENT_REQUEST_NOTIFICATION_EVENT = 'Solicitações de clientes';
export const BASE_NOTIFICATION_VISIBLE_EVENTS = ['Comentário na tarefa','Prazo vencido','Prazo hoje'];
export const NOTIFICATION_VISIBLE_EVENTS = [...BASE_NOTIFICATION_VISIBLE_EVENTS,CLIENT_REQUEST_NOTIFICATION_EVENT];
export function defaultNotificationPrefsForRole(role){
  if(role==='client') return [];
  if(role==='admin') return [...NOTIFICATION_VISIBLE_EVENTS];
  return [...BASE_NOTIFICATION_VISIBLE_EVENTS];
}
