"""HTTP API (also the tools watsonx Orchestrate calls)."""

import threading
from datetime import datetime
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from warmintro import feedback, store
from warmintro.config import MAX_MEETINGS_PER_ROUND, get_settings
from warmintro.llm import get_llm
from warmintro.meeting import run_meeting
from warmintro.resources import suggest
from warmintro.round import run_round
from warmintro.scout import scout as scout_members

app = FastAPI(
    title="Warm Intro",
    description="Agents hold short first meetings for community members and propose warm introductions. "
    "All members and meetings are synthetic; all transcripts, votes and messages are AI-generated.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["null"],  # the page may be opened from file://
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)

_round_lock = threading.Lock()  # one round at a time


@app.exception_handler(KeyError)
async def _not_found(_: Request, exc: KeyError) -> JSONResponse:
    return JSONResponse({"detail": str(exc.args[0] if exc.args else exc)}, status_code=404)


@app.exception_handler(ValueError)
async def _unprocessable(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=422)


class ScoutBody(BaseModel):
    member_id: str = Field(description="Id of the member to find matches for, e.g. m004.")
    request: str | None = Field(None, description="Optional one-off need in plain words, e.g. 'a machine vision partner'.")
    top_k: int = Field(10, ge=1, le=100, description="How many candidates to return.")


class MeetingBody(BaseModel):
    a: str = Field(description="Id of the first member; their agent speaks first.")
    b: str = Field(description="Id of the second member.")


class FeedbackBody(BaseModel):
    meeting_id: str = Field(description="Id of an earlier meeting, e.g. mt001.")
    outcome: str = Field(description="What happened after the introduction: pilot, hire, partnership or no_follow_up.")


class RoundBody(BaseModel):
    member_ids: list[str] | None = Field(None, description="Restrict the round to these members; default is everyone.")
    max_meetings: int = Field(MAX_MEETINGS_PER_ROUND, ge=1, le=50, description="Most meetings to hold.")
    request: str | None = Field(None, description="Ask mode: a need in plain words. Needs requester too.")
    requester: str | None = Field(None, description="Ask mode: id of the member who asks.")
    background: bool = Field(
        False, description="If true, return at once with the run id and let the round finish in the background."
    )


@app.get("/health", operation_id="health", summary="Check the service is up")
def health() -> dict[str, Any]:
    """Report that the API is running and which LLM provider (mock or watsonx) it uses."""
    return {"ok": True, "provider": get_settings().llm_provider}


@app.get("/members", operation_id="getMembers", summary="List all community members")
def get_members() -> dict[str, Any]:
    """List every synthetic community member with their needs, offers and deal-breakers.
    Call this first to find member ids before scouting or holding a meeting."""
    return {"synthetic": True, "members": store.load_members()}


@app.get("/resources", operation_id="getResources", summary="List real public Michigan resources")
def get_resources() -> dict[str, Any]:
    """List real, public Michigan organisations (accelerators, university programs, state agencies, manufacturing
    and workforce programs) that a member can be pointed to. They are resources, not members: they never speak,
    vote or receive messages. Each has helps_with phrases, the member types it serves, and a source url. Use
    suggestResources to match them to one member's needs."""
    return store.load_resources_doc()


@app.get("/members/{member_id}/resources", operation_id="suggestResources", summary="Suggest resources for one member")
def suggest_resources(member_id: str) -> dict[str, Any]:
    """Return up to two real Michigan organisations that best fit this member's needs, each with the need and
    the helps_with phrase that matched, and a similarity score. The matching is the only AI-generated part.
    Unknown member ids return 404."""
    member = next((m for m in store.load_members() if m["id"] == member_id), None)
    if member is None:
        raise KeyError(f"unknown member id: {member_id!r}")
    return {"member_id": member_id, "suggestions": suggest(member, store.load_resources(), get_llm()), "ai_generated": True}


@app.post("/scout", operation_id="scout", summary="Find the best matches for one member")
def scout(body: ScoutBody) -> dict[str, Any]:
    """Rank other members by how well their offers fit this member's needs. Give a request to search for a
    one-off need in plain words instead of the member's stored needs. Returns scored candidates, best first.
    Does not hold any meeting; use holdMeeting on a candidate pair next."""
    found = scout_members(body.member_id, body.request, body.top_k)
    return {"synthetic": True, "candidates": found}


@app.post("/meeting", operation_id="holdMeeting", summary="Hold one first meeting between two members' agents")
def hold_meeting(body: MeetingBody) -> dict[str, Any]:
    """Have the two members' AI agents hold a short first meeting, then vote on an introduction.
    Returns the transcript, both votes, the result (introduced, declined or blocked_by_permissions) and, if
    both voted yes, the introduction messages for each member."""
    if body.a == body.b:
        raise ValueError("a meeting needs two different members")
    candidate = next((c for c in scout_members(body.a, top_k=10_000) if c["b"] == body.b), None)
    if candidate is None:  # not a scored match: still hold the meeting, with a neutral candidate
        candidate = {
            "a": body.a, "b": body.b, "fit": 0.0, "novelty": 0.0, "weight": 1.0, "cross_hub": False,
            "score": 0.0, "label": "complementary", "evidence": [],
        }  # fmt: skip
    return {"synthetic": True, **run_meeting(body.a, body.b, candidate=candidate)}


@app.post("/feedback", operation_id="recordFeedback", summary="Record what came of an introduction")
def record_feedback(body: FeedbackBody) -> dict[str, Any]:
    """Tell the system what happened after an introduced meeting (pilot, hire, partnership or no_follow_up).
    This nudges the scoring weights so future rounds favour the kinds of matches that worked.
    Returns the weights before and after."""
    return {"synthetic": True, **feedback.record_outcome(body.meeting_id, body.outcome)}


def _background(body: RoundBody, run_id: str) -> None:
    try:
        run_round(body.member_ids, body.max_meetings, request=body.request, requester=body.requester, run_id=run_id)
    except Exception:  # noqa: BLE001 - run_round already marked the run log as failed
        pass
    finally:
        _round_lock.release()


@app.post("/round", operation_id="runRound", summary="Run a full introduction round")
def run_round_endpoint(body: RoundBody | None = None) -> dict[str, Any]:
    """Run a whole round: score every pair of members, hold meetings for the best pairs, and write the
    introductions. With background=true it returns {run_id, status: running} at once (a real-model round
    takes minutes); then poll getLatestRun until status is complete. Only one round can run at a time (409)."""
    body = body or RoundBody()
    if not _round_lock.acquire(blocking=False):
        raise HTTPException(409, "a round is already running; poll /runs/latest until its status is complete")
    if body.background:
        run_id = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        threading.Thread(target=_background, args=(body, run_id), daemon=True).start()
        return {"synthetic": True, "run_id": run_id, "status": "running"}
    try:
        return run_round(body.member_ids, body.max_meetings, request=body.request, requester=body.requester)
    finally:
        _round_lock.release()


@app.get("/runs/latest", operation_id="getLatestRun", summary="Get the most recent round's run log")
def get_latest_run() -> dict[str, Any]:
    """Return the latest run log: stats, candidates, meetings with transcripts and votes, introductions and
    the scoring weights before and after. While status is running the log fills in meeting by meeting."""
    run = store.load_latest_run()
    if run is None:
        raise HTTPException(404, "no round has run yet; call runRound first")
    return dict(run)
