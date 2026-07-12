"""HTTP trigger for the sim → PMOVES-Wealth (Firefly III) export bridge.

Spec G1 (PMOVES.AI docs/superpowers/specs/2026-07-11-tokenism-wealth-demo-wiring.md):
a thin, token-gated endpoint a room UI can call. Flask (not FastAPI) because
this repo's Python stack is already Flask — zero new web dependencies.

Auth contract:
- Requires ``Authorization: Bearer <TOKENISM_EXPORT_TOKEN>`` on /v1/* routes.
  Fail-closed: if the token env var is unset the routes return 503 rather than
  serving unauthenticated (dry-run is a safety default, NOT an access boundary).
- Single-tenant: scenario_id resolves only against the demo scenario library
  (pmoves_backend.scenarios); no caller-supplied simulator parameters.
- A non-dry-run code path DOES NOT EXIST here. Live Firefly writes may only be
  added behind the TAC_TOKENISM settlement gate (signed executor identity +
  operator approval).

Run: ``python -m pmoves_backend.export_service`` (port EXPORT_SERVICE_PORT,
default 8118).
"""

from __future__ import annotations

import hmac
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from flask import Flask, jsonify, request

from .adapters.firefly import FireflyClient, FireflyConfig
from .scenarios import SCENARIOS, list_scenarios, resolve_scenario
from .simulator import run_simulation

logger = logging.getLogger(__name__)

TOKEN_ENV = "TOKENISM_EXPORT_TOKEN"
NATS_SUBJECT = "tokenism.export.result.v1"
TRANSACTION_PREVIEW_LIMIT = 5


def _auth_error() -> tuple[Any, int] | None:
    """Bearer-token gate. Returns a Flask error response, or None if authorized."""
    expected = os.getenv(TOKEN_ENV, "")
    if not expected:
        # Fail closed — never serve unauthenticated because config is missing.
        return (
            jsonify(
                error="export service token is not configured",
                detail=f"set {TOKEN_ENV} via the env-tier secrets pipeline",
            ),
            503,
        )
    supplied = request.headers.get("Authorization", "")
    if supplied.startswith("Bearer "):
        supplied = supplied[len("Bearer ") :]
    if not hmac.compare_digest(supplied, expected):
        return jsonify(error="invalid or missing bearer token"), 401
    return None


def _publish_result(payload: dict[str, Any]) -> bool:
    """Best-effort NATS publish of the export result. Never fails the request."""
    nats_url = os.getenv("NATS_URL", "")
    if not nats_url:
        logger.info("NATS_URL unset — skipping %s publish", NATS_SUBJECT)
        return False
    try:
        import asyncio

        import nats  # type: ignore[import-not-found]

        async def _publish() -> None:
            client = await nats.connect(nats_url, connect_timeout=5)
            try:
                await client.publish(
                    NATS_SUBJECT, json.dumps(payload).encode("utf-8")
                )
                await client.flush(timeout=5)
            finally:
                await client.close()

        asyncio.run(_publish())
        logger.info("published %s", NATS_SUBJECT)
        return True
    except ModuleNotFoundError:
        logger.warning("nats-py not installed — skipping %s publish", NATS_SUBJECT)
        return False
    except Exception:  # noqa: BLE001 — publish is best-effort by contract
        logger.exception("NATS publish failed for %s", NATS_SUBJECT)
        return False


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/healthz")
    def healthz() -> Any:
        return jsonify(
            status="ok",
            service="tokenism-wealth-export",
            scenarios=len(SCENARIOS),
            auth_configured=bool(os.getenv(TOKEN_ENV, "")),
        )

    @app.get("/v1/tokenism/export/scenarios")
    def scenarios() -> Any:
        error = _auth_error()
        if error:
            return error
        return jsonify(scenarios=list_scenarios())

    @app.post("/v1/tokenism/export/wealth")
    def export_wealth() -> Any:
        error = _auth_error()
        if error:
            return error

        body = request.get_json(silent=True) or {}
        scenario_id = body.get("scenario_id")
        if not scenario_id or not isinstance(scenario_id, str):
            return jsonify(error="scenario_id (string) is required"), 400

        # dry_run is accepted for forward-compatibility but only True is legal:
        # the live-write path is gated by TAC_TOKENISM settlement and is not
        # implemented in this service at all.
        if body.get("dry_run", True) is not True:
            return (
                jsonify(
                    error="non-dry-run export is not available",
                    detail=(
                        "live Firefly writes require the TAC_TOKENISM settlement "
                        "gate (signed executor identity + operator approval); "
                        "this endpoint only supports dry_run=true"
                    ),
                ),
                400,
            )

        try:
            params = resolve_scenario(scenario_id)
        except KeyError:
            return (
                jsonify(
                    error=f"unknown scenario_id {scenario_id!r}",
                    available=[item["scenario_id"] for item in list_scenarios()],
                ),
                404,
            )

        history = run_simulation(params)["history"]

        # Dry-run never talks to Firefly, so a placeholder token is safe here —
        # FireflyConfig.from_env() is only appropriate on a future live path.
        client = FireflyClient(FireflyConfig(api_token="dry-run-only"))
        result = client.import_simulation_results(history, dry_run=True)
        transactions = result["transactions"]

        exported_at = datetime.now(timezone.utc).isoformat()
        response = {
            "scenario_id": scenario_id,
            "dry_run": True,
            "summary": {
                "weeks_simulated": len(history),
                "transaction_count": result["transaction_count"],
                "transactions_preview": transactions[:TRANSACTION_PREVIEW_LIMIT],
            },
            "report_refs": [],
            "exported_at": exported_at,
        }
        response["nats_published"] = _publish_result(
            {
                "type": "simulation_export",
                "target": "firefly-iii",
                "result": {
                    "scenario_id": scenario_id,
                    "dryRun": True,
                    "weeksSimulated": len(history),
                    "transactionCount": result["transaction_count"],
                },
                "timestamp": exported_at,
            }
        )
        return jsonify(response)

    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    port = int(os.getenv("EXPORT_SERVICE_PORT", "8118"))
    create_app().run(host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
