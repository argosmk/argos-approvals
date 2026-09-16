from pathlib import Path

path = Path('src/main.jsx')
text = path.read_text(encoding='utf-8')
old = '''    const created=recipients.map(item=>({
      id:safeUUID(),
      taskId:task.id,
      userId:item.user.id,
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
        toStatus:meta.toStatus||null,
        pushOnly:!item.system&&item.push
      }
    }));
    setNotifications(prev=>[...created,...(Array.isArray(prev)?prev:[])]);
'''
new = '''    setNotifications(prev=>{
      const current=Array.isArray(prev)?prev:[];
      const replacedIds=new Set();
      const created=recipients.map(item=>{
        const previousStatusNotification=event==='Status da tarefa'
          ? current.find(notification=>
              !notification?.done &&
              notification?.event==='Status da tarefa' &&
              String(notification?.taskId||'')===String(task.id) &&
              String(notification?.userId||'')===String(item.user.id)
            )
          : null;
        if(previousStatusNotification?.id) replacedIds.add(String(previousStatusNotification.id));
        return {
          id:previousStatusNotification?.id||safeUUID(),
          taskId:task.id,
          userId:item.user.id,
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
            toStatus:meta.toStatus||null,
            pushOnly:!item.system&&item.push
          }
        };
      });
      const remaining=current.filter(notification=>!replacedIds.has(String(notification?.id||'')));
      return [...created,...remaining];
    });
'''
if text.count(old) != 1:
    raise SystemExit(f'notifyTask anchor expected once, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
