#!/usr/bin/env python3
"""Private Codex turn capture. Never reads reasoning, tool outputs, or project files."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import portfolio
import record_format

REDACTED = "[인증정보가 포함될 수 있는 메시지는 자동 기록에서 제외했습니다.]"
SECRET = re.compile(r"password|passwd|비밀번호|암호|api.?key|access.?token|authorization|private.?key|bearer\s|secret|ptr_[a-f0-9]{32}|sk-[\w-]{12}|gh[pousr]_[\w]{12}|github_pat_|AKIA[A-Z0-9]{12}|-----BEGIN|(?:token|토큰)\s*[:=]", re.I)
IDENT = re.compile(r"[a-zA-Z0-9_-]{1,64}\Z")

def codex_home():
    return Path(os.environ.get("CODEX_HOME", Path.home()/".codex"))

def clean(text):
    if not isinstance(text,str):
        return ""
    if re.search(r"gAAAAA[A-Za-z0-9_=-]{60,}",text):
        return "[보호된 원문이므로 내용을 확인할 수 없습니다.]"
    # These are injected context, not the user's own request.
    text=re.sub(r"<(environment_context|system_reminder|developer_instructions)>[\s\S]*?</\1>", "",text)
    if SECRET.search(text):
        return REDACTED
    text=re.sub(r"(?i)(https?://)[^\s/@]+:[^\s/@]+@", r"\1[인증정보 제외]@",text)
    text=re.sub(r"(?i)([?&](?:token|key|password|signature|sig|code)=)[^\s&#)]+",r"\1[제외]",text)
    text=re.sub(r"[A-Za-z0-9_.+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}", "[이메일 제외]",text)
    text=re.sub(r"(?i)[A-Z]:[\\/][^\n<>\"|)]+", "[로컬 파일 경로 제외]",text)
    return text.strip()

def plain(text, limit):
    return re.sub(r"\s+"," ",re.sub(r"[#*\x60]","",text)).strip()[:limit]

def date_label(created):
    return datetime.fromisoformat(str(created).replace("Z","+00:00")).astimezone(timezone(timedelta(hours=9))).date().isoformat()

def text_content(value):
    if isinstance(value,str):
        return value
    if not isinstance(value,list):
        return ""
    return "\n".join(v.get("text","") for v in value if isinstance(v,dict) and v.get("type") in ("text","input_text","output_text"))

def index_titles(home):
    result={}
    path=home/"session_index.jsonl"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                x=json.loads(line);result[x["id"]]=clean(x["thread_name"])
            except (ValueError,KeyError):
                pass
    return result

def make_payloads(thread, turn, title, project, users, answer, created=None, status="completed", capture=None):
    if not IDENT.fullmatch(thread) or not IDENT.fullmatch(turn):
        raise ValueError("Invalid Codex identifiers")
    users=[clean(x) for x in users if isinstance(x,str)]
    users=[x for x in users if x]
    answer=clean(answer)
    if not users and not answer:
        return []
    created=created or datetime.now(timezone.utc).isoformat()
    if isinstance(created,(int,float)):
        created=datetime.fromtimestamp(created,timezone.utc).isoformat()
    title=plain(clean(title),180) or "Codex 작업"
    project=plain(clean(project),80) or "Codex"
    request="\n\n".join(users) or "(요청 내용 없음)"
    result=answer or ("작업이 중단되어 최종 답변이 없습니다." if status=="interrupted" else "최종 답변이 남아 있지 않습니다.")
    summary=record_format.recap(request,result,status)
    headline=plain(next((x for x in users if x!=REDACTED),title),130)
    # Split question and answer separately, retaining all text and the same three sections.
    count=max((len(request)+35000-1)//35000,(len(result)+45000-1)//45000,1)
    output=[]
    for i in range(count):
        q=request[i*35000:(i+1)*35000] or "(앞부분에 질문이 있습니다.)"
        detail=result[i*45000:(i+1)*45000] or "(답변 내용 없음)"
        output.append({"sourceKey":f"codex/{thread}/{turn}/{i}","title":f"{date_label(created)} · {headline}"+(f" ({i+1}/{count})" if count>1 else ""),
          "threadTitle":title,"project":project,"body":record_format.body(q,detail,summary),"summary":plain(summary,900),
          "question":q,"detail":detail,"recap":summary,"formatVersion":2,
          "capture":{"threadId":thread,"turnId":turn,"rootThreadId":thread,"mode":"main",**(capture or {})},
          "created":created,"status":status})
    return output

@contextmanager
def lines(path):
    if path.suffix==".zst":
        try:
            import zstandard
        except ImportError:
            raise RuntimeError("압축 기록을 읽으려면 zstandard가 필요합니다.") from None
        with path.open("rb") as raw, zstandard.ZstdDecompressor().stream_reader(raw) as stream:
            with io.TextIOWrapper(stream,encoding="utf-8") as f:
                yield f
    else:
        with path.open(encoding="utf-8") as f:
            yield f

def read_catalog(home):
    catalog={}
    paths=sorted({x for root in ("sessions","archived_sessions") for x in (home/root).rglob("*.jsonl*") if x.name.endswith((".jsonl",".jsonl.zst"))})
    for path in paths:
        if path.is_symlink():continue
        try:
            with lines(path) as f:
                m=json.loads(next(f)).get("payload",{})
            source=m.get("source")
            spawn=source.get("subagent",{}).get("thread_spawn") if isinstance(source,dict) else None
            if not spawn and (not isinstance(source,str) or m.get("thread_source") not in (None,"user","onboarding_checklist","automation")):continue
            if not IDENT.fullmatch(m.get("id","")):continue
            catalog[m["id"]]={"path":path,"cwd":m.get("cwd",""),"spawn":spawn}
        except (OSError,ValueError,RuntimeError,StopIteration):continue
    return catalog

def capture_context(thread,catalog,titles):
    item=catalog.get(thread,{})
    spawn=item.get("spawn")
    root=thread;seen=set()
    while root in catalog and catalog[root].get("spawn") and root not in seen:
        seen.add(root);root=catalog[root]["spawn"].get("parent_thread_id",root)
    root_item=catalog.get(root,item);title=titles.get(root,"Codex 작업")
    project=record_format.project_name(root_item.get("cwd",""),title)
    meta={"mode":"subagent" if spawn else "main","rootThreadId":root}
    if spawn:
        meta.update({"parentThreadId":spawn["parent_thread_id"],"agentName":clean(spawn.get("agent_nickname") or "서브에이전트"),
                     "agentRole":clean(spawn.get("agent_role") or spawn.get("agent_path","").rsplit("/",1)[-1])[:100]})
        roles={"domestic":"국내 사례 조사","technical":"기술 검토","international":"해외 사례 조사","content_review":"내용 검토","report_review":"보고서 검토","prompt_settings":"AI 요청 설정","results_analysis":"결과 분석","review_deployment":"화면 검토·배포 확인"}
        meta["agentRole"]=roles.get(meta["agentRole"],meta["agentRole"])
        title="서브 작업 · "+meta["agentRole"]+" · "+meta["agentName"]
    return meta,title,project

def timestamp(value):
    if isinstance(value,(int,float)):return value
    try:return datetime.fromisoformat(value.replace("Z","+00:00")).timestamp()
    except (ValueError,AttributeError):return 0

def assigned_question(parent,task,parent_turn,started,catalog):
    entry=catalog.get(parent,{})
    if "path" not in entry:return ""
    if "assignments" not in entry:
        found=[];current=None
        with lines(entry["path"]) as source:
            for line in source:
                try:x=json.loads(line)
                except ValueError:continue
                p=x.get("payload",{})
                if x.get("type")=="event_msg" and p.get("type")=="task_started":current=p.get("turn_id")
                # Only the human-visible delegation instruction is read from tool arguments.
                # Tool output and all other tool arguments remain excluded.
                if x.get("type")!="response_item" or p.get("type")!="function_call" or p.get("namespace")!="collaboration" or p.get("name") not in ("spawn_agent","followup_task"):continue
                try:a=json.loads(p.get("arguments","{}"))
                except ValueError:continue
                target=a.get("task_name") or a.get("target")
                if isinstance(target,str) and isinstance(a.get("message"),str):
                    found.append({"turn":current,"target":target.rsplit("/",1)[-1],"at":timestamp(x.get("timestamp")),"message":clean(a["message"])})
        entry["assignments"]=found
    matches=[x for x in entry["assignments"] if x["target"]==task and x["turn"]==parent_turn and x["at"]<=timestamp(started)+2]
    return max(matches,key=lambda x:x["at"])["message"] if matches else ""

def parse_transcript(path, titles, catalog=None):
    """Whitelist only userMessage + final_answer from item_completed or response_item."""
    meta=None;turns={};current=None;seen=set();spawn=None
    with lines(path) as source:
        for line in source:
            try: item=json.loads(line)
            except ValueError: continue
            kind=item.get("type");p=item.get("payload",{})
            if kind=="session_meta":
                if meta is not None:continue  # Forked history can contain the parent's session_meta.
                source=p.get("source")
                spawn=source.get("subagent",{}).get("thread_spawn") if isinstance(source,dict) else None
                # Only delegated work is included; guardian/internal approval sessions stay excluded.
                if not spawn and (not isinstance(source,str) or p.get("thread_source") not in (None,"user","onboarding_checklist","automation")):
                    return []
                meta={"id":p.get("id"),"cwd":p.get("cwd",""),"spawn":spawn,"path":path}
            if not meta: continue
            if kind=="event_msg" and p.get("type")=="task_started":
                current=p.get("turn_id")
                if current and IDENT.fullmatch(current):
                    attribution=p.get("turn_attribution") or {}
                    owned=not spawn or attribution.get("initiating_agent_path")==spawn.get("agent_path","").rsplit("/",1)[0]
                    turns.setdefault(current,{"users":[],"answer":"","created":item.get("timestamp"),"done":False,"status":"completed",
                        "owned":owned,"parentTurnId":attribution.get("parent_turn_id"),"started":p.get("started_at") or item.get("timestamp")})
            if kind=="turn_context" and not current:
                current=p.get("turn_id")
                if current and IDENT.fullmatch(current):
                    turns.setdefault(current,{"users":[],"answer":"","created":item.get("timestamp"),"done":False,"status":"completed","owned":not spawn})
            if kind=="event_msg" and p.get("type") in ("task_complete","turn_aborted"):
                tid=p.get("turn_id",current)
                if tid in turns:
                    t=turns[tid];t["done"]=True;t["created"]=p.get("completed_at") or item.get("timestamp") or t["created"]
                    t["status"]="interrupted" if p["type"]=="turn_aborted" else "completed"
                    # Final message is an explicit, user-visible field; never a compaction summary.
                    if p.get("last_agent_message"):t["answer"]=p["last_agent_message"]
                current=None
            if kind=="response_item" and p.get("type")=="agent_message" and spawn and current in turns and turns[current]["owned"]:
                parent_path=spawn.get("agent_path","").rsplit("/",1)[0]
                if p.get("recipient")==spawn.get("agent_path") and p.get("author")==parent_path:
                    assigned=text_content(p.get("content")).split("Payload:\n",1)[-1]
                    if assigned:turns[current]["users"].append(assigned)
                continue
            event_item=kind=="event_msg" and p.get("type")=="item_completed"
            if event_item:
                msg=p.get("item",{});tid=p.get("turn_id",current);role=msg.get("type")
                if spawn and p.get("thread_id")!=meta["id"]:continue
                user=role=="UserMessage";final=role=="AgentMessage" and msg.get("phase")=="final_answer"
                text=text_content(msg.get("content",msg.get("text","")))
            elif kind=="response_item" and p.get("type")=="message":
                msg=p;tid=current;user=msg.get("role")=="user"
                final=msg.get("role")=="assistant" and msg.get("phase")=="final_answer"
                text=text_content(msg.get("content"))
            else:continue
            if not (user or final) or tid not in turns or not turns[tid]["owned"]:continue
            if spawn and user:continue  # Parent user history is context, not a new assignment.
            key=(tid,"u" if user else "a",hashlib.sha256(text.encode()).hexdigest())
            if key in seen:continue
            seen.add(key)
            if user:turns[tid]["users"].append(text)
            else:turns[tid]["answer"]=text
    if not meta:return []
    result=[]
    for tid,t in turns.items():
        if t["done"] and t["owned"]:
            context,title,project=capture_context(meta["id"],catalog or {meta["id"]:meta},titles)
            if t.get("parentTurnId"):context["parentTurnId"]=t["parentTurnId"]
            if spawn and not t["users"]:
                question=assigned_question(spawn["parent_thread_id"],spawn.get("agent_path","").rsplit("/",1)[-1],t.get("parentTurnId"),t.get("started"),catalog or {})
                if question:t["users"]=[question]
            if spawn and (not t["users"] or all("보호된 원문" in q for q in t["users"])):
                t["users"]=[context.get("agentRole","지정받은 역할")+"을 맡은 서브 작업입니다. 자세한 지시 원문은 보호되어 있어 확인하지 못했습니다."]
            result.extend(make_payloads(meta["id"],tid,title,project,
                t["users"],t["answer"],t["created"],t["status"],context))
    return result

def connect_state(directory):
    directory.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(directory/"state.sqlite",timeout=20)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("CREATE TABLE IF NOT EXISTS queue(site TEXT,key TEXT,payload TEXT,status TEXT DEFAULT 'pending',result TEXT,error TEXT,PRIMARY KEY(site,key))")
    db.execute("CREATE TABLE IF NOT EXISTS prepared(thread TEXT,turn TEXT,data TEXT,PRIMARY KEY(thread,turn))")
    return db

def prepare(db,home,path):
    thread=os.environ.get("CODEX_THREAD_ID","")
    catalog=read_catalog(home)
    if not IDENT.fullmatch(thread) or thread not in catalog:
        raise ValueError("현재 Codex 대화를 확인할 수 없습니다. 다른 대화를 추측해서 저장하지 않습니다.")
    turn=None
    with lines(catalog[thread]["path"]) as source:
        for line in source:
            try:x=json.loads(line)
            except ValueError:continue
            p=x.get("payload",{})
            if x.get("type")=="event_msg" and p.get("type")=="task_started":turn=p.get("turn_id")
    if not turn or not IDENT.fullmatch(turn):raise ValueError("현재 작업을 확인할 수 없습니다.")
    value=json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value,dict) or not isinstance(value.get("question"),str) or not isinstance(value.get("recap"),str):
        raise ValueError("question과 recap이 필요합니다.")
    value={"question":clean(value["question"]),"recap":clean(value["recap"])}
    if not 1<=len(value["question"])<=35000 or not 1<=len(value["recap"])<=1000:raise ValueError("정리 길이를 확인하세요.")
    db.execute("INSERT INTO prepared VALUES(?,?,?) ON CONFLICT(thread,turn) DO UPDATE SET data=excluded.data",(thread,turn,json.dumps(value,ensure_ascii=False)));db.commit()
    return {"prepared":True,"mode":"subagent" if catalog[thread].get("spawn") else "main"}

def apply_prepared(db,payloads):
    for p in payloads:
        _,thread,turn,part=p["sourceKey"].split("/")
        row=db.execute("SELECT data FROM prepared WHERE thread=? AND turn=?",(thread,turn)).fetchone()
        if not row:continue
        value=json.loads(row[0])
        p["question"]=value["question"] if part=="0" else "(앞부분에 정리한 질문이 있습니다.)"
        p["recap"]=value["recap"];p["summary"]=plain(value["recap"],900)
        p["body"]=record_format.body(p["question"],p["detail"],p["recap"])
        p["title"]=date_label(p["created"])+" · "+plain(value["question"],130)+(f" (이어지는 내용 {part})" if part!="0" else "")
    return payloads

def enqueue(db,site,payloads,refresh=False):
    before=db.total_changes
    for p in payloads:
        if refresh:
            db.execute("UPDATE queue SET payload=?,status='pending',error=NULL WHERE site=? AND key=?",(json.dumps(p,ensure_ascii=False),site,p["sourceKey"]))
        db.execute("INSERT INTO queue(site,key,payload) VALUES(?,?,?) ON CONFLICT(site,key) DO UPDATE SET payload=excluded.payload WHERE queue.status='pending' AND queue.payload<>excluded.payload",(site,p["sourceKey"],json.dumps(p,ensure_ascii=False)))
    db.commit()
    return db.total_changes-before

def flush(db,site,limit=20):
    sent=0
    for key,raw in db.execute("SELECT key,payload FROM queue WHERE site=? AND status='pending' ORDER BY rowid LIMIT ?",(site,limit)).fetchall():
        try:
            result=portfolio.request(site,"codex",json.loads(raw),timeout=10)
            if not isinstance(result.get("id"),str):raise ValueError("Invalid server response")
            db.execute("UPDATE queue SET status='sent',result=?,error=NULL WHERE site=? AND key=?",(json.dumps(result),site,key));db.commit();sent+=1
        except Exception as error:
            # Never store raw HTTP bodies, transcripts, command lines, or tokens in error logs.
            code=re.search(r"HTTP (\d+)",str(error))
            db.execute("UPDATE queue SET error=? WHERE site=? AND key=?",(code.group(0) if code else type(error).__name__,site,key));db.commit()
            break
    return sent

def status(db,site):
    counts=dict(db.execute("SELECT status,COUNT(*) FROM queue WHERE site=? GROUP BY status",(site,)))
    errors=dict(db.execute("SELECT error,COUNT(*) FROM queue WHERE site=? AND error IS NOT NULL GROUP BY error",(site,)))
    return {"saved":counts.get("sent",0),"pending":counts.get("pending",0),"errors":errors}

def forward_notification(home,raw):
    settings=home/"portfolio-record"/"previous-notify.json"
    if not settings.exists():return
    previous=json.loads(settings.read_text(encoding="utf-8"))
    if previous:
        try:
            subprocess.run([*previous,raw],timeout=4,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0),check=False)
        except (OSError,subprocess.TimeoutExpired):pass

def notify(raw,home,db,site):
    forward_notification(home,raw)
    event=json.loads(raw)
    if event.get("type")!="agent-turn-complete":return 0
    thread=event.get("thread-id","");turn=event.get("turn-id","")
    titles=index_titles(home)
    catalog=read_catalog(home)
    if thread not in titles and thread not in catalog:return 0
    if thread not in catalog:catalog[thread]={"cwd":event.get("cwd","")}
    context,title,project=capture_context(thread,catalog,titles)
    payloads=[]
    if context["mode"]=="main":
        payloads=make_payloads(thread,turn,title,project,event.get("input-messages",[]),event.get("last-assistant-message",""),capture=context)
    # Collect completed delegated work under its real parent, without copying inherited turns.
    for child,entry in catalog.items():
        child_context,_,_=capture_context(child,catalog,titles)
        if entry.get("spawn") and child_context["rootThreadId"]==context["rootThreadId"]:
            payloads.extend(parse_transcript(entry["path"],titles,catalog))
    added=enqueue(db,site,apply_prepared(db,payloads));flush(db,site,20)
    return added

def main():
    p=argparse.ArgumentParser(description="Codex 작업을 비공개로 보관합니다.")
    p.add_argument("command",choices=["backfill","flush","status","notify","prepare"])
    p.add_argument("notification",nargs="?")
    p.add_argument("--home",type=Path,default=codex_home())
    p.add_argument("--state",type=Path)
    p.add_argument("--titles-file",type=Path,help="Optional thread ID-to-title map for historical chats")
    p.add_argument("--refresh",action="store_true",help="Send the structured format again; server preserves edited notes")
    p.add_argument("--note-json",type=Path,help="A concise question and recap written from the current task context")
    p.add_argument("--url",default=portfolio.DEFAULT_URL)
    p.add_argument("--limit",type=int,default=1000)
    args=p.parse_args();site=portfolio.origin(args.url)
    db=connect_state(args.state or args.home/"portfolio-record")
    try:
        if args.command=="notify":
            notify(args.notification,args.home,db,site)
            return
        if args.command=="prepare":
            if not args.note_json:raise ValueError("--note-json 파일이 필요합니다.")
            print(json.dumps(prepare(db,args.home,args.note_json),ensure_ascii=False))
            return
        if args.command=="backfill":
            titles=index_titles(args.home);total=0;failed=0
            if args.titles_file:
                titles.update(json.loads(args.titles_file.read_text(encoding="utf-8")))
            catalog=read_catalog(args.home)
            for entry in catalog.values():
                try:total+=enqueue(db,site,apply_prepared(db,parse_transcript(entry["path"],titles,catalog)),args.refresh)
                except (OSError,ValueError,RuntimeError):failed+=1
            print(json.dumps({"queued":total,"unreadableFiles":failed},ensure_ascii=False),flush=True)
        if args.command in ("backfill","flush"):flush(db,site,args.limit)
        print(json.dumps(status(db,site),ensure_ascii=False))
    finally:db.close()

if __name__=="__main__":
    try:main()
    except Exception:
        if len(sys.argv)>1 and sys.argv[1]=="notify":
            sys.exit(0)  # Capture must not interrupt the user's work.
        raise
