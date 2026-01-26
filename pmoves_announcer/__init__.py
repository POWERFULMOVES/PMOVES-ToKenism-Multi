"""
PMOVES.AI Service Announcer Template

NATS service discovery announcer for all PMOVES services.
Publishes service announcements to the services.announce.v1 subject.

This module provides:
- ServiceAnnouncer: Main class for announcing service availability
- ServiceAnnouncement: Data class for announcement messages
- BackgroundAnnouncer: Periodic re-announcement for long-running services
- announce_service(): Convenience function for one-time announcements

Usage:
    from pmoves_announcer import ServiceAnnouncer, announce_service

    # Create announcement
    announcer = ServiceAnnouncer(
        slug="my-service",
        name="My Service",
        url="http://my-service:8080",
        port=8080,
        tier="api"
    )

    # Announce on startup
    await announcer.announce()

    # Or use the convenience function
    await announce_service(
        slug="my-service",
        name="My Service",
        url="http://my-service:8080",
        port=8080,
        tier="api"
    )

NATS Subject: services.announce.v1
Message Format: JSON with slug, name, url, health_check, tier, port, timestamp, metadata
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import warnings
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

# Configure module logger
logger = logging.getLogger(__name__)

__all__ = [
    "ServiceTier",
    "ServiceAnnouncement",
    "ServiceAnnouncer",
    "BackgroundAnnouncer",
    "announce_service",
]


# Import ServiceTier from shared types if available, otherwise define locally
try:
    from pmoves_common import ServiceTier
except ImportError:
    warnings.warn(
        "pmoves_common not available, using local ServiceTier definition. "
        "Install pmoves_common for consistency.",
        ImportWarning,
        stacklevel=2,
    )
    from enum import Enum

    class ServiceTier(str, Enum):
        """PMOVES service tiers (6-tier architecture)."""
        DATA = "data"
        API = "api"
        LLM = "llm"
        MEDIA = "media"
        AGENT = "agent"
        WORKER = "worker"


@dataclass
class ServiceAnnouncement:
    """
    Service announcement message format for NATS.

    Services publish announcements on the `services.announce.v1` subject
    to notify other services of their availability and configuration.
    """

    slug: str
    name: str
    url: str
    health_check: str
    tier: ServiceTier
    port: int
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)

    # NATS subject for announcements
    SUBJECT: str = "services.announce.v1"

    def to_json(self) -> str:
        """Convert to JSON for NATS publishing."""
        data = {
            "slug": self.slug,
            "name": self.name,
            "url": self.url,
            "health_check": self.health_check,
            "tier": self.tier.value if isinstance(self.tier, ServiceTier) else self.tier,
            "port": self.port,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }
        return json.dumps(data)

    @classmethod
    def from_json(cls, data: Union[str, dict]) -> "ServiceAnnouncement":
        """Parse from JSON message.

        Args:
            data: JSON string or dictionary

        Returns:
            ServiceAnnouncement instance

        Raises:
            ValueError: If JSON is invalid or required fields are missing
        """
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in service announcement: {e}") from e

        required_fields = ["slug", "name", "url", "health_check", "tier", "port"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise ValueError(f"Service announcement missing required fields: {missing}")

        return cls(
            slug=data["slug"],
            name=data["name"],
            url=data["url"],
            health_check=data["health_check"],
            tier=ServiceTier(data["tier"]),
            port=data["port"],
            timestamp=data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            metadata=data.get("metadata", {}),
        )


class ServiceAnnouncer:
    """
    NATS service announcer for PMOVES services.

    Handles announcing service availability to the PMOVES service mesh.
    """

    def __init__(
        self,
        slug: str,
        name: str,
        url: str,
        port: int,
        tier: Union[ServiceTier, str],
        health_check: Optional[str] = None,
        nats_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize the service announcer.

        Args:
            slug: Unique service identifier (e.g., "hirag-v2")
            name: Human-readable service name
            url: Full service URL
            port: Service port number
            tier: Service tier (api, agent, worker, etc.)
            health_check: Health check URL (defaults to url + /healthz)
            nats_url: NATS server URL (defaults to NATS_URL env var)
            metadata: Additional service metadata
        """
        # Input validation
        if not slug or not isinstance(slug, str):
            raise ValueError(f"slug must be a non-empty string, got: {slug!r}")
        if not name or not isinstance(name, str):
            raise ValueError(f"name must be a non-empty string, got: {name!r}")
        if not url or not isinstance(url, str):
            raise ValueError(f"url must be a non-empty string, got: {url!r}")
        if not isinstance(port, int) or port < 1 or port > 65535:
            raise ValueError(f"port must be an integer 1-65535, got: {port!r}")

        self.slug = slug
        self.name = name
        self.url = url
        self.port = port

        if isinstance(tier, str):
            try:
                tier = ServiceTier(tier.lower())
            except ValueError:
                valid_tiers = [t.value for t in ServiceTier]
                raise ValueError(f"Invalid tier '{tier}'. Must be one of: {valid_tiers}")
        self.tier = tier

        self.health_check = health_check or f"{url.rstrip('/')}/healthz"
        self.nats_url = nats_url or os.getenv("NATS_URL", "nats://nats:4222")
        self.metadata = metadata or {}

    def create_announcement(self) -> ServiceAnnouncement:
        """Create a service announcement object."""
        return ServiceAnnouncement(
            slug=self.slug,
            name=self.name,
            url=self.url,
            health_check=self.health_check,
            tier=self.tier,
            port=self.port,
            timestamp=datetime.now(timezone.utc).isoformat(),
            metadata=self.metadata,
        )

    async def announce(self) -> bool:
        """
        Publish service announcement to NATS.

        Returns:
            True if announcement published successfully
        """
        nc = None
        try:
            from nats.aio.client import Client as NATS
        except ImportError as e:
            logger.error(
                "NATS library not installed",
                extra={"service_slug": self.slug, "error": str(e)},
            )
            raise

        try:
            announcement = self.create_announcement()

            # Correct NATS client instantiation
            nc = NATS()
            await nc.connect(self.nats_url, connect_timeout=5)
            await nc.publish(
                ServiceAnnouncement.SUBJECT,
                announcement.to_json().encode(),
            )
            await nc.flush()
            logger.debug(
                "Service announced successfully",
                extra={"service_slug": self.slug, "nats_url": self.nats_url},
            )
            return True
        except asyncio.TimeoutError:
            logger.error(
                "NATS connection timed out",
                extra={"service_slug": self.slug, "nats_url": self.nats_url},
            )
            return False
        except ConnectionRefusedError:
            logger.error(
                "NATS server not available",
                extra={"service_slug": self.slug, "nats_url": self.nats_url},
            )
            return False
        except Exception as e:
            logger.error(
                "Failed to announce service",
                extra={"service_slug": self.slug, "error": str(e), "error_type": type(e).__name__},
            )
            return False
        finally:
            if nc and nc.is_connected:
                try:
                    await nc.close()
                except Exception as close_error:
                    logger.warning(
                        "Failed to close NATS connection",
                        extra={"error": str(close_error)},
                    )

    async def announce_with_retry(
        self, max_retries: int = 3, delay: float = 1.0
    ) -> bool:
        """
        Announce service with retry logic.

        Args:
            max_retries: Maximum number of retry attempts
            delay: Delay between retries in seconds

        Returns:
            True if announcement published successfully
        """
        for attempt in range(max_retries):
            if await self.announce():
                return True
            if attempt < max_retries - 1:
                await asyncio.sleep(delay * (2**attempt))  # Exponential backoff
        return False


