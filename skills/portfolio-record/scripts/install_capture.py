#!/usr/bin/env python3
"""Install only this skill + a chained Codex notify command. Preserve unrelated config."""
import argparse
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tomllib

BEGIN="<!-- portfolio-record:start -->"
END="<!-- portfolio-record:end -->"
GUIDANCE="""The user requested private archiving of all their Codex work to their own portfolio.
The global portfolio-record skill provides capture, queue status, and readable summaries.
Use that skill for capture failures, missing history, or requests to organize work.
Automatic capture is configured through Codex notify; do not create duplicate manual records for every turn.
Never archive hidden reasoning, tool outputs, credentials, or raw project files. Never publish automatically.
A later request to exclude a chat, stop capture, or delete records overrides this standing request.
"""

def replace_notify(text,value):
    lines=text.splitlines(keepends=True);start=None
    for i,line in enumerate(lines):
        if line.lstrip().startswith("["):break
        if re.match(r"^\s*notify\s*=",line):start=i;break
    new="notify = "+json.dumps(value,ensure_ascii=False)+"\n"
    if start is None:return new+text
    for end in range(start+1,len(lines)+1):
        try:
            parsed=tomllib.loads("".join(lines[start:end]))
            if "notify" in parsed:
                return "".join(lines[:start])+new+"".join(lines[end:])
        except tomllib.TOMLDecodeError:continue
    raise ValueError("Could not safely locate notify setting")

def install(home,source,uninstall=False):
    home.mkdir(parents=True,exist_ok=True)
    state=home/"portfolio-record";state.mkdir(exist_ok=True)
    config=home/"config.toml"
    raw=config.read_text(encoding="utf-8") if config.exists() else ""
    parsed=tomllib.loads(raw)
    previous_path=state/"previous-notify.json"
    target=home/"skills"/"portfolio-record"
    command=[sys.executable,str(target/"scripts"/"codex_capture.py"),"notify"]
    current=parsed.get("notify",[])
    if uninstall:
        if current!=command:raise ValueError("notify was changed elsewhere; refusing to overwrite it")
        previous=json.loads(previous_path.read_text(encoding="utf-8"))
        updated=replace_notify(raw,previous)
    else:
        if current!=command:
            if not isinstance(current,list) or not all(isinstance(v,str) for v in current):
                raise ValueError("Unsupported notify setting")
            previous_path.write_text(json.dumps(current,ensure_ascii=False),encoding="utf-8")
        updated=replace_notify(raw,command)
        for file in source.rglob("*"):
            if file.is_symlink() or not file.is_file() or file.suffix not in (".md",".py",".yaml"):continue
            rel=file.relative_to(source)
            if "__pycache__" in rel.parts:continue
            dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True)
            if file.resolve()!=dest.resolve():shutil.copy2(file,dest)
    check=tomllib.loads(updated)
    assert {k:v for k,v in check.items() if k!="notify"}=={k:v for k,v in parsed.items() if k!="notify"}
    if updated!=raw:
        stamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        if config.exists():shutil.copy2(config,state/("config-before-"+stamp+".toml"))
        temp=config.with_suffix(".toml.portfolio-tmp");temp.write_text(updated,encoding="utf-8");os.replace(temp,config)
    agents=home/"AGENTS.md";old=agents.read_text(encoding="utf-8") if agents.exists() else ""
    block=BEGIN+"\n"+GUIDANCE+END
    if BEGIN in old:
        revised=re.sub(re.escape(BEGIN)+r"[\s\S]*?"+re.escape(END),"" if uninstall else block,old)
    else:revised=old if uninstall else old.rstrip()+"\n\n"+block+"\n"
    if revised!=old:agents.write_text(revised,encoding="utf-8")
    return {"installed":not uninstall,"notifyRestored":uninstall,"skill":str(target),"restartMayBeRequired":True}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--home",type=Path,default=Path(os.environ.get("CODEX_HOME",Path.home()/".codex")))
    p.add_argument("--uninstall-notify",action="store_true")
    a=p.parse_args()
    print(json.dumps(install(a.home,Path(__file__).resolve().parents[1],a.uninstall_notify),ensure_ascii=False))
