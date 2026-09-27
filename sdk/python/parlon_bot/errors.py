from __future__ import annotations

from typing import Optional


class ParlonError(Exception):
    """Raised when the Parlon API rejects a request (invalid token, missing
    permission, bot not installed on that server, etc). ``str(error)``
    contains the server-provided message."""

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        self.code = code
