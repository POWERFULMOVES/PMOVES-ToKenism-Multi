import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from flask_backend import app


@pytest.fixture
def client():
    app.config.update(TESTING=True)
    with app.test_client() as client:
        yield client


def test_run_simulation_rejects_non_positive_members(client):
    response = client.post('/run_simulation', json={"NUM_MEMBERS": 0})
    assert response.status_code == 400
    data = response.get_json()
    assert data is not None
    assert 'errors' in data
    assert 'NUM_MEMBERS' in data['errors']
    assert 'positive integer' in data['errors']['NUM_MEMBERS']


def test_run_simulation_rejects_out_of_range_percentage(client):
    response = client.post('/run_simulation', json={"PERCENT_SPEND_INTERNAL_AVG": 1.5})
    assert response.status_code == 400
    data = response.get_json()
    assert data is not None
    assert 'errors' in data
    assert 'PERCENT_SPEND_INTERNAL_AVG' in data['errors']
    assert 'between 0 and 1' in data['errors']['PERCENT_SPEND_INTERNAL_AVG']


def test_run_simulation_rejects_invalid_type(client):
    response = client.post('/run_simulation', json={"SIMULATION_WEEKS": "ten"})
    assert response.status_code == 400
    data = response.get_json()
    assert data is not None
    assert 'errors' in data
    assert 'SIMULATION_WEEKS' in data['errors']


def test_run_simulation_accepts_valid_payload(client):
    payload = {
        "NUM_MEMBERS": 10,
        "SIMULATION_WEEKS": 10,
        "INITIAL_WEALTH_MEAN_LOG": 6.9,
        "INITIAL_WEALTH_SIGMA_LOG": 0.6,
        "WEEKLY_FOOD_BUDGET_AVG": 75.0,
        "WEEKLY_FOOD_BUDGET_STDDEV": 15.0,
        "MIN_WEEKLY_BUDGET": 20.0,
        "WEEKLY_INCOME_AVG": 150.0,
        "WEEKLY_INCOME_STDDEV": 40.0,
        "MIN_WEEKLY_INCOME": 0.0,
        "GROUP_BUY_SAVINGS_PERCENT": 0.2,
        "LOCAL_PRODUCTION_SAVINGS_PERCENT": 0.3,
        "PERCENT_SPEND_INTERNAL_AVG": 0.5,
        "PERCENT_SPEND_INTERNAL_STDDEV": 0.1,
        "GROTOKEN_REWARD_PER_WEEK_AVG": 0.4,
        "GROTOKEN_REWARD_STDDEV": 0.1,
        "GROTOKEN_USD_VALUE": 2.0,
        "WEEKLY_COOP_FEE_B": 1.0,
    }

    response = client.post('/run_simulation', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data is not None
    assert 'history' in data
    assert len(data['history']) == payload["SIMULATION_WEEKS"]
    assert data['history'][0]['Week'] == 1
    assert 'final_members' in data
    assert len(data['final_members']) == payload["NUM_MEMBERS"]
    assert 'key_events' in data
    assert 'summary' in data



def test_run_simulation_rate_limit_returns_429(client, monkeypatch):
    import flask_backend

    flask_backend._request_log_by_ip.clear()
    monkeypatch.setattr(flask_backend, "RATE_LIMIT_REQUESTS", 2)
    monkeypatch.setattr(flask_backend, "RATE_LIMIT_WINDOW_SECONDS", 60)

    payload = {"NUM_MEMBERS": 5, "SIMULATION_WEEKS": 1}
    headers = {"X-Forwarded-For": "203.0.113.10"}

    first = client.post('/run_simulation', json=payload, headers=headers)
    second = client.post('/run_simulation', json=payload, headers=headers)
    third = client.post('/run_simulation', json=payload, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    data = third.get_json()
    assert data is not None
    assert data["error"] == "Rate limit exceeded. Please try again shortly."
