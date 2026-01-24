import os
from typing import Iterable, Optional

import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def _auth_enabled() -> bool:
    return os.getenv("AUTH_ENABLED", "false").lower() == "true"


def _jwt_secret() -> str:
    return os.getenv("AUTH_JWT_SECRET", "")


def _is_exempt_path(path: str, exempt: Iterable[str]) -> bool:
    return any(path.startswith(item) for item in exempt)


def _extract_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()

    query_token = request.query_params.get("token")
    if query_token:
        return query_token.strip()

    cookie_token = request.cookies.get("medai_token") or request.cookies.get(
        "access_token"
    )
    if cookie_token:
        return cookie_token.strip()

    return None


class JWTAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, exempt_paths: Iterable[str]):
        super().__init__(app)
        self.exempt_paths = list(exempt_paths)

    async def dispatch(self, request: Request, call_next):
        if not _auth_enabled():
            return await call_next(request)

        if request.method == "OPTIONS":
            return await call_next(request)

        if _is_exempt_path(request.url.path, self.exempt_paths):
            return await call_next(request)

        secret = _jwt_secret()
        if not secret:
            return JSONResponse(
                {"detail": "Auth enabled but AUTH_JWT_SECRET is not set."},
                status_code=500,
            )

        token = _extract_token(request)
        if not token:
            return JSONResponse({"detail": "Authorization required."}, status_code=401)
        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
        except jwt.PyJWTError:
            return JSONResponse({"detail": "Invalid token."}, status_code=401)

        request.state.user = payload
        return await call_next(request)
