"""Human-readable capture format and conservative project classification."""
import re

def project_name(cwd,title):
    folder=re.split(r"[\\/]",cwd.rstrip("\\/"))[-1]
    key=folder.casefold()
    aliases={"개인":"개인 포트폴리오","portfolio":"개인 포트폴리오","portfolio-ai-records":"개인 포트폴리오",
             "aio.madang":"AIO.madang","madang.ai":"madang.ai","kanu-web":"카누 웹사이트"}
    if key in aliases:return aliases[key]
    for pattern,name in [(r"포트폴리오","개인 포트폴리오"),(r"어도비|adobe","어도비 교육"),
                         (r"thinkingserver|iwinv","AI 서버 관리"),(r"ppt|pdf|markdown","문서·발표 자료"),
                         (r"github","GitHub 작업"),(r"linear","Linear 업무 정리"),(r"sharepoint","SharePoint 문서 정리"),
                         (r"브리핑","아침 브리핑"),(r"dev[. ]madang","DEV.MADANG 활용")]:
        if re.search(pattern,title,re.I):return name
    if re.match(r"(new-chat|\d{4}-\d\d-\d\d)",folder) or len(folder)>70:
        return title[:70] or "분류 전"
    return folder[:80] or title[:70] or "분류 전"

def recap(question,detail,status):
    # Extract meaningful sentences; never invent execution results or call an external model.
    lines=[];in_code=False
    for raw in detail.splitlines():
        if raw.lstrip().startswith("```"):in_code=not in_code;continue
        if in_code or not raw.strip() or raw.lstrip().startswith(("#","|","![","<")):continue
        line=re.sub(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)","",raw)
        line=re.sub(r"\[([^\]]+)\]\([^)]*\)",r"\1",line)
        line=re.sub(r"[*_`]", "",line).strip()
        if len(line)<12 or re.fullmatch(r"https?://\S+",line):continue
        for sentence in re.split(r"(?<=[.!?。])\s+",line):
            if len(sentence)>=12 and sentence not in lines:lines.append(sentence)
    selected=lines[:2]
    pending=next((line for line in lines if re.search(r"남[은아]|아직|미완료|필요|다음|못했|제약|실패|중단",line) and line not in selected),None)
    if pending:selected.append(pending)
    if not selected:selected=["최종 답변이 남아 있지 않습니다." if not detail else "상세내용에서 당시 답변을 확인할 수 있습니다."]
    if status=="interrupted":selected.insert(0,"작업이 중단된 기록입니다. 완료로 처리하지 않았습니다.")
    return "\n".join("- "+(line if len(line)<=260 else line[:257]+"…") for line in selected[:3])

def body(question,detail,summary):
    return f"## 질문\n\n{question}\n\n## 상세내용\n\n{detail}\n\n## 정리\n\n{summary}\n"
