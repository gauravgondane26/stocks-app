"""OpenWatch end-of-day pipeline code used by the Airflow DAGs in ../dags.

Pure modules (markets, universe, yahoo parsing, quality, reconcile) have no Airflow
import, so pytest runs them without Airflow installed.
"""
