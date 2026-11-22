import numpy as np
import pandas as pd
from pathlib import Path

# Project paths
ROOT = Path(__file__).resolve().parents[1]

KEYBOARD_PATH = ROOT / "data/raw/keyboard/events.csv"
MOUSE_PATH = ROOT / "data/raw/mouse/events.csv"
APP_PATH = ROOT / "data/raw/applications/events.csv"

OUTPUT_PATH = ROOT / "data/features/synchronized_features.csv"

def load_events(path, required_columns):
    """Load and validate a raw event CSV."""

    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    df = pd.read_csv(path)

    missing = set(required_columns) - set(df.columns)

    if missing:
        raise ValueError(
            f"Missing columns in {path.name}: {missing}"
        )

    df["timestamp"] = pd.to_numeric(
        df["timestamp"], errors="coerce"
    )

    df = df.dropna(subset=["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    return df

def keyboard_features(df, window_seconds):
    intervals = (
        df["timestamp"]
        .diff()
        .dropna()
    )
    intervals = intervals[intervals >= 0]

    return {
        "key_press_count": len(df),

        "key_press_rate_per_min": len(df) / (window_seconds / 60),

        "avg_inter_key_interval":
            intervals.mean() if len(intervals) else np.nan,

        "std_inter_key_interval":
            intervals.std() if len(intervals) > 1 else np.nan,

        "median_inter_key_interval":
            intervals.median() if len(intervals) else np.nan,

        "max_typing_pause":
            intervals.max() if len(intervals) else np.nan,

        "typing_pause_count":
            int((intervals > 2).sum()),

        "typing_pause_ratio":
            (intervals > 2).mean()
            if len(intervals) else np.nan
    }


def mouse_features(df, all_mouse, window_start, window_end, window_seconds):
    movements = df[df["event"] == "move"].copy()
    clicks = df[df["event"] == "click"]

    all_movements = (
        all_mouse[all_mouse["event"] == "move"]
        .sort_values("timestamp")
        .copy()
    )

    all_movements["time_gap"] = (
        all_movements["timestamp"].diff()
    )

    all_movements["speed"] = (
        all_movements["distance"] /
        all_movements["time_gap"].replace(0, np.nan)
    )

    # Only consider movement observations in this window.
    window_movements = all_movements[
        (all_movements["timestamp"] >= window_start)
        & (all_movements["timestamp"] < window_end)
    ]

    speeds = (
        window_movements["speed"]
        .replace([np.inf, -np.inf], np.nan)
        .dropna()
    )

    gaps = window_movements["time_gap"].dropna()

    return {
        "mouse_movement_count": len(movements),

        "mouse_click_count": len(clicks),

        "mouse_movement_rate":
            len(movements) / (window_seconds / 60),

        "avg_mouse_distance":
            movements["distance"].mean()
            if len(movements) else np.nan,

        "total_mouse_distance":
            movements["distance"].sum(),

        "avg_mouse_speed":
            speeds.mean() if len(speeds) else np.nan,

        "mouse_long_pause_count":
            int((gaps > 2).sum())
    }

def app_features(df, all_apps, window_start, window_end):
    # Find the application active at the beginning of this window, if a previous transition exists.
    previous = all_apps[
        all_apps["timestamp"] < window_start
    ]

    current_app = (
        previous.iloc[-1]["application"]
        if len(previous) else None
    )

    apps_seen = set()

    if current_app is not None:
        apps_seen.add(current_app)

    apps_seen.update(df["application"].dropna().unique())

    return {
        "app_switch_count": len(df),

        "unique_app_count": len(apps_seen)
    }


def build_synchronized_dataset(window_seconds=30, session_id="session_001"):
    # Load raw events
    keyboard = load_events(
        KEYBOARD_PATH,
        ["timestamp", "event", "inter_key_interval"]
    )

    mouse = load_events(
        MOUSE_PATH,
        ["timestamp", "event", "distance"]
    )

    apps = load_events(
        APP_PATH,
        ["timestamp", "event", "application"]
    )

    # Establish common timeline
    all_timestamps = pd.concat([
        keyboard["timestamp"],
        mouse["timestamp"],
        apps["timestamp"]
    ], ignore_index=True).dropna()

    if all_timestamps.empty:
        raise ValueError("No events found in the raw datasets.")

    session_start = all_timestamps.min()
    session_end = all_timestamps.max()

    # Include the window containing the final event.
    num_windows = max(
        1,
        int(np.floor(
            (session_end - session_start) / window_seconds
        )) + 1
    )

    results = []

    for i in range(num_windows):

        window_start = session_start + i * window_seconds
        window_end = window_start + window_seconds

        # Assign events using [start, end) intervals.
        k_window = keyboard[
            (keyboard["timestamp"] >= window_start)
            & (keyboard["timestamp"] < window_end)
        ]

        m_window = mouse[
            (mouse["timestamp"] >= window_start)
            & (mouse["timestamp"] < window_end)
        ]

        a_window = apps[
            (apps["timestamp"] >= window_start)
            & (apps["timestamp"] < window_end)
        ]

        row = {
            "session_id": session_id,
            "window_id": i,
            "window_start": window_start,
            "window_end": window_end,
            "window_seconds": window_seconds,
            "is_final_observed_window": i == num_windows - 1
        }

        row.update(
            keyboard_features(k_window, window_seconds)
        )

        row.update(
            mouse_features(
                m_window,
                mouse,
                window_start,
                window_end,
                window_seconds
            )
        )

        row.update(
            app_features(
                a_window, apps,
                window_start, window_end
            )
        )

        results.append(row)

    feature_df = pd.DataFrame(results)

    # Create output directory
    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    feature_df.to_csv(OUTPUT_PATH, index=False)

    print("Synchronization completed!")
    print("Total windows:", len(feature_df))
    print("Output:", OUTPUT_PATH)

    return feature_df


if __name__ == "__main__":

    df = build_synchronized_dataset(window_seconds=30, session_id="session_001")
    print(df.head())
