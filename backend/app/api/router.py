from fastapi import APIRouter

from app.api import data_sources, pipelines, runs, skills, targets

api_router = APIRouter()
api_router.include_router(skills.router)
api_router.include_router(pipelines.router)
api_router.include_router(data_sources.router)
api_router.include_router(targets.router)
api_router.include_router(runs.router)
