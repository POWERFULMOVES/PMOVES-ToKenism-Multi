"""Tests for the sim → Wealth export HTTP trigger (spec G1, dry-run only)."""

from pathlib import Path
import random
import sys

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pmoves_backend.adapters.firefly import FireflyClient, FireflyConfig
from pmoves_backend.export_service import TOKEN_ENV, create_app
from pmoves_backend.scenarios import SCENARIOS, list_scenarios, resolve_scenario
from pmoves_backend.simulator import run_simulation

TINY_PARAMS = {
    "NUM_MEMBERS": 8,
    "SIMULATION_WEEKS": 4,
    "description": "test-tiny",
}


@pytest.fixture()
def tiny_scenario(monkeypatch):
    """Register a fast scenario so endpoint tests stay sub-second."""
    monkeypatch.setitem(
        SCENARIOS,
        "test-tiny",
        {"label": "Test Tiny", "description": "4-week test run", "overrides": TINY_PARAMS},
    )
    return "test-tiny"


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv(TOKEN_ENV, "test-token")
    monkeypatch.delenv("NATS_URL", raising=False)
    return create_app().test_client()


def _auth() -> dict:
    return {"Authorization": "Bearer test-token"}


def _seed():
    random.seed(42)
    np.random.seed(42)


# --- simulator flow aggregates (the keys the Firefly transformer consumes) ---


def test_history_carries_cash_flow_keys():
    _seed()
    history = run_simulation(dict(TINY_PARAMS))["history"]
    assert history, "expected non-empty history"
    for week in history:
        for key in ("ExternalSpend_A", "InternalTx_B", "ExternalSpend_B", "CoopFees_B"):
            assert key in week, f"missing flow aggregate {key}"
    assert sum(week["InternalTx_B"] for week in history) > 0
    assert sum(week["ExternalSpend_B"] for week in history) > 0


def test_history_exports_nonzero_transactions():
    """Regression: raw history used to transform into ZERO transactions."""
    _seed()
    history = run_simulation(dict(TINY_PARAMS))["history"]
    client = FireflyClient(FireflyConfig(api_token="dry-run-only"))
    result = client.import_simulation_results(history, dry_run=True)
    assert result["dry_run"] is True
    assert result["transaction_count"] > 0


# --- scenario library ---


def test_scenario_library_resolves_and_lists():
    listed = {item["scenario_id"] for item in list_scenarios()}
    assert "baseline" in listed
    params = resolve_scenario("high-coop-adoption")
    assert params["PERCENT_SPEND_INTERNAL_AVG"] == 0.85
    with pytest.raises(KeyError):
        resolve_scenario("no-such-scenario")


# --- auth contract (fail-closed) ---


def test_unconfigured_token_returns_503(monkeypatch):
    monkeypatch.delenv(TOKEN_ENV, raising=False)
    app_client = create_app().test_client()
    response = app_client.post(
        "/v1/tokenism/export/wealth", json={"scenario_id": "baseline"}
    )
    assert response.status_code == 503


def test_wrong_token_returns_401(client):
    response = client.post(
        "/v1/tokenism/export/wealth",
        json={"scenario_id": "baseline"},
        headers={"Authorization": "Bearer wrong"},
    )
    assert response.status_code == 401


def test_healthz_is_public(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.get_json()["auth_configured"] is True


# --- export endpoint ---


def test_non_dry_run_is_rejected(client, tiny_scenario):
    response = client.post(
        "/v1/tokenism/export/wealth",
        json={"scenario_id": tiny_scenario, "dry_run": False},
        headers=_auth(),
    )
    assert response.status_code == 400
    assert "settlement" in response.get_json()["detail"]


def test_unknown_scenario_returns_404(client):
    response = client.post(
        "/v1/tokenism/export/wealth",
        json={"scenario_id": "no-such-scenario"},
        headers=_auth(),
    )
    assert response.status_code == 404
    assert "baseline" in response.get_json()["available"]


def test_export_happy_path_dry_run(client, tiny_scenario):
    _seed()
    response = client.post(
        "/v1/tokenism/export/wealth",
        json={"scenario_id": tiny_scenario},
        headers=_auth(),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["dry_run"] is True
    assert body["scenario_id"] == tiny_scenario
    assert body["summary"]["weeks_simulated"] == TINY_PARAMS["SIMULATION_WEEKS"]
    assert body["summary"]["transaction_count"] > 0
    assert len(body["summary"]["transactions_preview"]) <= 5
    assert body["report_refs"] == []
    # NATS_URL unset in the fixture — publish must degrade gracefully.
    assert body["nats_published"] is False


def test_scenarios_route_is_token_gated(client):
    assert client.get("/v1/tokenism/export/scenarios").status_code == 401
    response = client.get("/v1/tokenism/export/scenarios", headers=_auth())
    assert response.status_code == 200
    assert any(
        item["scenario_id"] == "baseline" for item in response.get_json()["scenarios"]
    )
