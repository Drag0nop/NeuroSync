from pynput import mouse
import time
import math
import threading


class MouseCollector:

    def __init__(self):
        self.events = []
        self.last_position = None
        self.lock = threading.Lock()
        self.listener = None

    def on_move(self, x, y):
        now = time.time()

        with self.lock:
            distance = 0

            if self.last_position is not None:
                px, py = self.last_position
                distance = math.sqrt(
                    (x - px) ** 2 + (y - py) ** 2
                )

            self.events.append({
                "timestamp": now,
                "event": "move",
                "distance": distance
            })

            self.last_position = (x, y)

    def on_click(self, x, y, button, pressed):
        if pressed:
            with self.lock:
                self.events.append({
                    "timestamp": time.time(),
                    "event": "click",
                    "distance": 0
                })

    def start(self):
        self.listener = mouse.Listener(
            on_move=self.on_move,
            on_click=self.on_click
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
