import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import codex_capture as c

class CaptureTests(unittest.TestCase):
    def test_credentials_context_and_reasoning_are_excluded(self):
        self.assertEqual(c.clean("Password: abc123"),c.REDACTED)
        self.assertEqual(c.clean("비밀번호는 1234"),c.REDACTED)
        self.assertEqual(c.clean("github_pat_example12345"),c.REDACTED)
        self.assertEqual(c.clean("<environment_context>private paths</environment_context>문서 만들기"),"문서 만들기")
        self.assertNotIn("user@example.com",c.clean("메일 user@example.com"))

    def test_transcript_whitelist_deduplicates_and_ignores_internal_tasks(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"rollout.jsonl"
            entries=[
                {"type":"session_meta","payload":{"id":"chat","source":"vscode","thread_source":"user","cwd":"C:/work/demo"}},
                {"type":"event_msg","payload":{"type":"task_started","turn_id":"turn"}},
                {"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"문서를 만들어 주세요"}]}},
                {"type":"event_msg","payload":{"type":"item_completed","turn_id":"turn","item":{"type":"UserMessage","content":[{"type":"text","text":"문서를 만들어 주세요"}]}}},
                {"type":"response_item","payload":{"type":"reasoning","summary":"HIDDEN_REASONING"}},
                {"type":"response_item","payload":{"type":"function_call_output","output":"SECRET_TOOL_OUTPUT"}},
                {"type":"response_item","payload":{"type":"message","role":"assistant","phase":"commentary","content":[{"type":"output_text","text":"PROGRESS_ONLY"}]}},
                {"type":"response_item","payload":{"type":"message","role":"assistant","phase":"final_answer","content":[{"type":"output_text","text":"문서를 만들었습니다."}]}},
                {"type":"event_msg","timestamp":"2026-11-18T00:00:00Z","payload":{"type":"task_complete","turn_id":"turn"}},
            ]
            path.write_text("\n".join(json.dumps(x,ensure_ascii=False) for x in entries),encoding="utf-8")
            result=c.parse_transcript(path,{"chat":"문서 작업"});self.assertEqual(len(result),1)
            body=result[0]["body"]
            self.assertEqual(body.count("문서를 만들어 주세요"),1)
            for value in ["HIDDEN_REASONING","SECRET_TOOL_OUTPUT","PROGRESS_ONLY"]:self.assertNotIn(value,body)
            entries[0]["payload"]["source"]={"subagent":{"other":"guardian"}}
            path.write_text("\n".join(json.dumps(x) for x in entries),encoding="utf-8")
            self.assertEqual(c.parse_transcript(path,{}),[])

    def test_long_text_splits_without_losing_content(self):
        result=c.make_payloads("chat","turn","제목","프로젝트",["가"*160001],"끝")
        self.assertGreater(len(result),1)
        self.assertIn("가"*160001,"".join(x["body"] for x in result))
        self.assertTrue(all(len(x["body"])<=80000 for x in result))

    def test_queue_survives_failure_and_retry_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            db=c.connect_state(Path(tmp));site="https://portfolio.test"
            records=c.make_payloads("chat","turn","제목","프로젝트",["요청"],"결과")
            self.assertEqual(c.enqueue(db,site,records),1)
            self.assertEqual(c.enqueue(db,site,records),0)
            with patch.object(c.portfolio,"request",side_effect=ValueError("HTTP 401: token")):
                self.assertEqual(c.flush(db,site),0)
            db.close();db=c.connect_state(Path(tmp))
            self.assertEqual(c.status(db,site)["pending"],1)
            with patch.object(c.portfolio,"request",return_value={"id":"saved","path":"/workspace/pages/saved"}):
                self.assertEqual(c.flush(db,site),1)
                self.assertEqual(c.flush(db,site),0)
            self.assertEqual(c.status(db,site)["saved"],1);db.close()

    def test_notify_preserves_existing_handler_and_ignores_subagents(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp);db=c.connect_state(home/"portfolio-record")
            (home/"session_index.jsonl").write_text(json.dumps({"id":"chat","thread_name":"내 대화"}),encoding="utf-8")
            (home/"portfolio-record"/"previous-notify.json").write_text(json.dumps(["existing","handler"]),encoding="utf-8")
            event={"type":"agent-turn-complete","thread-id":"chat","turn-id":"turn","cwd":"C:/project","input-messages":["요청"],"last-assistant-message":"답변"}
            with patch.object(c.subprocess,"run") as handler,patch.object(c.portfolio,"request",return_value={"id":"saved"}):
                self.assertEqual(c.notify(json.dumps(event),home,db,"https://portfolio.test"),1)
                self.assertEqual(handler.call_args.args[0][:2],["existing","handler"])
                event["thread-id"]="internal"
                self.assertEqual(c.notify(json.dumps(event),home,db,"https://portfolio.test"),0)
            db.close()

if __name__=="__main__":unittest.main()
