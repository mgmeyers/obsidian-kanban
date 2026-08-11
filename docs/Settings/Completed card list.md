The name of the list that [[Move completed cards to a list|completed cards]] are
moved to. Defaults to `Done`.

Matching is case-insensitive and ignores surrounding whitespace, and a
[[Set a WIP Limit|WIP limit]] suffix isn't part of the name — a list titled
`Done (5)` matches `Done`. If several lists share the name, the leftmost one
wins. If no list matches, cards stay where they are.

Like the other board settings this can be set globally or per board, so a
Dutch board can use `Afgerond` while everything else keeps `Done`. See
[[Local vs. global settings]].
