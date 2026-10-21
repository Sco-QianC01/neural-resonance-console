"""Build the local-test watch APK using an isolated official SDK and an existing JDK."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile


def build(sdk, java_home, output):
    root = Path(__file__).resolve().parents[1]
    output.mkdir(parents=True, exist_ok=True)
    suffix = ".exe" if os.name == "nt" else ""
    aapt = next(sdk.glob("**/aapt2" + suffix))
    android = next(sdk.glob("**/android.jar"))
    tools = aapt.parent
    java, javac, keytool = [java_home / "bin" / (name + suffix) for name in ("java", "javac", "keytool")]
    for entry in (java, javac, keytool, aapt, android):
        if not entry.is_file():
            raise FileNotFoundError(entry)
    environment = dict(os.environ)
    # Local-test signing is deliberately separate from any user/release signing identity.
    environment["NR_WATCH_TEST_PASS"] = "android"
    def run(*args):
        result = subprocess.run([str(arg) for arg in args], env=environment, capture_output=True,
                                text=True, encoding="utf-8", errors="replace", timeout=120)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        return result.stdout
    classes = output / "classes"
    classes.mkdir(exist_ok=True)
    sources = list((root / "watch/src").rglob("*.java"))
    run(javac, "--release", "8", "-encoding", "UTF-8", "-cp", android, "-d", classes, *sources)
    jar = output / "collector-classes.jar"
    with zipfile.ZipFile(jar, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in classes.rglob("*.class"):
            archive.write(file, file.relative_to(classes).as_posix())
    run(java, "-cp", tools / "lib/d8.jar", "com.android.tools.r8.D8",
        "--min-api", "26", "--lib", android, "--output", output, jar)
    unsigned = output / "collector-unsigned.apk"
    run(aapt, "link", "-I", android, "--manifest", root / "watch/AndroidManifest.xml", "-o", unsigned)
    with zipfile.ZipFile(unsigned, "a", zipfile.ZIP_DEFLATED) as archive:
        archive.write(output / "classes.dex", "classes.dex")
    aligned = output / "collector-aligned.apk"
    run(tools / ("zipalign" + suffix), "-f", "4", unsigned, aligned)
    keystore = output / "local-test-signing.p12"
    if not keystore.is_file():
        run(keytool, "-genkeypair", "-keystore", keystore, "-storetype", "PKCS12",
            "-alias", "collector", "-keyalg", "RSA", "-keysize", "2048", "-validity", "3650",
            "-storepass:env", "NR_WATCH_TEST_PASS", "-dname", "CN=Neural Resonance Local Test", "-noprompt")
    apk = output / "NeuralResonanceWatch.apk"
    run(java, "-jar", tools / "lib/apksigner.jar", "sign", "--ks", keystore,
        "--ks-pass", "env:NR_WATCH_TEST_PASS", "--out", apk, aligned)
    verify = run(java, "-jar", tools / "lib/apksigner.jar", "verify", "--verbose", apk)
    report = {"apk": str(apk), "sha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
              "bytes": apk.stat().st_size, "signatureVerification": verify.strip(),
              "permissions": ["android.permission.BODY_SENSORS", "android.permission.INTERNET"],
              "testBuild": True, "physicalSensorVerified": False}
    (output / "build-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sdk", type=Path, required=True)
    parser.add_argument("--java-home", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    build(options.sdk.resolve(), options.java_home.resolve(), options.output.resolve())
