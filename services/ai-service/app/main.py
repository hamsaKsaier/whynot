from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.infrastructure.platform_config import prefetch as prefetch_platform_config
import os
import logging
from dotenv import load_dotenv

load_dotenv()

# Configure logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Test Generation Service",
    description="AI-powered test case generation and vision analysis",
    version="1.0.0"
)

# CORS configuration
# In production, CORS_ORIGINS should be set to the gateway URL only (e.g. "http://gateway:3000")
# The ai-service is an internal service — it should NOT be directly accessible from browsers.
# Default to restrictive origins in production; allow all only in development.
_default_origins = "http://localhost:3000,http://localhost:5183" if os.getenv("NODE_ENV") != "production" else ""
_cors_origins = os.getenv("CORS_ORIGINS", _default_origins)
_allowed_origins = [o.strip() for o in _cors_origins.split(",") if o.strip()] if _cors_origins else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-Workspace-ID", "X-User-ID"],
)

app.include_router(router)


@app.on_event("startup")
async def _hydrate_platform_config() -> None:
    prefetch_platform_config()


@app.get("/")
async def root():
    return {
        "service": "AI Test Generation Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "generate_tests": "/api/generate-tests",
            "analyze_screenshot": "/api/analyze-screenshot"
        }
    }

