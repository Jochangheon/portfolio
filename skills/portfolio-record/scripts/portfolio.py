#!/usr/bin/env python3
"""Draft-only portfolio client. Standard library; never runs inspected code."""
import argparse
import ctypes
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_URL = "https://portfolio.49.247.40.177.sslip.io"
TYPES = ("프로젝트", "실험 노트", "스킬·워크플로")
ORIGINS = ("직접 제작", "기존 자료를 수정", "외부 도입")
KINDS = ("uses", "extends", "tests", "produces", "related")
KEY = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}\Z")
ID = re.compile(r"[a-zA-Z0-9_-]{1,128}\Z")
TOKEN = re.compile(r"ptr_[a-f0-9]{64}\Z")
SKIP = {".git", ".env", ".venv", "venv", "node_modules", "__pycache__", ".aws", ".ssh", ".codex", "data", "dist"}
SENSITIVE = re.compile(r"(^\.env($|\.)|credential|password|secret|token|private.?key|\.pem$|\.key$|\.p12$|\.pfx$|id_rsa|id_ed25519)", re.I)

def origin(value):
    p = urllib.parse.urlsplit(value)
    if p.username or p.password or p.query or p.fragment or p.path not in ("", "/"):
        raise ValueError("사이트의 기본 URL만 지정하세요.")
    if p.scheme != "https" and not (p.scheme == "http" and p.hostname in ("localhost", "127.0.0.1", "::1")):
        raise ValueError("HTTPS URL이 필요합니다. HTTP는 localhost 테스트만 허용합니다.")
    if not p.hostname:
        raise ValueError("호스트가 필요합니다.")
    return value.rstrip("/")

def credential(site, value=None):
    if sys.platform != "win32":
        if value is not None:
            raise ValueError("이 OS에서는 사용자가 PORTFOLIO_TOKEN 환경변수를 안전하게 설정하세요.")
        return None
    from ctypes import wintypes as w
    class Credential(ctypes.Structure):
        _fields_ = [("Flags",w.DWORD),("Type",w.DWORD),("TargetName",w.LPWSTR),
            ("Comment",w.LPWSTR),("LastWritten",w.FILETIME),("CredentialBlobSize",w.DWORD),
            ("CredentialBlob",ctypes.POINTER(ctypes.c_ubyte)),("Persist",w.DWORD),
            ("AttributeCount",w.DWORD),("Attributes",ctypes.c_void_p),
            ("TargetAlias",w.LPWSTR),("UserName",w.LPWSTR)]
    lib = ctypes.WinDLL("Advapi32.dll", use_last_error=True)
    lib.CredWriteW.argtypes = [ctypes.POINTER(Credential),w.DWORD]
    lib.CredWriteW.restype = w.BOOL
    lib.CredReadW.argtypes = [w.LPCWSTR,w.DWORD,w.DWORD,ctypes.POINTER(ctypes.POINTER(Credential))]
    lib.CredReadW.restype = w.BOOL
    lib.CredFree.argtypes = [ctypes.c_void_p]
    target = "JochangheonPortfolio:" + site
    if value is not None:
        if not TOKEN.fullmatch(value):
            raise ValueError("기록 전용 연결 키 형식이 아닙니다.")
        raw = value.encode("utf-8")
        blob = (ctypes.c_ubyte * len(raw))(*raw)
        c = Credential(Type=1,TargetName=target,CredentialBlobSize=len(raw),CredentialBlob=blob,Persist=2,UserName="portfolio-record")
        if not lib.CredWriteW(ctypes.byref(c),0):
            raise ctypes.WinError(ctypes.get_last_error())
        return None
    pointer = ctypes.POINTER(Credential)()
    if not lib.CredReadW(target,1,0,ctypes.byref(pointer)):
        if ctypes.get_last_error() == 1168:
            return None
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(pointer.contents.CredentialBlob,pointer.contents.CredentialBlobSize).decode("utf-8")
    finally:
        lib.CredFree(pointer)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def request(site, path, payload=None):
    token = os.environ.get("PORTFOLIO_TOKEN") or credential(site)
    if not token or not TOKEN.fullmatch(token):
        raise ValueError("연결 키가 없습니다. 관리자에서 발급한 키로 configure를 실행하세요.")
    body = None if payload is None else json.dumps(payload,ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(site + "/api/ingest/" + path, data=body,
        headers={"Authorization":"Bearer "+token,"Content-Type":"application/json","Accept":"application/json"})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=30) as response:
            return json.loads(response.read(3*1024*1024))
    except urllib.error.HTTPError as e:
        messages={400:"입력 형식이나 연결 대상·버전을 확인하세요.",401:"연결 키가 없거나 만료·폐기되었습니다.",409:"사이트에서 직접 수정한 초안과 충돌합니다. 기존 초안을 사이트에서 이어서 편집하세요.",413:"묶음 크기가 2MB를 넘었습니다."}
        raise ValueError("HTTP "+str(e.code)+": "+messages.get(e.code,"요청이 거절되었습니다. 리다이렉트는 허용하지 않습니다.")) from None

