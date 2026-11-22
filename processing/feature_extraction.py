
import pandas as pd
import numpy as np


def extract_keyboard_features(df):

    intervals = df["inter_key_interval"].dropna()

    return {
        "key_press_count": len(df),

        "avg_inter_key_interval":
            intervals.mean() if len(intervals) else 0,

        "std_inter_key_interval":
            intervals.std() if len(intervals) > 1 else 0,

        "max_typing_pause":
            intervals.max() if len(intervals) else 0,

        "typing_pause_ratio":
            (intervals > 2).mean() if len(intervals) else 0
    }


def extract_mouse_features(df):

    movements = df[df["event"] == "move"]
    clicks = df[df["event"] == "click"]

    return {
        "mouse_movement_count": len(movements),

        "mouse_click_count": len(clicks),

        "avg_mouse_distance":
            movements["distance"].mean()
            if len(movements) else 0,

        "total_mouse_distance":
            movements["distance"].sum()
            if len(movements) else 0
    }


def extract_app_features(df):

    return {
        "app_switch_count": len(df),

        "unique_app_count":
            df["application"].nunique()
    }


def extract_all_features(keyboard, mouse, apps):

    features = {}

    features.update(
        extract_keyboard_features(keyboard)
    )

    features.update(
        extract_mouse_features(mouse)
    )

    features.update(
        extract_app_features(apps)
    )

    return features
