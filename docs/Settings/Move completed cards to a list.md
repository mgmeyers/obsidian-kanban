When this setting is on, checking a card's checkbox moves that card to a
designated list — `Done` unless [[Completed card list|you name a different
one]]. Unchecking a card never moves it back.

The setting is off by default and can be set globally or per board; a board's
own value always wins. See [[Local vs. global settings]].

Cards are only moved when they end up *complete*: a card toggled into an
intermediate status (for example the Tasks plugin's "in progress" status) stays
where it is. If no list on the board matches the configured name, nothing moves.

### Completion dates

The inline completion date (`✅ 2026-08-07`) is added by the
[Tasks](https://publish.obsidian.md/tasks/) plugin when it is installed, exactly
as it would be if you checked the task off in a note. Without Tasks the card is
still moved, just without a date.

### Recurring tasks

Checking a recurring task (`🔁 every week`) splits it in two: Tasks writes the
completed occurrence and schedules the next one. Only the completed occurrence
travels to the done list — the next occurrence stays in the list you were
working in, keeping the card's position in your workflow.

### Sorted lists

Moving a card into a list that has been sorted clears that list's sort, so the
card stays where it was put — the same thing that happens when you drag a card
into a sorted list.
