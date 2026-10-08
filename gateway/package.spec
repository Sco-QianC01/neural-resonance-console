# Run PyInstaller from gateway/. Native builds must run on their target OS.
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

project = Path(SPECPATH).parent
data = [(str(project / "index.html"), ".")]
data += [(str(project / name), name) for name in
         ("src", "neural-worm", "public", "docs")]
data += [(str(project / "gateway/config.example.json"), "gateway")]
analysis = Analysis(
    [str(project / "gateway/device_gateway.py")],
    pathex=[str(project / "gateway")], binaries=[], datas=data,
    hiddenimports=collect_submodules("bleak.backends"), hookspath=[],
    hooksconfig={}, runtime_hooks=[], excludes=[], noarchive=False,
)
pyz = PYZ(analysis.pure)
exe = EXE(
    pyz, analysis.scripts, [], exclude_binaries=True,
    name="NeuralResonance", debug=False, bootloader_ignore_signals=False,
    strip=False, upx=False, console=False,
)
collection = COLLECT(exe, analysis.binaries, analysis.datas,
                     strip=False, upx=False, name="NeuralResonance")
if sys.platform == "darwin":
    app = BUNDLE(
        collection, name="Neural Resonance.app",
        bundle_identifier="org.neuralresonance.console",
        info_plist={
            "NSBluetoothAlwaysUsageDescription": "Connect your EEG sensor to display local waveforms.",
            "NSBluetoothPeripheralUsageDescription": "Connect your EEG sensor to display local waveforms.",
            "NSHighResolutionCapable": True,
        },
    )
