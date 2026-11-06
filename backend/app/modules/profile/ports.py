"""What the profile service needs from outside the module: the account, read through the auth service."""

import uuid
from typing import Protocol


class Account(Protocol):
    @property
    def email(self) -> str: ...


class AccountReader(Protocol):
    async def current_user(self, user_id: uuid.UUID) -> Account:
        """The signed-in user's account; raises `invalid_token` when it no longer exists."""
        ...
