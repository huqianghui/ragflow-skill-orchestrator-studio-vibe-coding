from fastapi import APIRouter

from app.api import agents, connections, data_sources, pipelines, runs, skills, targets

api_router = APIRouter()
api_router.include_router(connections.router)
api_router.include_router(skills.router)
api_router.include_router(pipelines.router)
api_router.include_router(data_sources.router)
api_router.include_router(targets.router)
api_router.include_router(runs.router)
api_router.include_router(agents.router)
