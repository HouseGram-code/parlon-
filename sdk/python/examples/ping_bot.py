"""Minimal example bot: replies to "!ping" with a button, and to that
button's click with a follow-up message.

Usage:
    pip install parlon-bot
    export PARLON_BOT_TOKEN=parlon_xxx   # from the Parlon developer portal
    python ping_bot.py
"""
import os

from parlon_bot import ActionRow, Bot, Button

bot = Bot(token=os.environ["PARLON_BOT_TOKEN"])


@bot.on_message
def handle_message(message):
    if message.author_id == None:  # noqa: E711 - defensive, bots skip their own messages already
        return
    if message.content.strip() == "!ping":
        message.reply(
            "Pong! Click the button:",
            components=[ActionRow(Button(label="Again", custom_id="ping_again", style="primary"))],
        )


@bot.on_button_click
def handle_click(interaction):
    if interaction.custom_id == "ping_again":
        interaction.respond("Pong again! 🏓")


if __name__ == "__main__":
    bot.run()
