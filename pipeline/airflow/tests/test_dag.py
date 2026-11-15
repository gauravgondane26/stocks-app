"""DAG integrity: imports cleanly, with the expected tasks, order and schedules.

Needs Airflow, so it's skipped by a plain `pytest` run and runs inside the container:
    docker exec openwatch-airflow python -m pytest /opt/airflow/tests/test_dag.py
"""

from pathlib import Path

import pytest

pytest.importorskip("airflow")

from airflow.models.dagbag import DagBag  # noqa: E402

DAGS = Path(__file__).resolve().parents[1] / "dags"
EXPECTED_ORDER = [
    "build_universe",
    "fetch_bars",
    "check_trading_day",
    "quality_checks",
    "load",
    "publish_eod_ready",
]


@pytest.fixture(scope="module")
def dagbag():
    # Airflow 3.3's DagBag has no include_examples; examples are off in the container.
    return DagBag(dag_folder=str(DAGS))


def test_dags_import_without_errors(dagbag):
    assert dagbag.import_errors == {}
    assert set(dagbag.dag_ids) == {"eod_bars_us", "eod_bars_in"}


@pytest.mark.parametrize(
    ("dag_id", "cron", "tz"),
    [("eod_bars_us", "30 16 * * 1-5", "America/New_York"), ("eod_bars_in", "0 16 * * 1-5", "Asia/Kolkata")],
)
def test_schedule_and_settings(dagbag, dag_id, cron, tz):
    dag = dagbag.get_dag(dag_id)
    # Airflow 3's default for a cron string: logical date = trigger time (see the DAG file).
    assert type(dag.timetable).__name__ == "CronTriggerTimetable"
    assert dag.timetable.expression == cron
    # A bare cron string would run in UTC; this is the check that caught it.
    assert str(dag.timetable.timezone) == tz
    assert dag.catchup is False
    assert dag.max_active_runs == 1
    assert all(task.retries == 2 for task in dag.tasks)


@pytest.mark.parametrize("dag_id", ["eod_bars_us", "eod_bars_in"])
def test_task_order(dagbag, dag_id):
    dag = dagbag.get_dag(dag_id)
    order = [task.task_id for task in dag.topological_sort()]
    for task_id in EXPECTED_ORDER:
        assert task_id in order
    assert [t for t in order if t in EXPECTED_ORDER] == EXPECTED_ORDER
    assert dag.get_task("check_trading_day").downstream_task_ids == {"quality_checks"}
