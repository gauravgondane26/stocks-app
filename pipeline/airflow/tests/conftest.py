import sys
from pathlib import Path

AIRFLOW_DIR = Path(__file__).resolve().parents[1]
# The container puts include/ on PYTHONPATH; do the same here.
sys.path.insert(0, str(AIRFLOW_DIR / "include"))

FIXTURES = Path(__file__).resolve().parent / "fixtures"
