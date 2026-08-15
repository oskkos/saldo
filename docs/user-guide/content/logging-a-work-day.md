# Logging a work day

Record the hours you worked on a given day. Each entry feeds into your running
saldo — the balance between the hours you've worked and the hours expected of you.

## Open the day

From the calendar, click the day you want to log. The day view shows the date,
the hours **expected** for that day, and a form for entering your work time. Use
the arrows beside the date to move to the previous or next day.

## Enter your hours

You can record time in two ways, using the **Times / Duration** toggle:

- **Times** — type a start and end time (for example a morning start and an
  afternoon finish).
- **Duration** — switch the toggle to enter a single length of time instead of a
  start/end pair.

Leave **Subtract lunch break automatically** on to have the standard lunch break
deducted from the entry, or turn it off to log the exact time. You can add an
optional **comment**, then press **Submit** to save the entry.

![The day view: the work-time entry form with a start and end time, the lunch-break toggle, a comment field, and the list of existing worklogs for the day.](screenshots/logging-a-work-day.png)

## If the hours overlap something you already logged

Saldo checks a new or edited entry against the work entries you have already
stored. If the times you submitted run over one of them, it doesn't save quietly
— it asks first, in a browser prompt that names the date and time span of the
entry you would land on and ends with **Save anyway?**

Choose **OK** to save it anyway — overlapping hours are sometimes deliberate — or
**Cancel** to save nothing. Cancelling leaves what you typed in the form, so you
can adjust the times and submit again.

A few things this check deliberately does *not* treat as a clash:

- Entries that merely touch, where one begins exactly as the other ends.
- Hours logged on a day that already holds an absence — that combination is
  supported, and never prompts.
- An entry you are editing against itself, so widening or shifting one entry's
  own times is not a conflict.

Because the check runs against what is stored rather than what your screen last
loaded, it still catches a clash with an entry added from another device or
browser tab since you opened the page.

Submitting is also protected against a double tap: while an entry is being saved
the **Submit** button is disabled, and a second press during that moment does not
create a second entry.

## Review, edit, or delete entries

Saved entries for the day appear under **Existing worklogs for day**, with a total
for the day. Each entry has an edit and a delete control — use them to correct a
mistake or remove an entry. You can only change your own worklogs.

Once saved, the day's hours are reflected in your saldo.

<!-- traceability -->

> **Generated from OpenSpec specs** — do not hand-edit; run `/generate-user-guides` to update.
>
> | Capability | Requirement | Hash |
> | --- | --- | --- |
> | worklog | Create a worklog | `facc182bad45` |
> | worklog | Worklog entry supports a duration mode | `7adcb5fa9602` |
> | worklog | Edit a worklog only if owned | `df10405f2a0a` |
> | worklog | Delete a worklog only if owned | `70a910bd8992` |
> | worklog | Work entries do not silently overlap | `c5bab5b7ae76` |
> | mutation-safety | One interaction produces at most one mutation | `c9e94daca7d5` |
> | mutation-safety | A control is visibly unavailable while its mutation runs | `889ed111f553` |

<!-- /traceability -->
