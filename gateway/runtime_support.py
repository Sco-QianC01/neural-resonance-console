"""Per-user process ownership, without global settings or process termination."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time


BUILD = "waveform-20261027-v1"


def instance_id(directory):
    return hashlib.sha256(str(Path(directory).resolve()).encode("utf-8")).hexdigest()[:24]


class InstanceLock:
    """OS releases the lock on exit/crash; stale JSON is never authority."""
    def __init__(self, directory):
        self.path = Path(directory) / "instance.lock"
        self.handle = None

    def acquire(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        handle = self.path.open("a+b")
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b"\0")
            handle.flush()
        handle.seek(0)
        try:
            if sys.platform == "win32":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            handle.close()
            return False
        self.handle = handle
        return True

    def close(self):
        if self.handle:
            self.handle.seek(0)
            if sys.platform == "win32":
                import msvcrt
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
            self.handle.close()
            self.handle = None


def write_runtime(directory, **values):
    path = Path(directory) / "runtime.json"
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps({"build": BUILD, "pid": os.getpid(),
                               "instanceId": instance_id(directory),
                               "updatedAt": time.time(), **values}), encoding="utf-8")
    temp.replace(path)