def new_entry(key,title,kind,ownership):
    return {"entries":[{"sourceKey":key,"record":{"title":title,"type":kind,"origin":ownership,
        **{k:"" for k in ("summary","problem","humanRole","aiRole","design","validation","limits","source")},
        "reason":"첫 기록","nodes":[],"edges":[],"files":[],"fileEdges":[]},"connections":[]}]}

def inspect_folder(folder,key,title,ownership):
    root = Path(folder)
    if root.is_symlink() or not root.is_dir() or not (root / "SKILL.md").is_file():
        raise ValueError("실제 SKILL.md가 있는 스킬 폴더를 지정하세요. 심볼릭 링크 루트는 허용하지 않습니다.")
    root = root.resolve()
    bundle = new_entry(key,title,"스킬·워크플로",ownership)
    record = bundle["entries"][0]["record"]
    total = 0
    for current,dirs,names in os.walk(root,followlinks=False):
        dirs[:] = sorted(d for d in dirs if d.lower() not in SKIP and not SENSITIVE.search(d) and not (Path(current)/d).is_symlink())
        for name in sorted(names):
            p = Path(current)/name
            if SENSITIVE.search(name) or p.is_symlink() or not p.is_file():
                continue
            try:
                p.resolve().relative_to(root)
            except ValueError:
                continue
            size = p.stat().st_size
            if size > 2*1024*1024:
                raise ValueError("2MB 초과 파일이 있습니다. 기록 범위를 줄이세요.")
            total += size
            if total > 32*1024*1024 or len(record["files"]) >= 200:
                raise ValueError("스킬 분석 범위는 200개 파일·32MB까지입니다.")
            rel = p.relative_to(root).as_posix()
            digest = hashlib.sha256(p.read_bytes()).hexdigest()
            area = rel.split("/")[0]
            role = "스킬 진입점" if rel == "SKILL.md" else {"references":"참고 자료 후보","scripts":"실행 코드 후보 (실행하지 않음)","assets":"템플릿·자료 후보","agents":"호출 설정 후보"}.get(area,"보조 자료 후보")
            record["files"].append({"id":"f"+str(len(record["files"])),"label":rel,"kind":"파일",
                "role":role,"version":"sha256:"+digest,"evidence":"추정","source":rel+" · "+str(size)+" bytes","publicText":False})
    entry = next((n for n in record["files"] if n["label"]=="SKILL.md"),None)
    if not entry:
        raise ValueError("SKILL.md를 안전하게 읽을 수 없습니다.")
    record["fileEdges"] = [{"id":"e"+str(i),"source":entry["id"],"target":n["id"],"label":"구성 제안","evidence":"추정"}
        for i,n in enumerate(record["files"]) if n["id"] != entry["id"]]
    record["source"] = "지정한 스킬 폴더의 파일 메타데이터·SHA-256 확인. 원문 미수집."
    record["limits"] = "폴더 이름으로 추정한 역할과 구성 관계는 작성자 확인이 필요합니다. 코드 실행 여부는 확인하지 않았습니다."
    return bundle

