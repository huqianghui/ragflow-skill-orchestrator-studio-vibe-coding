"""SessionProxy — thin proxy layer for agent session metadata and messages."""

import math

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_message import AgentMessage
from app.models.agent_session import AgentSession


class SessionProxy:
    """Manages session metadata and persisted chat messages."""

    async def create(
        self,
        db: AsyncSession,
        agent_name: str,
        source: str,
        mode: str,
    ) -> AgentSession:
        session = AgentSession(
            agent_name=agent_name,
            source=source,
            mode=mode,
            title="New Session",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    async def get(self, db: AsyncSession, session_id: str) -> AgentSession | None:
        result = await db.execute(select(AgentSession).where(AgentSession.id == session_id))
        return result.scalar_one_or_none()

    async def list_sessions(
        self,
        db: AsyncSession,
        source: str | None = None,
        agent_name: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """Return paginated sessions in standard PaginatedResponse format."""
        query = select(AgentSession)
        count_query = select(func.count()).select_from(AgentSession)
        if source:
            query = query.where(AgentSession.source == source)
            count_query = count_query.where(AgentSession.source == source)
        if agent_name:
            query = query.where(AgentSession.agent_name == agent_name)
            count_query = count_query.where(AgentSession.agent_name == agent_name)
        query = query.order_by(AgentSession.updated_at.desc())

        # Get total count
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        items = list(result.scalars().all())

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": math.ceil(total / page_size) if page_size > 0 else 0,
        }

    async def update_native_id(self, db: AsyncSession, session_id: str, native_id: str) -> None:
        """Store native session id mapping after first conversation."""
        result = await db.execute(select(AgentSession).where(AgentSession.id == session_id))
        session = result.scalar_one()
        session.native_session_id = native_id
        await db.commit()

    async def update_title(self, db: AsyncSession, session_id: str, title: str) -> None:
        result = await db.execute(select(AgentSession).where(AgentSession.id == session_id))
        session = result.scalar_one()
        session.title = title[:255]
        await db.commit()

    async def delete(self, db: AsyncSession, session_id: str) -> bool:
        """Delete a session and its messages. Returns True if found and deleted."""
        result = await db.execute(select(AgentSession).where(AgentSession.id == session_id))
        session = result.scalar_one_or_none()
        if session:
            # Delete associated messages first
            msgs = await db.execute(
                select(AgentMessage).where(AgentMessage.session_id == session_id)
            )
            for msg in msgs.scalars().all():
                await db.delete(msg)
            await db.delete(session)
            await db.commit()
            return True
        return False

    # ------------------------------------------------------------------
    # Message persistence
    # ------------------------------------------------------------------

    async def save_message(
        self, db: AsyncSession, session_id: str, role: str, content: str
    ) -> AgentMessage:
        """Persist a single chat message."""
        msg = AgentMessage(session_id=session_id, role=role, content=content)
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        return msg

    async def get_messages(self, db: AsyncSession, session_id: str) -> list[AgentMessage]:
        """Return all messages for a session, ordered by creation time."""
        result = await db.execute(
            select(AgentMessage)
            .where(AgentMessage.session_id == session_id)
            .order_by(AgentMessage.created_at.asc())
        )
        return list(result.scalars().all())


session_proxy = SessionProxy()
