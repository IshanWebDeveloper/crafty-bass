# AI service image (build context: apps/ai-service).
#
#   docker build -t crafty-bass-ai apps/ai-service
#
# Listens on 0.0.0.0:8006 inside the container. In production nothing
# publishes this port: only the backend reaches it over the private Docker
# network (see deploy/oracle/docker-compose.yml).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv
COPY pyproject.toml README.md constraints.txt ./
COPY app ./app
# constraints.txt pins every dependency to the versions the service is
# developed and tested with (pip freeze of the local .venv). Without it a fresh
# build resolves newer anthropic/langchain-anthropic releases that reject the
# requests the service sends. Regenerate it after upgrading the local venv.
RUN pip install --upgrade pip && pip install -c constraints.txt .

EXPOSE 8006
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8006/api/v1/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8006", "--proxy-headers"]
