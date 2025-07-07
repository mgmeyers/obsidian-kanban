# Calendar Color Feature - Visual Feedback for Copied Cards

## Overview

This enhancement adds visual feedback to cards that have been copied to calendars through the "Copy to Calendar" feature. When a card is copied to a calendar, the card's background color automatically changes to match the calendar's color, providing immediate visual confirmation of the calendar assignment.

## How It Works

### Color Application Process

1. **Card Selection**: User right-clicks on a card and selects "Copy to Calendar"
2. **Calendar Selection**: User chooses a calendar from the dropdown
3. **Event Creation**: Calendar event is created in the specified directory
4. **Color Assignment**: Card background is automatically set to match the calendar's color
5. **Visual Feedback**: Card displays with calendar color and appropriate contrasting text

### Smart Text Color Calculation

The system automatically calculates the best text color (black or white) based on the background color brightness using the WCAG luminance formula, ensuring optimal readability regardless of the calendar color.

### Color Persistence

- Card colors are stored in board settings (at beginning of file if that option is enabled)
- Colors persist across Obsidian sessions
- If a card is copied to a different calendar, the color is updated to match the new calendar

## Technical Implementation

### Color Storage

Card colors are stored in the board settings JSON block:

```json
{
  "card-colors": [
    {
      "cardId": "card-123",
      "backgroundColor": "#ff6b6b",
      "color": "#ffffff",
      "calendarName": "Work Calendar"
    }
  ]
}
```

### CSS Variables

The system uses CSS custom properties for dynamic color application:

```css
.kanban-plugin__item.has-calendar-color {
  --card-background-color: #ff6b6b;
  --card-color: #ffffff;
}
```

### Automatic Color Updates

When a card is copied to a calendar:
1. Previous color assignment is removed (if exists)
2. New color is calculated from calendar configuration
3. Text contrast is calculated for optimal readability
4. Board settings are updated with the new color mapping
5. UI immediately reflects the new color

## User Experience Benefits

1. **Visual Confirmation**: Immediate feedback showing which calendar a card was copied to
2. **Organization**: Quick visual identification of calendar assignments
3. **Workflow Enhancement**: Seamless integration with existing "Copy to Calendar" workflow
4. **Accessibility**: Automatic contrast calculation ensures text remains readable

## Backward Compatibility

- Cards without calendar assignments remain unchanged
- Existing color systems (tag colors, date colors) continue to work normally
- Feature is purely additive - no existing functionality is modified
- Board settings format remains backward compatible

## Usage Example

1. Create a Kanban board with several cards
2. Enable "Copy to Calendar" feature in settings
3. Right-click on a card → "Copy to Calendar"
4. Select a calendar (e.g., "Work Calendar" with blue color)
5. Card background immediately changes to blue with white text
6. Card shows visual confirmation of calendar assignment

## Integration with Full Calendar Plugin

The feature leverages the Full Calendar plugin's color configuration:
- Reads calendar colors from Full Calendar plugin settings
- Respects calendar directory configurations
- Maintains compatibility with Full Calendar's "Full note" mode
- Supports both wildcard patterns and literal directory names

This creates a seamless workflow between task planning (Kanban) and time scheduling (Full Calendar), with visual feedback bridging the gap between the two productivity systems. 