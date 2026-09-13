from pathlib import Path

path = Path('src/main.jsx')
text = path.read_text(encoding='utf-8')
marker = 'argos-task-field-locks-'
if marker in text:
    raise SystemExit('task field locks already present')

anchor = "  const pendingTaskDeletesRef=useRef(new Set());\n"
if anchor not in text:
    raise SystemExit('lock anchor not found')

insert = r'''
  const taskFieldLockSessionRef=useRef((typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():`field-lock-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const activeTaskFieldLockRef=useRef(null);

  useEffect(()=>{
    if(!isSupabaseConfigured || !cloudReady || !auth?.organizationId || !auth?.id) return;
    const sessionId=taskFieldLockSessionRef.current;
    const selector='[data-task-id][data-task-field]';
    let channel=null;
    let alive=true;
    let heartbeat=null;

    let style=document.getElementById('argos-task-field-lock-style');
    if(!style){
      style=document.createElement('style');
      style.id='argos-task-field-lock-style';
      style.textContent=`
        [data-argos-lock-host="1"]{position:relative!important;}
        [data-argos-lock-host="1"]::after{
          content:attr(data-argos-lock-label);
          position:absolute;
          top:6px;
          right:7px;
          z-index:20;
          max-width:70%;
          padding:4px 7px;
          border:1px solid rgba(244,197,66,.55);
          border-radius:7px;
          background:rgba(30,24,7,.96);
          color:#f4c542;
          font-size:10px;
          font-weight:800;
          line-height:1.2;
          pointer-events:none;
          box-shadow:0 3px 12px rgba(0,0,0,.28);
        }
        [data-argos-locked="1"]{
          opacity:.68!important;
          cursor:not-allowed!important;
          box-shadow:0 0 0 1px rgba(244,197,66,.34)!important;
        }
      `;
      document.head.appendChild(style);
    }

    const basePresence=()=>({
      sessionId,
      userId:auth.id,
      userName:auth.name||auth.email||'Outro usuário',
    });

    function clearDecorations(){
      document.querySelectorAll(selector).forEach(el=>{
        if(el.dataset.argosLocked==='1'){
          delete el.dataset.argosLocked;
          el.removeAttribute('aria-disabled');
        }
      });
      document.querySelectorAll('[data-argos-lock-host="1"]').forEach(host=>{
        delete host.dataset.argosLockHost;
        delete host.dataset.argosLockLabel;
      });
    }

    function lockHost(el){
      return el.closest('.rich-text-editor-shell,.task-title,label,.task-links-editor')||el.parentElement;
    }

    function renderPresenceLocks(){
      if(!alive||!channel) return;
      clearDecorations();
      const nowMs=Date.now();
      const contenders=new Map();
      const state=channel.presenceState?.()||{};
      Object.values(state).flat().forEach(meta=>{
        if(!meta?.taskId||!meta?.field||!meta?.sessionId) return;
        if(meta.updatedAt && nowMs-Number(meta.updatedAt)>65000) return;
        const key=`${meta.taskId}:${meta.field}`;
        if(!contenders.has(key)) contenders.set(key,[]);
        contenders.get(key).push(meta);
      });
      const winners=new Map();
      contenders.forEach((items,key)=>{
        const sorted=[...items].sort((a,b)=>{
          const timeDiff=Number(a.startedAt||0)-Number(b.startedAt||0);
          if(timeDiff) return timeDiff;
          return String(a.sessionId).localeCompare(String(b.sessionId));
        });
        winners.set(key,sorted[0]);
      });

      document.querySelectorAll(selector).forEach(el=>{
        const taskId=String(el.dataset.taskId||'');
        const field=String(el.dataset.taskField||'');
        const winner=winners.get(`${taskId}:${field}`);
        if(!winner || winner.sessionId===sessionId) return;
        el.dataset.argosLocked='1';
        el.setAttribute('aria-disabled','true');
        const host=lockHost(el);
        if(host){
          host.dataset.argosLockHost='1';
          host.dataset.argosLockLabel=`${winner.userName||'Outro usuário'} está editando`;
        }
        if(document.activeElement===el) el.blur();
      });
    }

    async function publish(lock){
      if(!channel) return;
      const payload={...basePresence(),taskId:null,field:null,startedAt:null,updatedAt:Date.now(),...(lock||{})};
      try{ await channel.track(payload); }
      catch(err){ console.warn('task field lock publish failed',err); }
    }

    function releaseCurrent(expected=null){
      const current=activeTaskFieldLockRef.current;
      if(!current) return;
      if(expected && (current.taskId!==expected.taskId||current.field!==expected.field)) return;
      activeTaskFieldLockRef.current=null;
      publish(null);
    }

    function handlePointerDown(event){
      const el=event.target?.closest?.(selector);
      if(!el||el.dataset.argosLocked!=='1') return;
      event.preventDefault();
      event.stopPropagation();
    }

    function handleFocusIn(event){
      const el=event.target?.closest?.(selector);
      if(!el) return;
      if(el.dataset.argosLocked==='1'){
        event.preventDefault();
        setTimeout(()=>el.blur(),0);
        return;
      }
      const next={taskId:String(el.dataset.taskId||''),field:String(el.dataset.taskField||''),startedAt:Date.now()};
      if(!next.taskId||!next.field) return;
      activeTaskFieldLockRef.current=next;
      publish(next);
    }

    function handleFocusOut(event){
      const el=event.target?.closest?.(selector);
      if(!el) return;
      const expected={taskId:String(el.dataset.taskId||''),field:String(el.dataset.taskField||'')};
      const container=el.closest('.rich-text-editor-shell')?.parentElement||el.closest('label')||el.parentElement;
      if(container?.contains(event.relatedTarget)) return;
      setTimeout(()=>{
        const active=document.activeElement?.closest?.(selector);
        if(active && String(active.dataset.taskId||'')===expected.taskId && String(active.dataset.taskField||'')===expected.field) return;
        releaseCurrent(expected);
      },120);
    }

    document.addEventListener('pointerdown',handlePointerDown,true);
    document.addEventListener('focusin',handleFocusIn,true);
    document.addEventListener('focusout',handleFocusOut,true);

    channel=supabase
      .channel(`argos-task-field-locks-${auth.organizationId}`,{config:{presence:{key:sessionId}}})
      .on('presence',{event:'sync'},renderPresenceLocks)
      .on('presence',{event:'join'},renderPresenceLocks)
      .on('presence',{event:'leave'},renderPresenceLocks)
      .subscribe(status=>{
        if(status==='SUBSCRIBED') publish(activeTaskFieldLockRef.current);
      });

    heartbeat=setInterval(()=>{
      if(activeTaskFieldLockRef.current) publish(activeTaskFieldLockRef.current);
    },20000);

    return()=>{
      alive=false;
      if(heartbeat) clearInterval(heartbeat);
      document.removeEventListener('pointerdown',handlePointerDown,true);
      document.removeEventListener('focusin',handleFocusIn,true);
      document.removeEventListener('focusout',handleFocusOut,true);
      clearDecorations();
      activeTaskFieldLockRef.current=null;
      if(channel){
        try{ channel.untrack(); }catch(e){}
        supabase.removeChannel(channel);
      }
    };
  },[cloudReady,auth?.organizationId,auth?.id,auth?.name]);
'''

