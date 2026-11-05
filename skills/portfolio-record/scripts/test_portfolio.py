import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("portfolio",Path(__file__).with_name("portfolio.py"))
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

class ClientTests(unittest.TestCase):
    def test_inspect_excludes_sensitive_paths_and_does_not_read_source_into_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/"SKILL.md").write_text("PRIVATE SOURCE",encoding="utf-8")
            (root/".env").write_text("SECRET=value")
            (root/"password.txt").write_text("secret")
            (root/"scripts").mkdir();(root/"scripts"/"run.py").write_text("raise Exception('DO NOT RUN')")
            b=p.inspect_folder(root,"skills/test","테스트","직접 제작")
            self.assertEqual(p.validate(b),1)
            files=b["entries"][0]["record"]["files"]
            self.assertEqual({x["label"] for x in files},{"SKILL.md","scripts/run.py"})
            self.assertNotIn("PRIVATE SOURCE",json.dumps(b))
            self.assertTrue(all(x["evidence"]=="추정" for x in files))
            self.assertTrue(all(x["version"].startswith("sha256:") for x in files))

    def test_validation_rejects_duplicate_keys_raw_text_and_execution_claims(self):
        b=p.new_entry("p/test","테스트","프로젝트","직접 제작")
        self.assertEqual(p.validate(b),1)
        b["entries"].append(b["entries"][0])
        with self.assertRaises(ValueError):p.validate(b)
        b["entries"].pop()
        b["entries"][0]["record"]["runs"]=[{"result":"fake"}]
        with self.assertRaises(ValueError):p.validate(b)
        for url in ("http://example.com","https://user:pw@example.com","https://example.com/path"):
            with self.assertRaises(ValueError):p.origin(url)

    def test_redirect_never_forwards_bearer(self):
        seen=[]
        class Destination(BaseHTTPRequestHandler):
            def do_GET(self):
                seen.append(self.headers.get("Authorization"));self.send_response(200);self.end_headers();self.wfile.write(b"[]")
            def log_message(self,*args):pass
        target=HTTPServer(("127.0.0.1",0),Destination)
        class Redirect(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(302);self.send_header("Location","http://127.0.0.1:"+str(target.server_port)+"/stolen");self.end_headers()
            def log_message(self,*args):pass
        redirect=HTTPServer(("127.0.0.1",0),Redirect)
        threads=[threading.Thread(target=s.serve_forever,daemon=True) for s in (target,redirect)]
        for t in threads:t.start()
        try:
            with patch.dict(os.environ,{"PORTFOLIO_TOKEN":"ptr_"+"a"*64}):
                with self.assertRaisesRegex(ValueError,"302"):p.request("http://127.0.0.1:"+str(redirect.server_port),"catalog")
            self.assertEqual(seen,[])
        finally:
            for s in (target,redirect):s.shutdown();s.server_close()
            for t in threads:t.join()

if __name__=="__main__":unittest.main()
