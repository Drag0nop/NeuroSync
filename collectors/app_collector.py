import time
import win32gui
import win32process
import psutil


class AppCollector:

    def __init__(self):
        self.previous_app = None
        self.events = []

    def get_active_app(self):

        try:
            hwnd = win32gui.GetForegroundWindow()

            _, pid = win32process.GetWindowThreadProcessId(
                hwnd
            )

            process = psutil.Process(pid)

            return process.name()

        except Exception:
            return "unknown"

    def collect(self):

        now = time.time()
        current_app = self.get_active_app()

        if current_app != self.previous_app:

            self.events.append({
                "timestamp": now,
                "event": "app_switch",
                "application": current_app
            })

            self.previous_app = current_app

    def get_events(self):
        result = self.events.copy()
        self.events.clear()
        return result
