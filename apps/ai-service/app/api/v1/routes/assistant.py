import json
from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.api.deps.auth import TokenPayload, verify_token
from app.api.deps.services import get_assistant_service
from app.api.v1.schemas.chat import ChatRequest, ChatResponse, ServiceInfo
from app.api.v1.schemas.classification import (
    JobClassificationBatchRequest,
    JobClassificationBatchResponse,
    JobClassificationRequest,
    JobClassificationResponse,
)
from app.api.v1.schemas.translation import TranslateRequest, TranslateResponse
from app.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant", tags=["assistant"])
AssistantServiceDep = Annotated[AssistantService, Depends(get_assistant_service)]
AuthDep = Annotated[TokenPayload, Depends(verify_token)]


@router.get("/info", response_model=ServiceInfo)
async def assistant_info(
    service: AssistantServiceDep,
    _: AuthDep,
) -> ServiceInfo:
    return service.service_info()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    service: AssistantServiceDep,
    _: AuthDep,
) -> ChatResponse:
    return await run_in_threadpool(service.run_chat, request)


@router.post("/chat/stream")
def chat_stream(
    request: ChatRequest,
    service: AssistantServiceDep,
    _: AuthDep,
) -> StreamingResponse:
    def event_generator() -> Iterator[str]:
        for update in service.stream_chat(request):
            try:
                payload = json.dumps(update)
            except TypeError:
                payload = json.dumps({"response": str(update)})
            yield f"data: {payload}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    request: TranslateRequest,
    service: AssistantServiceDep,
    _: AuthDep,
) -> TranslateResponse:
    return await run_in_threadpool(service.translate, request)


@router.post("/classify-job", response_model=JobClassificationResponse)
async def classify_job(
    request: JobClassificationRequest,
    service: AssistantServiceDep,
    _: AuthDep,
) -> JobClassificationResponse:
    return await run_in_threadpool(service.classify_job, request)


@router.post("/classify-jobs/batch", response_model=JobClassificationBatchResponse)
async def classify_jobs_batch(
    request: JobClassificationBatchRequest,
    service: AssistantServiceDep,
    _: AuthDep,
) -> JobClassificationBatchResponse:
    """Classify many jobs in parallel via the Send-based orchestrator graph.
    Workers run concurrently with shared retry policy; results are returned in
    the same order the items were submitted.
    """
    return await run_in_threadpool(service.classify_jobs_batch, request)
