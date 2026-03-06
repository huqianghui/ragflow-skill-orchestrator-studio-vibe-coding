import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.router import api_router
from app.config import get_settings
from app.database import AsyncSessionLocal, engine
from app.models import Base
from app.services.skill_seeder import seed_builtin_skills
from app.services.venv_manager import VenvManager
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev convenience; use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed built-in skills
    async with AsyncSessionLocal() as session:
        await seed_builtin_skills(session)
    # Initialize base virtual environment for skill execution
    try:
        venv_mgr = VenvManager()
        venv_mgr.ensure_base_env()
    except Exception:
        logger.warning("Failed to initialize base venv (non-fatal)", exc_info=True)

    # Start temp file cleanup task
    async def _cleanup_loop():
        from app.services.temp_file_manager import cleanup_expired_files

        while True:
            await asyncio.sleep(600)  # every 10 minutes
            cleanup_expired_files()

    cleanup_task = asyncio.create_task(_cleanup_loop())
    yield
    cleanup_task.cancel()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
        },
    )


# Register routers
app.include_router(health_router)
app.include_router(api_router, prefix=settings.api_prefix)
