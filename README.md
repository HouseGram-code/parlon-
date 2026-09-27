# Parlon Bots — api beta v0.1

[![Discord](https://img.shields.io/badge/Discord-Join%20our%20community-5865F2?logo=discord&logoColor=white&style=flat-square)](https://discord.gg/mZVYwDfCWh)

This repo is **only the bot platform** (Discord-style Developer Portal + REST
API + Python SDK) for Parlon. It intentionally does **not** contain the
Parlon messenger's own source code — that's a separate, private project.

## What's here

| Path | What |
|---|---|
| `developer-portal/` | Site 2: the Discord-style developer portal (create applications, get a token, generate an "Add to server" invite link, read the docs at `/docs`). Deployed at https://developer-portal-wine.vercel.app |
| `supabase/bots_schema.sql` | The SQL migration that adds bots (applications, tokens, installations, interactions, buttons) on top of an existing Parlon-style schema. Idempotent `create or replace` functions + RLS policies. |
| `sdk/python/` | The `parlon-bot` Python package. Published on PyPI: https://pypi.org/project/parlon-bot/ |

## How bots talk to Parlon

Every bot action goes through a handful of `SECURITY DEFINER` SQL functions
exposed over the standard Supabase/PostgREST endpoint — no separate backend
service. See the live docs for the full REST reference and Python quickstart:

👉 **https://developer-portal-wine.vercel.app/docs**

```bash
pip install parlon-bot
```

```python
from parlon_bot import Bot, Button, ActionRow

bot = Bot(token="parlon_your_token")  # from the developer portal → Applications

@bot.on_message
def handle_message(message):
    if message.content == "!ping":
        message.reply("Pong! Click the button:",
                       components=[ActionRow(Button(label="Again", custom_id="ping_again"))])

@bot.on_button_click
def handle_click(interaction):
    if interaction.custom_id == "ping_again":
        interaction.respond("Pong again! 🏓")

bot.run()
```

## Scope (v0.1)

Text + buttons only (images/attachments are deferred to a later version,
to be added through the developer portal). Delivery is short-interval HTTP
polling rather than a persistent socket — both are easy to extend later
without breaking bots already written against this SDK.
