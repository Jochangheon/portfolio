#!/usr/bin/env python3
"""Private Codex turn capture. Never reads reasoning, tool outputs, or project files."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
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

REDACTED = "[인증정보가 포함될 수 있는 메시지는 자동 기록에서 제외했습니다.]"
SECRET = re.compile(r"password|passwd|비밀번호|암호|api.?key|access.?token|authorization|private.?key|bearer\s|secret|ptr_[a-f0-9]{32}|sk-[\w-]{12}|gh[pousr]_[\w]{12}|github_pat_|AKIA[A-Z0-9]{12}|-----BEGIN|(?:token|토큰)\s*[:=]", re.I)
IDENT = re.compile(r"[a-zA-Z0-9_-]{1,64}\Z")

def codex_home():
    return Path(os.environ.get("CODEX_HOME", Path.home()/".codex"))

def clean(text):
    if not isinstance(text,str):
        return ""
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

def make_payloads(thread, turn, title, project, users, answer, created=None, status="completed"):
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
    summary=plain(result,500)
    headline=plain(next((x for x in users if x!=REDACTED),title),130)
    body=f"# {title}\n\n작업 날짜: {created}\n\n## 무엇을 부탁했나요?\n\n{request}\n\n## AI가 남긴 결과\n\n{result}\n\n## 기록 범위\n\n사용자의 요청과 최종 답변을 비공개로 보관했습니다. 결과 내용은 당시 AI의 보고이며, 실행 성공을 별도로 검증했다는 뜻은 아닙니다. 원본 파일, 도구 출력, 내부 추론은 수집하지 않습니다.\n"
    # Preserve long conversations in ordered parts rather than truncate them.
    parts=[body[i:i+80000] for i in range(0,len(body),80000)]
    return [{"sourceKey":f"codex/{thread}/{turn}/{i}","title":f"{str(created)[:10]} · {headline}"+(f" ({i+1}/{len(parts)})" if len(parts)>1 else ""),
             "threadTitle":title,"project":project,"body":part,"summary":summary or "Codex 작업 기록",
             "created":created,"status":status} for i,part in enumerate(parts)]

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

def parse_transcript(path, titles):
    """Whitelist only userMessage + final_answer from item_completed or response_item."""
    meta=None;turns={};current=None;seen=set()
    with lines(path) as source:
        for line in source:
            try: item=json.loads(line)
            except ValueError: continue
            kind=item.get("type");p=item.get("payload",{})
            if kind=="session_meta":
                # Exclude guardian/subagent/internal tasks, even when they share a parent session.
                if not isinstance(p.get("source"),str) or p.get("thread_source") not in (None,"user","onboarding_checklist","automation"):
                    return []
                meta={"id":p.get("id"),"cwd":p.get("cwd","")}
            if not meta: continue
            if kind=="event_msg" and p.get("type")=="task_started":
                current=p.get("turn_id")
                if current and IDENT.fullmatch(current):
                    turns.setdefault(current,{"users":[],"answer":"","created":item.get("timestamp"),"done":False,"status":"completed"})
            if kind=="turn_context" and not current:
                current=p.get("turn_id")
                if current and IDENT.fullmatch(current):
                    turns.setdefault(current,{"users":[],"answer":"","created":item.get("timestamp"),"done":False,"status":"completed"})
            if kind=="event_msg" and p.get("type") in ("task_complete","turn_aborted"):
                tid=p.get("turn_id",current)
                if tid in turns:
                    t=turns[tid];t["done"]=True;t["created"]=p.get("completed_at") or item.get("timestamp") or t["created"]
                    t["status"]="interrupted" if p["type"]=="turn_aborted" else "completed"
                    # Final message is an explicit, user-visible field; never a compaction summary.
                    if p.get("last_agent_message"):t["answer"]=p["last_agent_message"]
                current=None
            event_item=kind=="event_msg" and p.get("type")=="item_completed"
            if event_item:
                msg=p.get("item",{});tid=p.get("turn_id",current);role=msg.get("type")
                user=role=="UserMessage";final=role=="AgentMessage" and msg.get("phase")=="final_answer"
                text=text_content(msg.get("content",msg.get("text","")))
            elif kind=="response_item" and p.get("type")=="message":
                msg=p;tid=current;user=msg.get("role")=="user"
                final=msg.get("role")=="assistant" and msg.get("phase")=="final_answer"
                text=text_content(msg.get("content"))
            else:continue
            if not (user or final) or tid not in turns:continue
            key=(tid,"u" if user else "a",hashlib.sha256(text.encode()).hexdigest())
            if key in seen:continue
            seen.add(key)
            if user:turns[tid]["users"].append(text)
            else:turns[tid]["answer"]=text
    if not meta:return []
    result=[]
    for tid,t in turns.items():
        if t["done"]:
            project=re.split(r"[\\/]",meta["cwd"].rstrip("\\/"))[-1]
            result.extend(make_payloads(meta["id"],tid,titles.get(meta["id"],"Codex 작업"),project,
                t["users"],t["answer"],t["created"],t["status"]))
    return result

def connect_state(directory):
    directory.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(directory/"state.sqlite",timeout=20)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("CREATE TABLE IF NOT EXISTS queue(site TEXT,key TEXT,payload TEXT,status TEXT DEFAULT 'pending',result TEXT,error TEXT,PRIMARY KEY(site,key))")
    return db

def enqueue(db,site,payloads):
    before=db.total_changes
    for p in payloads:
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
    # Internal subagents are not user conversations. Known user chats live in the index.
    titles=index_titles(home)
    if thread not in titles:return 0
    project=re.split(r"[\\/]",event.get("cwd","").rstrip("\\/"))[-1]
    payloads=make_payloads(thread,turn,titles[thread],project,event.get("input-messages",[]),event.get("last-assistant-message",""))
    added=enqueue(db,site,payloads);flush(db,site,5)
    return added

def main():
    p=argparse.ArgumentParser(description="Codex 작업을 비공개로 보관합니다.")
    p.add_argument("command",choices=["backfill","flush","status","notify"])
    p.add_argument("notification",nargs="?")
    p.add_argument("--home",type=Path,default=codex_home())
    p.add_argument("--state",type=Path)
    p.add_argument("--titles-file",type=Path,help="Optional thread ID-to-title map for historical chats")
    p.add_argument("--url",default=portfolio.DEFAULT_URL)
    p.add_argument("--limit",type=int,default=1000)
    args=p.parse_args();site=portfolio.origin(args.url)
    db=connect_state(args.state or args.home/"portfolio-record")
    try:
        if args.command=="notify":
            notify(args.notification,args.home,db,site)
            return
        if args.command=="backfill":
            titles=index_titles(args.home);total=0;failed=0
            if args.titles_file:
                titles.update(json.loads(args.titles_file.read_text(encoding="utf-8")))
            paths=sorted({x for root in ("sessions","archived_sessions") for x in (args.home/root).rglob("*.jsonl*") if x.name.endswith((".jsonl",".jsonl.zst"))})
            for path in paths:
                if path.is_symlink():continue
                try:total+=enqueue(db,site,parse_transcript(path,titles))
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
