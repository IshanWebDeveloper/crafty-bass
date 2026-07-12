import logging
import os
from functools import lru_cache
from typing import cast

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel
from typing_extensions import NotRequired, TypedDict

from app.core.config import get_settings

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()


def _setting(name: str) -> str | None:
    """Read a value from pydantic settings first (loads the .env file),
    falling back to the raw process environment.

    auth config lives alongside the LLM keys in ``.env``; pydantic-settings
    loads that file into the ``Settings`` object but does NOT populate
    ``os.environ``. Reading ``os.environ`` directly therefore only worked when
    uvicorn was launched with ``--env-file .env``, and otherwise raised a
    ``KeyError`` that surfaced as a 401 on authenticated endpoints.
    """
    value = getattr(get_settings(), name, None)
    if value:
        return str(value)
    return os.environ.get(name.upper())


@lru_cache(maxsize=1)
def get_jwks_client() -> PyJWKClient:
    better_auth_url = _setting("better_auth_url")
    if not better_auth_url:
        raise RuntimeError(
            "BETTER_AUTH_URL must be set so the AI service can fetch the "
            "auth server's JWKS to verify tokens.",
        )
    return PyJWKClient(f"{better_auth_url}/api/auth/jwks")


@lru_cache(maxsize=1)
def _expected_audience() -> str:
    audience = _setting("jwt_audience")
    if not audience:
        raise RuntimeError(
            "JWT_AUDIENCE must be set so tokens minted for other services "
            "cannot be replayed against the AI service.",
        )
    return audience


@lru_cache(maxsize=1)
def _expected_issuer() -> str:
    issuer = _setting("jwt_issuer")
    if not issuer:
        raise RuntimeError(
            "JWT_ISSUER must be set (typically the BETTER_AUTH_URL of the "
            "auth server) so tokens from foreign issuers are rejected.",
        )
    return issuer


class TokenPayload(BaseModel):
    sub: str
    email: str | None = None


class TokenClaims(TypedDict):
    sub: str
    email: NotRequired[str]


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenPayload:
    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(
            credentials.credentials)

        payload = cast(
            TokenClaims,
            jwt.decode(
                credentials.credentials,
                signing_key.key,
                algorithms=["EdDSA", "ES256", "RS256"],
                audience=_expected_audience(),
                issuer=_expected_issuer(),
                options={
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True,
                    "require": ["exp", "aud", "iss", "sub"],
                },
            ),
        )
        return TokenPayload(sub=payload["sub"], email=payload.get("email"))

    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except Exception as exc:
        logger.warning("Token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
