"""Run the independent local workbench using the current Python environment."""
import runpy
from pathlib import Path
import sys

gateway = Path(__file__).resolve().parents[1] / "gateway"
sys.path.insert(0, str(gateway))
runpy.run_path(str(gateway / "music_prompt_workbench.py"), run_name="__main__")
