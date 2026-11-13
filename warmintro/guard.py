"""Public-deployment guards: rate limits on the LLM-calling endpoints and the presenter key.

In-memory and per process (Code Engine runs one instance). The presenter key is WARMINTRO_ADMIN_KEY;
when it is unset every guard except the rate limits is off.
"""

import hmac
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request

from warmintro.config import get_settings
from warmintro.store import RESET_FILES

PER_IP_LIMIT = 10  # LLM requests per client IP per minute
ROUND_MIN_INTERVAL = 60.0  # seconds between round starts
_MINUTE, _HOUR = 60.0, 3600.0

_clock: Callable[[], float] = time.monotonic  # tests replace this
_lock = threading.Lock()
_per_ip: dict[str, deque[float]] = defaultdict(deque)
_hourly: deque[float] = deque()
_last_round: list[float] = []


def reset_limits() -> None:
    with _lock:
        _per_ip.clear()
        _hourly.clear()
        _last_round.clear()


def is_admin(key: str | None) -> bool:
    expected = get_settings().admin_key
    return bool(expected) and hmac.compare_digest((key or "").encode(), expected.encode())


def _busy(seconds: float) -> HTTPException:
    wait = max(1, int(seconds + 0.999))
    return HTTPException(429, f"Your agent is busy; try again in {wait} seconds.", headers={"Retry-After": str(wait)})


def _retry_after(stamps: deque[float], now: float, window: float, limit: int) -> float:
    """Drop expired stamps; return seconds until a slot frees up (0 if one is free now)."""
    while stamps and now - stamps[0] >= window:
        stamps.popleft()
    return stamps[0] + window - now if len(stamps) >= limit else 0.0


def _check(request: Request, is_round: bool) -> None:
    settings = get_settings()
    if not settings.rate_limits:
        return
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    with _lock:
        now = _clock()
        ip_stamps = _per_ip[ip]
        wait = 0.0
        if not is_admin(request.headers.get("x-admin-key")):
            wait = _retry_after(ip_stamps, now, _MINUTE, PER_IP_LIMIT)
        wait = max(wait, _retry_after(_hourly, now, _HOUR, settings.hourly_llm_cap))
        if is_round and _last_round:
            wait = max(wait, _last_round[0] + ROUND_MIN_INTERVAL - now)
        if wait > 0:
            raise _busy(wait)
        ip_stamps.append(now)
        _hourly.append(now)
        if is_round:
            _last_round[:] = [now]


def limit_llm(request: Request) -> None:
    """Dependency for endpoints that call the model."""
    _check(request, is_round=False)


def limit_round(request: Request) -> None:
    """Dependency for POST /round: the per-IP and hourly limits plus a minimum gap between starts."""
    _check(request, is_round=True)


# --- demo-state snapshot for POST /admin/reset ---

_snapshot: dict[str, bytes | None] = {}


def take_snapshot() -> None:
    """Remember the pristine demo files (None = absent) so /admin/reset can restore them."""
    s = get_settings()
    _snapshot.clear()
    for rel in RESET_FILES:
        base = s.data_dir if rel[0] == "data" else s.runs_dir
        path = base / rel[1]
        _snapshot[rel[0] + "/" + rel[1]] = path.read_bytes() if path.exists() else None


def restore_snapshot() -> None:
    s = get_settings()
    for key, content in _snapshot.items():
        kind, name = key.split("/")
        path = (s.data_dir if kind == "data" else s.runs_dir) / name
        if content is None:
            path.unlink(missing_ok=True)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_name(f".{path.name}.reset")
            tmp.write_bytes(content)
            tmp.replace(path)
