"""The Bot client: authenticate, send messages/buttons, and poll for events."""
from __future__ import annotations

import time
import traceback
from typing import Callable, List, Optional

import requests

from .components import ActionRow, components_to_payload
from .errors import ParlonError
from .models import Channel, Interaction, Message, SentMessage

# Public Supabase project backing Parlon. The anon/publishable key below is
# the same one shipped in the main site's browser bundle — it grants no
# access by itself, every bot_* RPC verifies YOUR bot token server-side.
# Point at a different backend (self-hosted / staging) via base_url + anon_key.
DEFAULT_BASE_URL = "https://zhqazyivekavtsnsfwgm.supabase.co"
DEFAULT_ANON_KEY = "sb_publishable_ODxl_hlVpNflwdo_M0aKqw_tzIjKCZd"

MessageHandler = Callable[[Message], None]
InteractionHandler = Callable[[Interaction], None]


class Bot:
    """A Parlon bot.

    Example:
        bot = Bot(token="parlon_...")

        @bot.on_message
        def handle_message(message):
            if message.content == "!ping":
                message.reply("pong")

        bot.run()
    """

    def __init__(
        self,
        token: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        anon_key: str = DEFAULT_ANON_KEY,
        poll_interval: float = 2.0,
    ):
        if not token:
            raise ValueError("token is required — create a bot at the Parlon developer portal")
        self.token = token
        self.base_url = base_url.rstrip("/")
        self.anon_key = anon_key
        self.poll_interval = poll_interval

        self._session = requests.Session()
        self._session.headers.update(
            {
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
                "Content-Type": "application/json",
            }
        )

        self._message_handlers: List[MessageHandler] = []
        self._button_handlers: List[InteractionHandler] = []
        self._running = False

    # ---------------------------------------------------------------- rpc --
    def _rpc(self, fn: str, payload: dict) -> dict:
        resp = self._session.post(f"{self.base_url}/rest/v1/rpc/{fn}", json=payload, timeout=30)
        if resp.status_code >= 400:
            message = resp.text
            code = None
            try:
                data = resp.json()
                message = data.get("message", message)
                code = data.get("code")
            except ValueError:
                pass
            raise ParlonError(message, code=code)
        if resp.text == "" or resp.text == "null":
            return {}
        return resp.json()

    # ------------------------------------------------------------- actions --
    def send_message(self, channel_id: str, content: str = "", components: Optional[List[ActionRow]] = None) -> SentMessage:
        """Send a text message (optionally with buttons) as this bot."""
        row = self._rpc(
            "bot_send_message",
            {
                "p_token": self.token,
                "p_channel_id": channel_id,
                "p_content": content,
                "p_components": components_to_payload(components),
            },
        )
        return SentMessage(id=row["id"], channel_id=row["channel_id"], content=row["content"], raw=row)

    def edit_message(self, message_id: str, content: Optional[str] = None, components: Optional[List[ActionRow]] = None) -> SentMessage:
        """Edit a message this bot previously sent. Pass ``components=[]`` to remove its buttons."""
        row = self._rpc(
            "bot_edit_message",
            {
                "p_token": self.token,
                "p_message_id": message_id,
                "p_content": content,
                "p_components": components_to_payload(components),
            },
        )
        return SentMessage(id=row["id"], channel_id=row["channel_id"], content=row["content"], raw=row)

    def channel(self, channel_id: str) -> Channel:
        """Get a :class:`Channel` handle to send messages into, by id."""
        return Channel(self, channel_id)

    # -------------------------------------------------------------- events --
    def on_message(self, handler: MessageHandler) -> MessageHandler:
        """Decorator: called for every new message in a server this bot is installed in
        (excluding the bot's own messages)."""
        self._message_handlers.append(handler)
        return handler

    def on_button_click(self, handler: InteractionHandler) -> InteractionHandler:
        """Decorator: called when a member clicks a button this bot attached to a message."""
        self._button_handlers.append(handler)
        return handler

    # ---------------------------------------------------------------- run --
    def poll_once(self, since: Optional[str] = None) -> str:
        """Run a single poll cycle; returns the server_time cursor to pass as ``since`` next time."""
        data = self._rpc("bot_poll", {"p_token": self.token, "p_since": since, "p_limit": 50})
        for row in data.get("messages", []):
            for handler in self._message_handlers:
                try:
                    handler(Message(self, row))
                except Exception:  # noqa: BLE001 - keep the bot alive on handler bugs
                    traceback.print_exc()
        for row in data.get("interactions", []):
            for handler in self._button_handlers:
                try:
                    handler(Interaction(self, row))
                except Exception:  # noqa: BLE001
                    traceback.print_exc()
        return data.get("server_time", since)

    def run(self) -> None:
        """Blocking loop: poll for new messages/button clicks every ``poll_interval`` seconds.

        v0.1 beta uses simple HTTP polling (no persistent socket yet) — easy
        to get started with, and swappable for push delivery later without
        changing your bot's code.
        """
        since = None
        self._running = True
        print(f"Parlon bot running (polling every {self.poll_interval}s)... Ctrl+C to stop.")
        try:
            while self._running:
                try:
                    since = self.poll_once(since)
                except ParlonError as e:
                    print(f"[parlon-bot] API error: {e}")
                time.sleep(self.poll_interval)
        except KeyboardInterrupt:
            pass
        finally:
            self._running = False

    def stop(self) -> None:
        self._running = False
