# Using the clock

Instead of typing start and end times, you can let Saldo time your work session live
— clock in when you start, clock out when you finish.

## Clock in

Press **Clock in** to start a session. A running timer appears showing when you
started and how long you've been clocked in, and a **Clocked in** indicator shows in
the top bar so the state is visible from anywhere in the app. You can only have one
open session at a time.

![A running clock session showing the start time, elapsed time, and a Clock out button.](screenshots/using-the-clock.png)

## Clock out

Press **Clock out** to finish. Saldo opens a **Finish work session** dialog
pre-filled with the start and end times, where you can adjust the times, choose
whether to subtract the lunch break automatically, and add a comment before saving.

![The Finish work session dialog with editable times, a lunch-break toggle, a comment field, and Cancel, Discard, and Save buttons.](screenshots/using-the-clock-finish.png)

- **Save** turns the session into a worklog for the day.
- **Discard** throws the session away without logging anything.
- **Cancel** closes the dialog and leaves the session running.

A session is meant to cover a single day, so it can't stretch across more than one
day. If you forget to clock out, Saldo helps you finish the leftover session the next
time you return.

<!-- traceability -->

> **Generated from OpenSpec specs** — do not hand-edit; run `/generate-user-guides` to update.
>
> | Capability | Requirement | Hash |
> | --- | --- | --- |
> | time-clock | Clock in starts a single open session | `d0ccf9e6fed2` |
> | time-clock | Clock out finalizes the session | `04fd85379fcb` |
> | time-clock | Discard a session without logging | `ea217d1a6747` |
> | time-clock | Sessions may not span more than one day | `1b505f7b70e2` |
> | time-clock | Forgotten sessions are handled on return | `753eeb7fbf47` |
> | time-clock | Clock state is visible across the app | `392eb5cef249` |

<!-- /traceability -->
