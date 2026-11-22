
from pynput import keyboard
import time
import threading


class KeyboardCollector:

    def __init__(self):
        self.events = []
        self.last_press_time = None
        self.lock = threading.Lock()
        self.listener = None

    def on_press(self, key):
        now = time.time()

        with self.lock:
            interval = None

            if self.last_press_time is not None:
                interval = now - self.last_press_time

            self.events.append({
                "timestamp": now,
                "event": "key_press",
                "inter_key_interval": interval
            })

            self.last_press_time = now

    def start(self):
        self.listener = keyboard.Listener(
            on_press=self.on_press
        )
        self.listener.start()

    def get_events(self):
        with self.lock:
            result = self.events.copy()
            self.events.clear()
        return result

    def stop(self):
        if self.listener:
            self.listener.stop()
