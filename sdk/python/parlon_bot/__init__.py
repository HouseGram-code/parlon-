"""parlon-bot — official Python SDK for Parlon bots (api beta v0.1).

    pip install parlon-bot

    from parlon_bot import Bot, Button, ActionRow

    bot = Bot(token="parlon_...")

    @bot.on_message
    def handle_message(message):
        if message.content == "!ping":
            message.reply("pong", components=[ActionRow(Button(label="Again", custom_id="again"))])

    bot.run()

Get a token at the Parlon developer portal (create an application there —
it's free and instant, and comes with a persistent sandbox server to test in).
"""
from .client import Bot
from .components import ActionRow, Button
from .errors import ParlonError
from .models import Channel, Interaction, Message, SentMessage

__version__ = "0.1.0"
__all__ = [
    "Bot",
    "Button",
    "ActionRow",
    "Message",
    "Interaction",
    "Channel",
    "SentMessage",
    "ParlonError",
]
