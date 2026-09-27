# parlon-bot

Official Python SDK for **Parlon** bots — **api beta v0.1**.

Supports text messages and buttons today; image messages are coming and will
first land on the [developer portal](https://parlon-developers.vercel.app),
then in this library.

## Install

```bash
pip install parlon-bot
```

## Get a token

1. Open the [Parlon Developer Portal](https://parlon-developers.vercel.app) and sign in
   (same account as the main [Parlon](https://parlon-app.vercel.app) app).
2. Create an application. You get a token **once** — copy it immediately (you
   can always reset it later, like Discord).
3. A persistent **Sandbox** server is created for you automatically and your
   bot is already installed there — open the main Parlon app with the same
   account to test.

## Quick start

```python
import os
from parlon_bot import Bot, ActionRow, Button

bot = Bot(token=os.environ["PARLON_BOT_TOKEN"])

@bot.on_message
def handle_message(message):
    if message.content.strip() == "!ping":
        message.reply(
            "Pong! Click the button:",
            components=[ActionRow(Button(label="Again", custom_id="ping_again", style="primary"))],
        )

@bot.on_button_click
def handle_click(interaction):
    if interaction.custom_id == "ping_again":
        interaction.respond("Pong again! 🏓")

bot.run()
```

## API

- `Bot(token, *, poll_interval=2.0)` — create a client. `run()` blocks and polls for
  events; `poll_once(since)` if you want to drive the loop yourself (e.g. inside
  an existing asyncio/Flask app).
- `@bot.on_message` — called for every new message in a server this bot is installed
  in (not its own messages). Handler receives a `Message`.
- `@bot.on_button_click` — called when a member clicks a button. Handler receives an
  `Interaction`.
- `message.reply(content, components=None)` / `interaction.respond(content, components=None)`
  — send a message into the same channel.
- `interaction.update_message(content=None, components=None)` — edit the original
  message the button was attached to (e.g. pass `components=[]` to remove the buttons).
- `bot.send_message(channel_id, content, components=None)` / `bot.edit_message(message_id, ...)`
  — lower-level, if you already have a channel/message id.
- `Button(label, custom_id, style="secondary", disabled=False)` — `style` is one of
  `primary`, `secondary`, `success`, `danger`.
- `ActionRow(*buttons)` — up to 5 buttons per row; pass one or more rows as
  `components=[...]`.

## Permissions & installation

A bot only acts on servers it's installed on, and only within the permissions
it was granted there (`read_messages`, `send_messages`, `manage_messages`).
Generate an "Add to server" link from the developer portal's application page —
whoever manages that server opens it and approves, exactly like adding a bot on
Discord.

## Notes on this beta

- Delivery is by short-interval HTTP polling (default every 2s), not a
  persistent socket yet — simple to run anywhere, including from a basic
  script or a free-tier host. This may be swapped for a real-time gateway in
  a later version without breaking your bot's code.
- DMs aren't supported yet — bots operate in server channels only.
- Report issues / feature requests to the Parlon team.
