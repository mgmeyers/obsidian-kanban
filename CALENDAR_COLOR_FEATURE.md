# Calendar Color Feature - Hashtag-Based Visual Feedback

## Overview

This enhancement adds visual feedback to cards based on hashtags that match calendar names from the Full Calendar plugin. Cards automatically display calendar colors when they contain hashtags that correspond to configured calendar names, creating a seamless visual connection between task planning and calendar scheduling.

## How It Works

### Hashtag-Based Color Association

1. **Hashtag Detection**: System scans card content for hashtags (e.g., `#Work`, `#Personal`)
2. **Calendar Matching**: First hashtag that matches a calendar name determines the card color
3. **Color Application**: Card background and text colors automatically update to match the associated calendar
4. **Smart Contrast**: Text color (black/white) is automatically calculated for optimal readability

### Copy to Calendar Enhancement  

When copying a card to a calendar:

1. **Event Creation**: Calendar event is created in the specified directory
2. **Hashtag Addition**: If the card doesn't already have a hashtag matching the calendar name, it's automatically added
3. **Instant Visual Feedback**: Card immediately displays the calendar's color scheme
4. **Persistent Association**: The hashtag creates a permanent visual connection between the card and calendar

### Smart Text Color Calculation

The system automatically calculates the best text color (black or white) based on the background color brightness, ensuring optimal readability regardless of the calendar color.

## Technical Implementation

### Hashtag-Based Color Resolution

Colors are determined dynamically by parsing hashtags and matching them to Full Calendar configuration:

```typescript
// Example card content
"Complete project deliverables #Work #HighPriority"

// System finds #Work matches "Work" calendar (case-insensitive)
// Applies calendar color: #ff6b6b with contrasting text color
```

### Real-Time Color Lookup Process

1. **Content Parsing**: Extract all hashtags from card content using regex: `/#([^\s#]+)/g`
2. **Calendar Matching**: Compare hashtags to calendar names from Full Calendar `data.json`
3. **Color Resolution**: First matching hashtag determines the color scheme
4. **Style Application**: Colors applied via CSS custom properties for theme integration

### Dynamic Integration with Full Calendar

- **Configuration Source**: Reads directly from `.obsidian/plugins/obsidian-full-calendar/data.json`
- **Live Updates**: Changes to Full Calendar settings are reflected immediately
- **No Storage Overhead**: No persistent color data stored in board settings
- **Calendar Synchronization**: Visual state always matches current calendar configuration

### CSS Variables

The system uses CSS custom properties for dynamic color application:

```css
.kanban-plugin__item.has-calendar-color {
  --card-background-color: var(--calendar-color);
  --card-color: var(--calendar-text-color);
}
```

### Automatic Hashtag Addition

When a card is copied to a calendar:
1. Check if card already has a hashtag matching the calendar name
2. If not, append the calendar name as a hashtag (e.g., `#Work`)
3. Text contrast is calculated for optimal readability
4. UI immediately reflects the new color based on the hashtag

## User Experience Benefits

1. **Automatic Color Association**: Cards display calendar colors based on their hashtags
2. **Zero Configuration**: No setup required - colors are determined by existing Full Calendar settings
3. **Persistent Visual Cues**: Hashtags provide permanent visual connection between cards and calendars
4. **Dynamic Updates**: Colors automatically update when Full Calendar settings change
5. **Intuitive Tagging**: Natural hashtag workflow integrates seamlessly with calendar organization
6. **Accessibility**: Automatic contrast calculation ensures text remains readable

## Backward Compatibility

- Cards without hashtags remain unchanged
- Existing color systems (tag colors, date colors) continue to work normally  
- Feature is purely additive - no existing functionality is modified
- No changes to board settings format - hashtags are stored in card content only

## Usage Examples

### Automatic Color Display
```markdown
- [ ] Meeting with client #Work
- [ ] Doctor appointment #Personal  
- [ ] Team review #Work
```
Cards automatically display colors based on `#Work` and `#Personal` hashtags matching calendar names.

### Copy to Calendar Workflow
1. Create a card: `"Complete project proposal"`
2. Right-click → "Copy to Calendar"
3. Select "Work Calendar" 
4. Card content becomes: `"Complete project proposal #Work"`
5. Card immediately displays Work calendar's color scheme

### Manual Hashtag Assignment
Add hashtags to any card to instantly apply calendar colors without copying to calendar:
- Add `#Personal` → card shows Personal calendar colors
- Add `#Work` → card shows Work calendar colors
- Change `#Work` to `#Personal` → colors update automatically

## Integration with Full Calendar Plugin

The feature leverages the Full Calendar plugin's color configuration:
- Reads calendar colors from Full Calendar plugin settings
- Respects calendar directory configurations
- Maintains compatibility with Full Calendar's "Full note" mode
- Supports both wildcard patterns and literal directory names

This creates a seamless workflow between task planning (Kanban) and time scheduling (Full Calendar), with visual feedback bridging the gap between the two productivity systems. 