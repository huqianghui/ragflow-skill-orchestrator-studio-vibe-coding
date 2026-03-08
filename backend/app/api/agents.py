"""Agent REST + WebSocket API routes."""

import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.schemas.agent import (
    AgentChatMessage,
    AgentInfoResponse,
    AgentSessionResponse,
    CreateSessionRequest,
)
from app.services.agents.base import AgentContext, AgentMode, AgentRequest
from app.services.agents.context_builder import context_builder
from app.services.agents.registry import registry
from app.services.agents.session_proxy import session_proxy
from app.utils.exceptions import NotFoundException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.get("/available")
async def list_available_agents() -> list[AgentInfoResponse]:
    """Detect and return all registered agents with availability status."""
    infos = await registry.discover()
    return [
        AgentInfoResponse(
            name=i.name,
            display_name=i.display_name,
            icon=i.icon,
            description=i.description,
            modes=[m.value for m in i.modes],
            available=i.available,
            version=i.version,
            provider=i.provider,
            model=i.model,
            install_hint=i.install_hint,
            tools=i.tools,
            mcp_servers=i.mcp_servers,
        )
        for i in infos
    ]


@router.get("/{agent_name}/config")
async def get_agent_config(agent_name: str) -> dict:
    """Return the actual config read from the agent's settings files."""
    try:
        adapter = registry.get(agent_name)
    except ValueError:
        raise NotFoundException("Agent", agent_name)
    return await adapter.get_config()


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest, db: AsyncSession = Depends(get_db)
) -> AgentSessionResponse:
    """Create a new agent session record."""
    session = await session_proxy.create(db, body.agent_name, body.source, body.mode)
    return AgentSessionResponse.model_validate(session)


@router.get("/sessions")
async def list_sessions(
    source: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List sessions, optionally filtered by source."""
    result = await session_proxy.list_sessions(db, source, page, page_size)
    # Convert ORM objects to response dicts
    result["items"] = [AgentSessionResponse.model_validate(s) for s in result["items"]]
    return result


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)) -> AgentSessionResponse:
    session = await session_proxy.get(db, session_id)
    if not session:
        raise NotFoundException("Session", session_id)
    return AgentSessionResponse.model_validate(session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)) -> Response:
    deleted = await session_proxy.delete(db, session_id)
    if not deleted:
        raise NotFoundException("Session", session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@router.websocket("/sessions/{session_id}/ws")
async def agent_chat_ws(websocket: WebSocket, session_id: str) -> None:
    """WebSocket streaming chat with an agent."""
    await websocket.accept()

    # Get session info using a fresh db session
    async with AsyncSessionLocal() as db:
        session = await session_proxy.get(db, session_id)

    if not session:
        await websocket.send_json({"type": "error", "content": "Session not found", "metadata": {}})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                continue

            # Validate input
            try:
                msg = AgentChatMessage(**data)
            except Exception:
                await websocket.send_json(
                    {
                        "type": "error",
                        "content": "Invalid message format",
                        "metadata": {},
                    }
                )
                continue

            # Build request
            agent = registry.get(session.agent_name)
            context = AgentContext(**msg.context) if msg.context else None
            full_prompt = context_builder.build(msg.context, msg.content)
            request = AgentRequest(
                prompt=full_prompt,
                mode=AgentMode(msg.mode or session.mode),
                session_id=session.native_session_id,
                context=context,
            )

            # Stream execute with error isolation
            events = []
            try:
                async for event in agent.execute(request):
                    events.append(event)
                    await websocket.send_json(
                        {
                            "type": event.type,
                            "content": event.content,
                            "metadata": event.metadata,
                        }
                    )
            except Exception as exc:
                logger.error("Agent execution failed: %s", exc, exc_info=True)
                await websocket.send_json(
                    {
                        "type": "error",
                        "content": f"Agent execution failed: {exc}",
                        "metadata": {},
                    }
                )

            # First conversation: extract and save native session id
            if not session.native_session_id:
                native_id = agent.extract_session_id(events)
                if native_id:
                    async with AsyncSessionLocal() as fresh_db:
                        await session_proxy.update_native_id(fresh_db, session_id, native_id)
                    session.native_session_id = native_id

            # Update title if still default
            if session.title == "New Session" and msg.content:
                title = msg.content[:30]
                async with AsyncSessionLocal() as fresh_db:
                    await session_proxy.update_title(fresh_db, session_id, title)
                session.title = title

            # Send done event
            await websocket.send_json({"type": "done", "content": "", "metadata": {}})

    except WebSocketDisconnect:
        pass
