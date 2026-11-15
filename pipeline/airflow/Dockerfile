# Airflow for OpenWatch's end-of-day jobs. Run through pipeline/docker-compose.yml
# (profile "airflow"), which mounts the DAGs, the openwatch_pipeline package and tests.
FROM apache/airflow:3.3.2-python3.12

COPY requirements.txt requirements-test.txt /tmp/openwatch/
# pytest is included so the DAG integrity test can run inside the container.
RUN pip install --no-cache-dir -r /tmp/openwatch/requirements.txt -r /tmp/openwatch/requirements-test.txt
