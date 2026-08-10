# Architecture notes

Working reference for `src/`, one file per topic.
Read the relevant file before editing source, and extend it when you learn something it doesn't cover.

Format per file:

```
# Topic

One or two lines saying what this file covers.

## Sections
Facts about how it works, with `path/to/file.ts:line` references.

## Gotchas
Non-obvious traps for this topic. Every file that has them ends with this section.
```

Rules:

- Filenames are kebab-case, named after the topic, not after a source file.
- All paths are relative to the repo root.
- Gotchas live with their topic, not in a shared file, so one file is enough context for one task.
  Cross-link with relative links (`[settings.md](settings.md)`) when a fact matters in two places.
- Describe the current state of the code. Why a change was made belongs in `../changelog/`.
- Add the file to `../index.md` when you create it.
