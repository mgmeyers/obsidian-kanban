# Copy a card to calendar

The "Copy to calendar" feature allows you to create calendar events from Kanban cards in your Full Calendar plugin.

## Prerequisites

This feature requires the [Full Calendar](https://github.com/davish/obsidian-full-calendar) plugin to be installed and configured with at least one calendar source.

## How to use

1. Right-click on any Kanban card, or click on the three dots menu
2. Select "Copy to calendar" from the menu
3. A picker will display showing all available calendars from your Full Calendar configuration
4. Each calendar is shown with its color circle and name (based on the directory basename)
5. Click on the desired calendar to create the event

## What happens

When you select a calendar, the plugin will:

1. Create a new markdown file in the selected calendar's directory
2. The filename will be in the format: `YYYY-MM-DD <card-name>.md`
3. The file will contain frontmatter suitable for Full Calendar:

```markdown
---
title: <card-name>
allDay: true
date: YYYY-MM-DD
endDate: YYYY-MM-DD (next day)
completed: null
---
```

## Notes

- The date will be set to the current day in ISO 8601 format
- The card name will be sanitized to ensure it's a valid filename (max 30 characters)
- If a file with the same name already exists, you'll be notified and no duplicate will be created
- The feature respects the calendar directory structure from your Full Calendar configuration
- Directories with wildcards (like `/*`) will have the wildcard removed when creating files 