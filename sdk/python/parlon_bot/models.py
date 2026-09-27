"""Data models returned to your event handlers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, List, Optional

from .components import ActionRow

if TYPE_CHECKING:  # pragma: no cover
    from .client import Bot


@dataclass
class SentMessage:
    """A message that was just sent or edited, returned by ``channel.send`` / ``bot.edit_message``."""

    id: str
    channel_id: str
    content: str
    raw: dict


class Channel:
    """Lightweight handle for sending messages into one channel."""

    def __init__(self, bot: "Bot", channel_id: str):
        self._bot = bot
        self.id = channel_id

    def send(self, content: str = "", components: Optional[List[ActionRow]] = None) -> SentMessage:
        """Send a text message, optionally with buttons, into this channel."""
        return self._bot.send_message(self.id, content, components=components)


class Message:
    """A message received while polling (from a server the bot is installed in)."""

    def __init__(self, bot: "Bot", raw: dict):
        self._bot = bot
        self.raw = raw
        self.id: str = raw["id"]
        self.channel_id: str = raw["channel_id"]
        self.author_id: Optional[str] = raw.get("author_id")
        self.author_name: str = raw.get("author_name", "")
        self.content: str = raw.get("content", "")
        self.created_at: str = raw.get("created_at", "")
        self.bot_id: Optional[str] = raw.get("bot_id")

    @property
    def channel(self) -> Channel:
        return Channel(self._bot, self.channel_id)

    def reply(self, content: str = "", components: Optional[List[ActionRow]] = None) -> SentMessage:
        return self.channel.send(content, components=components)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Message id={self.id!r} author={self.author_name!r} content={self.content!r}>"


class Interaction:
    """A button click, delivered to your ``on_button_click`` handler."""

    def __init__(self, bot: "Bot", raw: dict):
        self._bot = bot
        self.raw = raw
        self.id: str = raw["id"]
        self.custom_id: str = raw["custom_id"]
        self.message_id: str = raw["message_id"]
        self.channel_id: str = raw["channel_id"]
        self.server_id: str = raw["server_id"]
        self.user_id: str = raw["user_id"]
        self.created_at: str = raw.get("created_at", "")

    @property
    def channel(self) -> Channel:
        return Channel(self._bot, self.channel_id)

    def respond(self, content: str = "", components: Optional[List[ActionRow]] = None) -> SentMessage:
        """Send a new message into the same channel in response to this click."""
        return self.channel.send(content, components=components)

    def update_message(self, content: Optional[str] = None, components: Optional[List[ActionRow]] = None) -> SentMessage:
        """Edit the original message the button was attached to (e.g. to disable the button)."""
        return self._bot.edit_message(self.message_id, content=content, components=components)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Interaction custom_id={self.custom_id!r} user_id={self.user_id!r}>"
