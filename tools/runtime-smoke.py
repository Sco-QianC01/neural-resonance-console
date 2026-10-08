"""Launch only an isolated instance with every hardware channel disabled."""
import argparse
import json
import os
from pathlib import Path
import platform
import socket
import subprocess
import tempfile
import time
import urllib.request


def main(args):
    root=Path(__file__).resolve().parents[1]
    version=json.loads((root/"package.json").read_text(encoding="utf-8"))["version"]
    with tempfile.TemporaryDirectory(prefix="neural smoke 測試 ") as directory:
        data=Path(directory)
        config=json.loads((root/"gateway/config.example.json").read_text(encoding="utf-8"))
        for key in ("eeg","bloodOxygen","gsr","ble"):config[key]["enabled"]=False
        with socket.socket() as probe:
            probe.bind(("127.0.0.1",0));port=probe.getsockname()[1]
        config["port"]=port;config["reuseLocalCore"]=False
        config_path=data/"config.json";config_path.write_text(json.dumps(config),encoding="utf-8")
        env={**os.environ,"NEURAL_RESONANCE_DATA":str(data),"PYTHONIOENCODING":"utf-8"}
        if args.native:
            command=[str(Path(args.native).resolve()),"--config",str(config_path),"--port",str(port),
                     "--standalone","--no-browser"]
        elif platform.system()=="Windows":
            command=["pwsh","-NoLogo","-NoProfile","-File",str(root/"Start-Windows.ps1"),
                     "-Standalone","-NoBrowser"]
        else:
            command=["sh",str(root/"Start-macOS.command"),"--standalone","--no-browser"]
        process=subprocess.Popen(command,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        try:
            health=None
            # New source installations may require one managed Python download.
            for _ in range(180):
                if process.poll() is not None:
                    stdout,stderr=process.communicate()
                    evidence=(data/"runtime.json").read_text(encoding="utf-8") if (data/"runtime.json").exists() else "no isolated runtime file"
                    raise RuntimeError(f"Isolated runtime exited ({process.returncode}), command={command}, {evidence}: {(stdout+stderr).decode('utf-8',errors='replace')}")
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health",timeout=.5) as response:
                        health=json.load(response)
                    break
                except OSError:time.sleep(.25)
            assert health and health["app"]=="neural-resonance-gateway" and health["version"]==version
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/") as response:page=response.read().decode()
            assert "app-sidebar" in page and f"v{version}" in page
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/public/config.json") as response:config=json.load(response)
            assert config["autoConnect"] and config["gatewayApi"] and config["startupMode"]=="live"
            result={"version":version,"platform":platform.platform(),"native":bool(args.native),
                    "hardwareOpened":False,"automaticConfiguration":True,"spaceUnicodeDataPath":True,"pass":True}
            output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
            output.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf-8")
            print(json.dumps(result,indent=2,ensure_ascii=False))
        finally:
            if process.poll() is None:
                if platform.system()=="Windows":
                    subprocess.run(["taskkill","/PID",str(process.pid),"/T","/F"],
                                   stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
                else:process.terminate()
            try:process.communicate(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.communicate()


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--native")
    parser.add_argument("--output",default="artifacts/runtime-smoke.json")
    main(parser.parse_args())
