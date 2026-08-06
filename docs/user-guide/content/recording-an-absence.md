# Recording an absence

When you're away — on holiday, sick, or taking flex time — record it as an absence so
your saldo reflects it correctly.

## Add an absence

From **Absence**, choose the **From** and **To** dates for the absence. To record a
single day, set both to the same date; to cover a stretch of time, pick a range and
Saldo records one absence per day across it. The two dates stay in order for you: if
you pick a **To** date earlier than the **From** date, the other end moves to match.

Pick a **Reason** from the list, add an optional **comment**, and press **Submit**.

![The absence form: a From/To date range, a reason dropdown, a comment field, and a Submit button.](screenshots/recording-an-absence.png)

Each day in the range is stored using the default start and end times from your
[account settings](account-and-expected-hours.md), with the lunch break subtracted.

A range can cover at most a year. A longer one is refused before anything is saved, and
the message tells you the longest range allowed.

## Absence reasons

Saldo offers a fixed set of reasons, each shown with a readable label:

- **Holiday**
- **Flex hours**
- **Sick leave**
- **Other**

**Holiday** here means your own annual or vacation leave. It is not the same as a public
holiday — those are already treated as non-working days and need no entry from you.

The reason matters because it determines how the absence affects your saldo — see
[Understanding your saldo](understanding-your-saldo.md).

## One absence per day

A day holds at most one absence. If you submit an absence for a day that already has
one, it is rejected and nothing is saved — regardless of whether the reason is the same
as the existing one. The same applies when you move an existing absence onto a day that
is already taken.

For a range, the check covers every day before anything is written, so a single taken day
rejects the whole submission — you never end up with part of a range saved. The message
names the days that clash; when several clash, it names the first few and reports how
many more there are. Fix or shorten the range and submit again.

## Logging hours on an absence day

An absence doesn't stop you recording work. You can still log hours on a day that has an
absence, and doing so leaves the absence itself untouched — its reason, times, and
comment are unchanged. An absence is always taken in full, so hours you log on such a day
count as extra work on top of it rather than shortening it.

When you open a day that has an absence, the day view says so, and reminds you that
hours logged there still count towards your saldo. The notice disappears once the day's
absence is deleted.

<!-- traceability -->

> **Generated from OpenSpec specs** — do not hand-edit; run `/generate-user-guides` to update.
>
> | Capability | Requirement | Hash |
> | --- | --- | --- |
> | absence | Fixed set of absence reasons | `49f510dae79a` |
> | absence | At most one absence per day | `513d4ad7b4b5` |
> | absence | Multi-day absence over a date range | `69d89199329d` |
> | absence | Hours may be logged on a day that has an absence | `d19164fdf373` |
> | absence | Day view flags an existing absence | `c24b6f51fa1c` |
> | absence | Human-readable reason labels | `12bd9a3396b9` |

<!-- /traceability -->
