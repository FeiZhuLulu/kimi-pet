---
name: kimi-pet
description: Control the Kimi Pet desktop companion for lightweight status feedback.
---

# Kimi Pet

Use Kimi Pet tools sparingly to reflect meaningful state changes that are not already shown by the automatic hooks.

Available tools:

- `pet_set_state`: Set the pet animation state explicitly. Use only when the automatic hooks do not already reflect the state you want to show.
- `pet_say`: Show a short user-facing companion message (max 20 characters recommended).
- `pet_notify`: Show an important completion or error notice.

Rules:

1. Do not call these tools repeatedly or for every minor step.
2. Do not send long code, secrets, file contents, or private data to `pet_say`.
3. Prefer automatic hooks for normal tool use; use MCP tools only for extra expression or when hooks are insufficient.
4. `waiting_approval` is a good state to set when you are waiting for the user to confirm something.
5. Examples of appropriate use:
   - After a long task completes: `pet_notify` with level `success`.
   - When you need user approval before a risky action: `pet_set_state` to `waiting_approval`.
   - When you want to show a short cheerful message: `pet_say` "Done!".
