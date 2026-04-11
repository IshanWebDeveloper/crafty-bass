from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.schemas.chat import ChatRequest, ChatResponse, ServiceInfo
from app.schemas.classification import (
    JobClassificationRequest,
    JobClassificationResponse,
)
from app.services.ollama_graphs import get_ollama_graph_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/info", response_model=ServiceInfo)
async def assistant_info() -> ServiceInfo:
    service = get_ollama_graph_service()
    return service.service_info()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    service = get_ollama_graph_service()
    return await run_in_threadpool(service.run_chat, request)


@router.post("/classify-job", response_model=JobClassificationResponse)
async def classify_job(request: JobClassificationRequest) -> JobClassificationResponse:
    service = get_ollama_graph_service()
    return await run_in_threadpool(service.classify_job, request)