text = text.replace(anchor, anchor + insert, 1)

replacements = [
    ("value={task.companyId} onChange={e=>updateTask(task.id,{companyId:e.target.value})}", "value={task.companyId} data-task-id={task.id} data-task-field=\"companyId\" onChange={e=>updateTask(task.id,{companyId:e.target.value})}"),
    ("value={task.responsibleId} onChange={e=>updateTask(task.id,{responsibleId:e.target.value})}", "value={task.responsibleId} data-task-id={task.id} data-task-field=\"responsibleId\" onChange={e=>updateTask(task.id,{responsibleId:e.target.value})}"),
    ("value={task.type} onChange={e=>updateTask(task.id,{type:e.target.value})}", "value={task.type} data-task-id={task.id} data-task-field=\"type\" onChange={e=>updateTask(task.id,{type:e.target.value})}"),
    ("value={task.status} onChange={e=>updateTask(task.id,{status:e.target.value})}", "value={task.status} data-task-id={task.id} data-task-field=\"status\" onChange={e=>updateTask(task.id,{status:e.target.value})}"),
    ("value={task.internalDate||''} onChange={e=>updateTask(task.id,{internalDate:e.target.value})}", "value={task.internalDate||''} data-task-id={task.id} data-task-field=\"internalDate\" onChange={e=>updateTask(task.id,{internalDate:e.target.value})}"),
    ("value={task.postDate||''} onChange={e=>updateTask(task.id,{postDate:e.target.value})}", "value={task.postDate||''} data-task-id={task.id} data-task-field=\"postDate\" onChange={e=>updateTask(task.id,{postDate:e.target.value})}"),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'field lock target not found: {old[:80]}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
