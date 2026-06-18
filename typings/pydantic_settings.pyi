from typing import Any


class BaseSettings:
    model_config: dict[str, Any]

    def __init__(self, **data: Any) -> None: ...


def SettingsConfigDict(
    *,
    env_file: str | None = ...,
    env_file_encoding: str | None = ...,
    case_sensitive: bool | None = ...,
    extra: str | None = ...,
) -> dict[str, Any]: ...
