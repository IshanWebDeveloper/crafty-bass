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

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()


@lru_cache(maxsize=1)
def get_jwks_client() -> PyJWKClient:
    better_auth_url = os.environ["BETTER_AUTH_URL"]
    return PyJWKClient(f"{better_auth_url}/api/auth/jwks")


@lru_cache(maxsize=1)
def _expected_audience() -> str:
    audience = os.environ.get("JWT_AUDIENCE")
    if not audience:
        raise RuntimeError(
            "JWT_AUDIENCE must be set so tokens minted for other services "
            "cannot be replayed against the AI service.",
        )
    return audience


@lru_cache(maxsize=1)
def _expected_issuer() -> str:
    issuer = os.environ.get("JWT_ISSUER")
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
