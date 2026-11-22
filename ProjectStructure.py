from pathlib import Path

# Current working directory
root = Path(".")

# Folders to create
folders = [
    "data/raw",
    "data/processed",
    "data/features",
    "data/raw/keyword",
    "data/raw/mouse",
    "data/raw/webcam",
    "data/raw/applications",
    "collectors",
    "processing",
    "experiments",
    "experiments/notebooks",
    "experiments/reports",
    "config",
    "tests",
]

# Files to create
files = [
    "collectors/__init__.py",
    "collectors/keyword_collector.py",
    "collectors/mouse_collector.py",
    "collectors/webcam_collector.py",
    "collectors/app_collector.py",
    "processing/__init__.py",
    "processing/feature_extraction.py",
    "processing/synchronization.py",
    "processing/data_cleaning.py",
    "config/settings.py",
    "main.py",
    "requirements.txt",
    ".env",
    ".gitignore",
    "README.md",
]

# Create folders
for folder in folders:
    (root / folder).mkdir(parents=True, exist_ok=True)

# Create files
for file in files:
    (root / file).touch(exist_ok=True)

print("Project structure created successfully.")