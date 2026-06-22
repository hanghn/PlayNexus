# Social UI Accessibility

This document defines the accessibility conventions for the social surfaces in
PlayNexus: friends, direct messages, forum threads, message composition,
notifications, and inline social actions.

The goal is consistency. Users should be able to move through the social UI
with a keyboard alone, understand what each control does from its accessible
name, and receive status updates without needing to inspect the screen
visually.

## Keyboard Navigation

We keep keyboard behavior predictable and close to native browser patterns.

### Global rules

- `Tab` and `Shift+Tab` move through interactive controls in DOM order.
- `Enter` activates buttons and links.
- `Space` activates buttons and toggle controls.
- `Escape` closes the currently open popover or menu when one is active.
- Arrow keys are only used when the control already has a menu-like or
  listbox-like role, or when the interaction is explicitly custom and
  announced.

### Social UI shortcuts

| Area                        | Shortcut          | Behavior                                                         |
| --------------------------- | ----------------- | ---------------------------------------------------------------- |
| Friend request bell         | `Enter` / `Space` | Opens or closes the friend request menu.                         |
| Friend request bell menu    | `Escape`          | Closes the menu and returns focus to the bell button.            |
| Invite game menu in Friends | `Enter` / `Space` | Opens or closes the game picker menu.                            |
| Invite game menu            | `Escape`          | Closes the menu and returns focus to the trigger button.         |
| Emoji picker                | `Enter` / `Space` | Opens or closes the picker.                                      |
| Emoji picker                | `Escape`          | Closes the picker and returns focus to the trigger.              |
| Message composer            | `Enter`           | Sends the message.                                               |
| Message composer            | `Shift+Enter`     | Inserts a newline.                                               |
| Message actions             | `Tab`             | Moves between read aloud, reply, and delete actions.             |
| Toast stack                 | `Tab`             | Moves into the toast actions; auto-dismiss pauses while focused. |

Arrow-key navigation is reserved for the broader app shell and game surfaces,
not the social UI. That avoids conflicting with text entry and keeps the
social experience familiar.

## ARIA Roles and Names

Use semantic HTML first. Add ARIA only where it clarifies behavior that native
elements do not already expose.

### Standard roles

- Use `button` for actions such as Accept, Reject, Reply, Send, and Dismiss.
- Use `role="menu"` for popover panels that present a compact list of actions,
  such as friend requests, game invites, and the emoji picker.
- Use `role="menuitem"` for the actionable items inside those popovers.
- Use `role="region"` with a clear `aria-label` for distinct page sections
  such as the game chat panel.
- Use `role="tablist"` / `role="tab"` / `aria-selected` only for real filter
  tabs, not for generic buttons.

### Accessible names

- Every icon-only button needs an accessible name via `aria-label`.
- Badges that carry state, such as unread counts, should have an accessible
  label that includes the number.
- Decorative icons should be `aria-hidden="true"`.
- If a control already has visible text, do not duplicate that text in
  `aria-label` unless the label adds context.

### Live updates

- Use polite live regions for non-urgent updates.
- Use assertive live regions only for urgent notifications that require
  immediate attention.
- Social toasts should be announced in addition to being shown visually.

## Tooltip Policy

There is no standalone tooltip component in the social UI. The current
standard is:

- Use the native `title` attribute for short, secondary hints on controls like
  notification buttons and message actions.
- Use `aria-label` for controls whose visual content is not self-describing.
- Use `aria-describedby` only when a control needs a longer explanation than a
  tooltip can responsibly provide.

This keeps the implementation lightweight and avoids a separate tooltip system
for brief social actions.

## Component Decisions

### Friends

- Friend cards and pending request cards should expose their primary actions
  as buttons.
- Invite menus and friend-request menus should remain menu-based popovers with
  `aria-haspopup="menu"` and `aria-expanded` on the trigger.
- Presence indicators remain decorative and should not be announced.

### Direct messages

- The inbox list should be navigable with standard keyboard focus.
- The message thread should keep the latest message in view and expose message
  actions with clear labels.
- The composer should support quick send with `Enter` and multiline text with
  `Shift+Enter`.

### Toast notifications

- Toasts should stay focusable so a keyboard user can act on them before
  dismissal.
- Hover and keyboard focus should pause auto-dismiss.
- The dismiss button must always have a clear label.

### Thread and comment rows

- Clickable row surfaces that behave like links should be keyboard-focusable
  and activate on `Enter`.
- If a row acts like a button, it should be a real `button` instead of a
  generic element with click handlers.

## Implementation Notes

- Prefer native controls over custom div-based interaction.
- Do not add keyboard shortcuts that overlap with text entry unless the
  control is explicitly not editable.
- Keep labels specific to the action and the target user, for example,
  `Reply to Sam` rather than just `Reply`.
- If a social feature needs a new interactive pattern, document the keyboard
  behavior and ARIA contract here before implementing it.
