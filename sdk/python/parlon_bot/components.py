"""Message components: buttons grouped into action rows.

Only text + buttons are supported in api beta v0.1 (images/attachments will
be added through the developer portal in a later version).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

VALID_STYLES = ("primary", "secondary", "success", "danger")


@dataclass
class Button:
    """A single clickable button attached to a bot message.

    Args:
        label: Text shown on the button.
        custom_id: Opaque string you choose — echoed back to your
            ``on_button_click`` handler when a member clicks it, so you know
            which button was pressed. Must be unique within the message.
        style: One of "primary", "secondary" (default), "success", "danger".
        disabled: Render the button but make it unclickable.
    """

    label: str
    custom_id: str
    style: str = "secondary"
    disabled: bool = False

    def __post_init__(self) -> None:
        if self.style not in VALID_STYLES:
            raise ValueError(f"button style must be one of {VALID_STYLES}, got {self.style!r}")
        if not self.custom_id:
            raise ValueError("custom_id is required")

    def to_dict(self) -> dict:
        return {
            "type": "button",
            "custom_id": self.custom_id,
            "label": self.label,
            "style": self.style,
            "disabled": self.disabled,
        }


@dataclass
class ActionRow:
    """A horizontal row of up to 5 buttons. Pass one or more to `components=`."""

    buttons: List[Button] = field(default_factory=list)

    def __init__(self, *buttons: Button):
        if len(buttons) > 5:
            raise ValueError("an action row can hold at most 5 buttons")
        self.buttons = list(buttons)

    def to_dict(self) -> dict:
        return {"type": "action_row", "buttons": [b.to_dict() for b in self.buttons]}


def components_to_payload(components: Optional[List[ActionRow]]) -> Optional[list]:
    if components is None:
        return None
    return [row.to_dict() for row in components]
