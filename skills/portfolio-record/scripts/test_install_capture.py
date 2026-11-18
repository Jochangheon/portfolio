import json
from pathlib import Path
import tempfile
import tomllib
import unittest
import install_capture as i

class InstallTests(unittest.TestCase):
    def test_install_reinstall_uninstall_preserves_config_and_previous_notify(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp)/"codex";home.mkdir()
            original='notify = [\n "old-handler", "turn-ended"\n]\nmodel="existing-model"\n[projects."demo"]\ntrust_level="trusted"\n'
            (home/"config.toml").write_text(original,encoding="utf-8")
            (home/"AGENTS.md").write_text("Existing guidance\n",encoding="utf-8")
            source=Path(__file__).resolve().parents[1]
            i.install(home,source);i.install(home,source)
            current=tomllib.loads((home/"config.toml").read_text(encoding="utf-8"))
            self.assertEqual(current["model"],"existing-model")
            self.assertEqual(json.loads((home/"portfolio-record"/"previous-notify.json").read_text()),["old-handler","turn-ended"])
            self.assertEqual((home/"AGENTS.md").read_text(encoding="utf-8").count(i.BEGIN),1)
            i.install(home,source,True)
            self.assertEqual(tomllib.loads((home/"config.toml").read_text(encoding="utf-8")),tomllib.loads(original))
            self.assertIn("Existing guidance",(home/"AGENTS.md").read_text(encoding="utf-8"))

if __name__=="__main__":unittest.main()
