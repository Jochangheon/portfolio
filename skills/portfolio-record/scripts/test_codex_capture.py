import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import codex_capture as c

class CaptureTests(unittest.TestCase):
    def test_dates_use_the_users_korean_timezone(self):
        self.assertEqual(c.date_label("2026-11-17T20:00:00Z"),"2026-11-18")
    def test_credentials_context_and_reasoning_are_excluded(self):
        self.assertEqual(c.clean("Password: abc123"),c.REDACTED)
        self.assertEqual(c.clean("비밀번호는 1234"),c.REDACTED)
        self.assertEqual(c.clean("github_pat_example12345"),c.REDACTED)
        self.assertNotIn("gAAAAA",c.clean("gAAAAA"+"x"*100))
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
        self.assertEqual(sum(x["question"].count("가") for x in result),160001)
        self.assertTrue(all(len(x["body"])<=90000 for x in result))
        self.assertTrue(all(x["body"].find("## 질문")<x["body"].find("## 상세내용")<x["body"].find("## 정리") for x in result))

    def test_subagent_records_own_assignment_only_under_parent(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"child.jsonl"
            spawn={"parent_thread_id":"parent","agent_path":"/root/review","agent_nickname":"Reviewer"}
            rows=[
              {"type":"session_meta","payload":{"id":"child","source":{"subagent":{"thread_spawn":spawn}},"thread_source":"subagent","cwd":"project"}},
              {"type":"session_meta","payload":{"id":"parent","source":"vscode","thread_source":"user","cwd":"project"}},
              {"type":"event_msg","payload":{"type":"task_started","turn_id":"inherited"}},
              {"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"PARENT_HISTORY"}]}},
              {"type":"event_msg","payload":{"type":"task_complete","turn_id":"inherited","last_agent_message":"PARENT_RESULT"}},
              {"type":"event_msg","payload":{"type":"task_started","turn_id":"own","turn_attribution":{"initiating_agent_path":"/root","parent_turn_id":"parentturn"}}},
              {"type":"response_item","payload":{"type":"agent_message","author":"/root","recipient":"/root/review","content":[{"type":"input_text","text":"Message Type: NEW_TASK\nPayload:\n내용이 맞는지 검토하세요."}]}},
              {"type":"event_msg","timestamp":"2026-11-18T00:00:00Z","payload":{"type":"task_complete","turn_id":"own","last_agent_message":"두 항목에서 수정할 부분을 찾았습니다."}}
            ]
            path.write_text("\n".join(json.dumps(x) for x in rows),encoding="utf-8")
            result=c.parse_transcript(path,{"parent":"검토 작업"},{"child":{"cwd":"project","spawn":spawn},"parent":{"cwd":"project"}})
            self.assertEqual(len(result),1)
            self.assertEqual(result[0]["capture"]["mode"],"subagent")
            self.assertEqual(result[0]["capture"]["parentTurnId"],"parentturn")
            self.assertEqual(result[0]["capture"]["parentThreadId"],"parent")
            self.assertIn("내용이 맞는지 검토",result[0]["question"])
            self.assertNotIn("PARENT_",result[0]["body"])

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

    def test_prepared_question_and_recap_replace_raw_prompt_but_keep_actual_answer(self):
        with tempfile.TemporaryDirectory() as tmp:
            db=c.connect_state(Path(tmp))
            note={"question":"문서의 빠진 항목을 찾아주세요.","recap":"두 항목을 찾았습니다. 수정은 메인 작업에 전달했습니다."}
            db.execute("INSERT INTO prepared VALUES(?,?,?)",("child","turn",json.dumps(note)));db.commit()
            payloads=c.make_payloads("child","turn","서브 작업","문서",["raw prompt"],"실제 답변",capture={"mode":"subagent","parentThreadId":"main"})
            result=c.apply_prepared(db,payloads)[0]
            self.assertEqual(result["question"],note["question"])
            self.assertEqual(result["recap"],note["recap"])
            self.assertEqual(result["detail"],"실제 답변")
            self.assertEqual(result["capture"]["mode"],"subagent")
            db.close()

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
