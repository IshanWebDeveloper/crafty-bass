import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import app.core.auth as auth_module
from app.core.auth import (
    TokenPayload,
    _expected_audience,
    _expected_issuer,
    verify_token,
)

AUDIENCE = "ai-service"
ISSUER = "http://localhost:3005"


@pytest.fixture
def keypair() -> tuple[bytes, bytes]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


@pytest.fixture(autouse=True)
def _env_and_caches(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_AUDIENCE", AUDIENCE)
    monkeypatch.setenv("JWT_ISSUER", ISSUER)
    monkeypatch.setenv("BETTER_AUTH_URL", ISSUER)
    # These helpers are lru_cache'd — clear them so each test sees fresh env.
    _clear_caches()
    yield
    # By teardown, get_jwks_client may have been monkeypatched to a plain
    # function (no cache_clear), so guard each clear.
    _clear_caches()


def _clear_caches() -> None:
    for name in ("get_jwks_client", "_expected_audience", "_expected_issuer"):
        clear = getattr(getattr(auth_module, name), "cache_clear", None)
        if clear is not None:
            clear()


def _stub_jwks(monkeypatch: pytest.MonkeyPatch, public_pem: bytes) -> None:
    class _FakeKey:
        key = public_pem

    class _FakeJwks:
        def get_signing_key_from_jwt(self, _token: str) -> _FakeKey:
            return _FakeKey()

    monkeypatch.setattr(auth_module, "get_jwks_client", lambda: _FakeJwks())


def _make_token(private_pem: bytes, **overrides: object) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": "user-123",
        "email": "user@example.com",
        "aud": AUDIENCE,
        "iss": ISSUER,
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(overrides)
    # A value of None means "omit this claim" (used to test a missing sub).
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, private_pem, algorithm="RS256")


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_valid_token_returns_payload(
    monkeypatch: pytest.MonkeyPatch, keypair: tuple[bytes, bytes]
) -> None:
    private_pem, public_pem = keypair
    _stub_jwks(monkeypatch, public_pem)
    payload = verify_token(_creds(_make_token(private_pem)))
    assert isinstance(payload, TokenPayload)
    assert payload.sub == "user-123"
    assert payload.email == "user@example.com"


def test_expired_token_is_rejected(
    monkeypatch: pytest.MonkeyPatch, keypair: tuple[bytes, bytes]
) -> None:
    private_pem, public_pem = keypair
    _stub_jwks(monkeypatch, public_pem)
    now = int(time.time())
    token = _make_token(private_pem, iat=now - 7200, exp=now - 3600)
    with pytest.raises(HTTPException) as exc:
        verify_token(_creds(token))
    assert exc.value.status_code == 401


def test_wrong_audience_is_rejected(
    monkeypatch: pytest.MonkeyPatch, keypair: tuple[bytes, bytes]
) -> None:
    private_pem, public_pem = keypair
    _stub_jwks(monkeypatch, public_pem)
    token = _make_token(private_pem, aud="some-other-service")
    with pytest.raises(HTTPException) as exc:
        verify_token(_creds(token))
    assert exc.value.status_code == 401


def test_wrong_issuer_is_rejected(
    monkeypatch: pytest.MonkeyPatch, keypair: tuple[bytes, bytes]
) -> None:
    private_pem, public_pem = keypair
    _stub_jwks(monkeypatch, public_pem)
    token = _make_token(private_pem, iss="https://evil.example.com")
    with pytest.raises(HTTPException) as exc:
        verify_token(_creds(token))
    assert exc.value.status_code == 401


def test_missing_sub_is_rejected(
    monkeypatch: pytest.MonkeyPatch, keypair: tuple[bytes, bytes]
) -> None:
    private_pem, public_pem = keypair
    _stub_jwks(monkeypatch, public_pem)
    token = _make_token(private_pem, sub=None)
    with pytest.raises(HTTPException) as exc:
        verify_token(_creds(token))
    assert exc.value.status_code == 401


def test_missing_audience_env_raises_runtime_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("JWT_AUDIENCE", raising=False)
    # Also neutralise the .env-backed settings source so nothing supplies it.
    monkeypatch.setattr(auth_module, "get_settings", lambda: SimpleNamespace())
    auth_module._expected_audience.cache_clear()
    with pytest.raises(RuntimeError):
        _expected_audience()


def test_missing_issuer_env_raises_runtime_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("JWT_ISSUER", raising=False)
    monkeypatch.setattr(auth_module, "get_settings", lambda: SimpleNamespace())
    auth_module._expected_issuer.cache_clear()
    with pytest.raises(RuntimeError):
        _expected_issuer()
