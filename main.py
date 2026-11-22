
import time
import csv
import os

from collectors.keyword_collector import KeyboardCollector
from collectors.mouse_collector import MouseCollector
from collectors.app_collector import AppCollector


os.makedirs("data/raw/keyboard", exist_ok=True)
os.makedirs("data/raw/mouse", exist_ok=True)
os.makedirs("data/raw/applications", exist_ok=True)


keyboard_collector = KeyboardCollector()
mouse_collector = MouseCollector()
app_collector = AppCollector()


keyboard_collector.start()
mouse_collector.start()

print("NeuroSync collection started.")
print("Press Ctrl+C to stop.")

try:
    while True:

        app_collector.collect()

        keyboard_events = keyboard_collector.get_events()
        mouse_events = mouse_collector.get_events()
        app_events = app_collector.get_events()

        for filename, events in [
            ("keyboard", keyboard_events),
            ("mouse", mouse_events),
            ("applications", app_events)
        ]:

            if not events:
                continue

            path = f"data/raw/{filename}/events.csv"

            file_exists = os.path.exists(path)

            with open(path, "a", newline="") as f:

                writer = csv.DictWriter(
                    f,
                    fieldnames=events[0].keys()
                )

                if not file_exists:
                    writer.writeheader()

                writer.writerows(events)

        time.sleep(1)

except KeyboardInterrupt:
    print("Stopping collection...")

finally:
    keyboard_collector.stop()
    mouse_collector.stop()

    print("NeuroSync collection stopped.")
