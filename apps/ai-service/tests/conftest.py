"""Test-suite bootstrap.

`app.main` resolves `Settings` at import time, and `Settings` refuses to build
without a credential for the active provider. Those env vars therefore have to
exist before pytest collects any test module that does `from app.main import app`.

Setting them here makes the suite hermetic: it no longer depends on a developer's
(or the CI runner's) `apps/ai-service/.env` happening to carry a real key.
"""

import os
from typing import NoReturn

import pytest

# Must run before the `app.*` imports below.
os.environ["LLM_PROVIDER"] = "anthropic"
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-test-key-never-sent"

from app.core.config import get_settings  # noqa: E402
from app.services import llm_graphs  # noqa: E402

get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _block_live_llm_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail loudly rather than make a billable API call.

    `llm_graphs` binds `get_llm` at import, so this is the seam that matters;
    patching `app.core.client.get_llm` would leave that binding untouched.
    """

    def _fail(*_args: object, **_kwargs: object) -> NoReturn:
        raise AssertionError(
            "A test tried to build a live LLM client. Inject a fake through the "
            "llm_builder seam instead."
        )

    monkeypatch.setattr(llm_graphs, "get_llm", _fail)
