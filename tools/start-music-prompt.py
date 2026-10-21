"""Run the independent local workbench using the current Python environment."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().parents[1] / "gateway" / "music_prompt_workbench.py"), run_name="__main__")
