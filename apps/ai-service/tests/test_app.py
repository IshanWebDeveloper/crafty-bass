from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_root_returns_service_metadata() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Crafty Bass AI Service"
    assert body["environment"] == "development"
    assert body["docs"] == "/docs"
    assert body["api"] == "/api/v1"


async def test_healthcheck_returns_ok_status() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "Crafty Bass AI Service"
    assert body["environment"] == "development"
