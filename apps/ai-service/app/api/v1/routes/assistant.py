import json
from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.api.deps.services import get_assistant_service
from app.api.v1.schemas.chat import ChatRequest, ChatResponse, ServiceInfo
from app.api.v1.schemas.classification import (
    JobClassificationRequest,
    JobClassificationResponse,
)
from app.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant", tags=["assistant"])
AssistantServiceDep = Annotated[AssistantService, Depends(get_assistant_service)]


@router.get("/info", response_model=ServiceInfo)
async def assistant_info(
    service: AssistantServiceDep,
) -> ServiceInfo:
    return service.service_info()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    service: AssistantServiceDep,
) -> ChatResponse:
    return await run_in_threadpool(service.run_chat, request)


@router.post("/chat/stream")
def chat_stream(
    request: ChatRequest,
    service: AssistantServiceDep,
) -> StreamingResponse:
    def event_generator() -> Iterator[str]:
        for update in service.stream_chat(request):
            try:
                payload = json.dumps(update)
            except TypeError:
                payload = json.dumps({"response": str(update)})
            yield f"data: {payload}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/classify-job", response_model=JobClassificationResponse)
async def classify_job(
    request: JobClassificationRequest,
    service: AssistantServiceDep,
) -> JobClassificationResponse:
    return await run_in_threadpool(service.classify_job, request)