def validate(bundle):
    encoded = json.dumps(bundle,ensure_ascii=False).encode("utf-8")
    if len(encoded)>2*1024*1024:
        raise ValueError("최대 2MB입니다.")
    entries = bundle.get("entries") if isinstance(bundle,dict) else None
    if not isinstance(entries,list) or not 1<=len(entries)<=20:
        raise ValueError("entries는 1~20개입니다.")
    keys = set()
    text_fields = ("summary","problem","humanRole","aiRole","design","validation","limits","links","related","source","reason","project")
    for e in entries:
        if not isinstance(e,dict) or not isinstance(e.get("sourceKey"),str) or not KEY.fullmatch(e["sourceKey"]) or e["sourceKey"] in keys:
            raise ValueError("고유한 sourceKey가 필요합니다.")
        keys.add(e["sourceKey"])
        r=e.get("record")
        if not isinstance(r,dict) or not isinstance(r.get("title"),str) or not 1<=len(r["title"].strip())<=180 or r.get("type") not in TYPES or r.get("origin") not in ORIGINS:
            raise ValueError("제목·종류·제작 구분을 확인하세요.")
        for k in text_fields:
            if k in r and (not isinstance(r[k],str) or len(r[k])>100000):
                raise ValueError(k+"는 100,000자 이하 문자열입니다.")
        if any(r.get(k) for k in ("assets","runs","relations")):
            raise ValueError("원본 첨부와 실행 확정은 관리자 화면에서 등록하세요.")
        if any(k in r for k in ("id","visibility","relationships")):
            raise ValueError("id·visibility는 서버가 정합니다. 기록 간 연결은 connections에 입력하세요.")
        for ns,es in (("nodes","edges"),("files","fileEdges")):
            nodes,edges=r.get(ns,[]),r.get(es,[])
            if not isinstance(nodes,list) or not isinstance(edges,list) or max(len(nodes),len(edges))>500:
                raise ValueError("구조 노드·연결은 각각 최대 500개입니다.")
            ids=set()
            for n in nodes:
                if not isinstance(n,dict) or any(not isinstance(n.get(k),str) for k in ("id","label","kind","role","version","source")) or n.get("evidence") not in ("파일에 명시","작성자 확인","추정") or n["id"] in ids:
                    raise ValueError("구조 노드 필드를 확인하세요.")
                ids.add(n["id"])
                if "text" in n:
                    raise ValueError("자동 기록은 원문 text를 전송하지 않습니다. 필요한 설명은 role에 요약하세요.")
            for edge in edges:
                if not isinstance(edge,dict) or any(not isinstance(edge.get(k),str) for k in ("id","label","source","target")) or edge["source"] not in ids or edge["target"] not in ids or edge.get("evidence") not in ("파일에 명시","작성자 확인","추정"):
                    raise ValueError("구조 연결 필드를 확인하세요.")
        connections=e.get("connections",[])
        if not isinstance(connections,list) or len(connections)>100:
            raise ValueError("기록 간 관계는 최대 100개입니다.")
        for x in connections:
            if not isinstance(x,dict) or x.get("kind") not in KINDS or x.get("evidence") not in ("confirmed","proposed") or not isinstance(x.get("note"),str) or len(x["note"])>5000:
                raise ValueError("관계의 종류·근거·메모를 확인하세요.")
            if bool(x.get("targetKey"))==bool(x.get("targetId")):
                raise ValueError("targetKey 또는 targetId 하나만 지정하세요.")
            if x.get("targetKey") and (not isinstance(x["targetKey"],str) or not KEY.fullmatch(x["targetKey"])):
                raise ValueError("targetKey 형식 오류")
            if x.get("targetId") and (not isinstance(x["targetId"],str) or not ID.fullmatch(x["targetId"])):
                raise ValueError("targetId 형식 오류")
            if "targetVersion" in x and (type(x["targetVersion"]) is not int or x["targetVersion"]<1):
                raise ValueError("targetVersion은 실제 게시 버전의 양의 정수입니다.")
    return len(entries)

def load_bundle(path):
    if Path(path).stat().st_size>2*1024*1024:
        raise ValueError("최대 2MB입니다.")
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url",default=os.environ.get("PORTFOLIO_URL",DEFAULT_URL))
    sub=parser.add_subparsers(dest="command",required=True)
    for name in ("new","inspect"):
        p=sub.add_parser(name)
        if name=="inspect": p.add_argument("folder")
        else: p.add_argument("--type",choices=TYPES,required=True)
        p.add_argument("--key",required=True);p.add_argument("--title",required=True)
        p.add_argument("--origin",choices=ORIGINS,required=True);p.add_argument("--out",required=True)
    for name in ("validate","push"):
        sub.add_parser(name).add_argument("file")
    sub.add_parser("catalog");sub.add_parser("configure");sub.add_parser("status")
    a=parser.parse_args()
    site=origin(a.url)
    if a.command in ("new","inspect"):
        b=inspect_folder(a.folder,a.key,a.title,a.origin) if a.command=="inspect" else new_entry(a.key,a.title,a.type,a.origin)
        validate(b)
        # Do not silently overwrite a user's hand-edited bundle.
        with open(a.out,"x",encoding="utf-8") as f: json.dump(b,f,ensure_ascii=False,indent=2)
        print("로컬 초안 생성: "+str(Path(a.out).resolve())+" (아직 전송하지 않음)")
    elif a.command=="configure":
        credential(site,getpass.getpass("기록 전용 연결 키 (숨김 입력): ").strip())
        print("Windows 자격 증명 관리자에 연결 키를 저장했습니다.")
    elif a.command=="status":
        token=os.environ.get("PORTFOLIO_TOKEN") or credential(site)
        print(json.dumps({"site":site,"configured":bool(token and TOKEN.fullmatch(token))},ensure_ascii=False))
    elif a.command=="catalog":
        print(json.dumps(request(site,"catalog"),ensure_ascii=False,indent=2))
    else:
        b=load_bundle(a.file);count=validate(b)
        if a.command=="validate": print("검증 통과: "+str(count)+"개 기록 (아직 전송하지 않음)")
        else:
            result=request(site,"records",b)
            for r in result["records"]:
                print("비공개 초안 저장: "+site+r["editPath"])
            print("관계 지도: "+site+result["atlasPath"])

if __name__=="__main__":
    try: main()
    except (ValueError,OSError,urllib.error.URLError) as exc:
        print("실패: "+str(exc),file=sys.stderr)
        sys.exit(1)