async def announce_service(
    slug: str,
    name: str,
    url: str,
    port: int,
    tier: Union[ServiceTier, str],
    health_check: Optional[str] = None,
    nats_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Convenience function to announce a service.

    Args:
        slug: Unique service identifier
        name: Human-readable service name
        url: Full service URL
        port: Service port
        tier: Service tier
        health_check: Health check URL
        nats_url: NATS server URL
        metadata: Additional metadata

    Returns:
        True if announcement successful

    Example:
        await announce_service(
            slug="hirag-v2",
            name="Hi-RAG Gateway v2",
            url="http://hi-rag-gateway-v2:8086",
            port=8086,
            tier="api",
            metadata={"gpu_port": 8087}
        )
    """
    announcer = ServiceAnnouncer(
        slug=slug,
        name=name,
        url=url,
        port=port,
        tier=tier,
        health_check=health_check,
        nats_url=nats_url,
        metadata=metadata,
    )
    return await announcer.announce()


class BackgroundAnnouncer:
    """
    Background service announcer that announces periodically.

    Useful for services that want to periodically re-announce themselves.
    """

    def __init__(
        self,
        announcer: ServiceAnnouncer,
        interval: float = 60.0,
    ):
        """
        Initialize background announcer.

        Args:
            announcer: Service announcer to use
            interval: Announcement interval in seconds
        """
        self.announcer = announcer
        self.interval = interval
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def _announce_loop(self):
        """Internal announcement loop."""
        consecutive_failures = 0
        while self._running:
            success = await self.announcer.announce()
            if not success:
                consecutive_failures += 1
                logger.warning(
                    "Service announcement failed",
                    extra={
                        "service_slug": self.announcer.slug,
                        "consecutive_failures": consecutive_failures,
                    },
                )
                if consecutive_failures >= 5:
                    logger.error(
                        "Service announcement repeatedly failing",
                        extra={
                            "service_slug": self.announcer.slug,
                            "consecutive_failures": consecutive_failures,
                        },
                    )
            else:
                if consecutive_failures > 0:
                    logger.info(
                        "Service announcement recovered",
                        extra={"service_slug": self.announcer.slug},
                    )
                consecutive_failures = 0
            await asyncio.sleep(self.interval)

    async def start(self):
        """Start background announcements."""
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._announce_loop())
            # Initial announcement
            await self.announcer.announce()

    async def stop(self):
        """Stop background announcements."""
        if self._running:
            self._running = False
            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass


# Example usage and testing
if __name__ == "__main__":
    async def main():
        """Example usage of service announcer."""

        # Example 1: Simple announcement
        await announce_service(
            slug="example-service",
            name="Example Service",
            url="http://localhost:8080",
            port=8080,
            tier="api",
        )
        print("Service announced!")

        # Example 2: With metadata
        await announce_service(
            slug="hirag-v2",
            name="Hi-RAG Gateway v2",
            url="http://hi-rag-gateway-v2:8086",
            port=8086,
            tier="api",
            metadata={
                "gpu_port": 8087,
                "features": ["vector", "graph", "fulltext"],
                "rerank_enabled": True,
            },
        )

        # Example 3: Background announcer
        announcer = ServiceAnnouncer(
            slug="bg-service",
            name="Background Service",
            url="http://localhost:8081",
            port=8081,
            tier="worker",
        )
        bg = BackgroundAnnouncer(announcer, interval=30)
        await bg.start()
        print("Background announcer started (30s interval)")

        # Keep running...
        await asyncio.sleep(10)
        await bg.stop()

    asyncio.run(main())
