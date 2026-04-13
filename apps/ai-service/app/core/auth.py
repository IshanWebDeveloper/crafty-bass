import os
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from functools import lru_cache
from typing import cast

from typing_extensions import NotRequired, TypedDict

bearer_scheme = HTTPBearer()

BETTER_AUTH_URL = os.environ["BETTER_AUTH_URL"]  # e.g. http://api:3001
JWKS_URL = f"{BETTER_AUTH_URL}/api/auth/jwks"


@lru_cache(maxsize=1)
def get_jwks_client() -> PyJWKClient:
    # JWKS is cached — public key rarely changes

    return PyJWKClient(JWKS_URL)


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
                # accept any asymmetric alg
                algorithms=["EdDSA", "ES256", "RS256"],
                options={"verify_exp": True},
            ),
        )
        return TokenPayload(sub=payload["sub"], email=payload.get("email"))

    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
