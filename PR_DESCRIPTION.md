# Add "Copy to Calendar" Integration with Full Calendar Plugin

## Motivation

This feature bridges the gap between task management and calendar planning by allowing users to seamlessly copy Kanban cards to their calendar. The integration is motivated by the workflow of placing lists next to calendars and easily being able to add list items to calendars, as discussed in ["Have You Been Using Your Calendar All Wrong?"](https://medium.com/@geetduggal/have-you-been-using-your-calendar-all-wrong-9e686de42237).

The core insight is that many productivity workflows benefit from the ability to:
- **Plan with lists** (Kanban boards for organizing tasks and ideas)
- **Execute with calendars** (time-blocked calendar events for actual work)
- **Bridge the gap** between planning and execution seamlessly

This feature enables users to maintain their Kanban boards as planning and organization tools while easily moving actionable items to their calendar for time-blocked execution.

## New Features Summary

1. **Copy to Calendar**: Right-click context menu option to copy cards to Full Calendar
2. **Calendar Color Visual Feedback**: Cards automatically adopt calendar colors when copied
3. **Board Settings Placement**: Option to place board settings at beginning of file

## Technical Approach

### Integration Design
The feature integrates with the Full Calendar plugin's "Full note" mode, which uses markdown files with frontmatter to represent calendar events. This approach was chosen because:
- **Native Obsidian integration**: Uses standard markdown files that can be edited manually
- **Compatibility**: Works with existing Full Calendar setups
- **Flexibility**: Events can be easily modified after creation
- **Portability**: Calendar data remains in readable markdown format

### Implementation Details

#### Core Components
1. **Calendar Source Discovery**: Reads Full Calendar plugin configuration from `.obsidian/plugins/obsidian-full-calendar/data.json`
2. **Calendar Picker UI**: Displays available calendars with color-coded visual indicators
3. **Event Creation**: Generates markdown files with appropriate frontmatter
4. **Settings Integration**: Provides user control over feature availability

#### Event Format
Events are created as all-day events on the current day with the following frontmatter:
```markdown
---
title: <sanitized-card-title>
allDay: true
date: YYYY-MM-DD
endDate: YYYY-MM-DD (next day)
completed: null
---
```

This format ensures compatibility with Full Calendar's expectations while providing a sensible default that can be easily adjusted within the calendar interface.

#### Edge Case Handling
The implementation includes robust handling for several edge cases:

**Directory Path Handling**:
- Supports both wildcard patterns (`Log/*`) and literal directory names containing special characters (`Log/*` as an actual folder name)
- Implements smart detection: checks if literal directory exists before treating `/*` as a wildcard
- Provides fallback path normalization for characters that may cause filesystem issues

**Error Recovery**:
- Graceful fallback for missing Full Calendar plugin
- User-friendly error notifications with specific failure reasons
- Robust file creation with collision detection
- Automatic directory creation when needed

**User Experience**:
- Integrates with existing context menu patterns
- Respects platform differences (mobile vs desktop UI)
- Maintains consistent icon and interaction patterns
- Provides clear visual feedback for success/failure states

### Visual Feedback System
The calendar color feature provides immediate visual confirmation when cards are copied to calendars:

**Color Application Process**:
1. When a card is copied to a calendar, the card's background automatically changes to match the calendar's color
2. Smart text color calculation ensures optimal contrast (WCAG compliant)
3. Card colors are stored in board settings and persist across sessions
4. Colors update automatically when cards are copied to different calendars

**Technical Implementation**:
- Uses CSS custom properties for dynamic color application
- Calculates text contrast using WCAG luminance formula
- Stores color mappings in board settings JSON block
- Integrates seamlessly with existing color systems (tags, dates)
- Maintains backward compatibility with existing boards

### Board Settings Enhancement
Added option to place board settings at the beginning of files instead of the end:
- Controlled by "Place board settings at beginning" toggle in settings
- Useful for easier editing of board settings in markdown mode
- Parser supports reading settings from both locations for compatibility
- Header settings take precedence if both locations exist

### Settings Integration
- **Toggle Control**: Users can enable/disable the feature via plugin settings
- **Documentation**: Settings include explanation of requirements and configuration file location
- **Default State**: Feature defaults to disabled to avoid confusion for users without Full Calendar plugin

## Testing

### Manual Testing Scenarios

#### Basic Functionality
1. **Setup**: Install and configure Full Calendar plugin with at least one calendar source
2. **Enable Feature**: Toggle "Enable Copy to Calendar" in Kanban plugin settings
3. **Basic Copy**: Right-click on a Kanban card → "Copy to calendar" → Select calendar
4. **Verify**: Confirm file creation in correct directory with proper frontmatter
5. **Color Application**: Verify card background changes to match calendar color
6. **Text Contrast**: Confirm text remains readable on all calendar colors

#### Edge Cases
1. **Special Characters**: Test with directories containing `*`, `?`, `<`, `>`, `|`, `:`, `"`, `\`, `/`
2. **Wildcard Patterns**: Test both `/*` wildcard configurations and literal `/*` directory names
3. **Missing Dependencies**: Test behavior with Full Calendar plugin disabled/uninstalled
4. **Permission Issues**: Test in directories with restricted write permissions
5. **File Collisions**: Test duplicate card titles and filename collision handling
6. **Color Edge Cases**: Test with extreme colors (very light/dark) and transparency
7. **Multiple Copies**: Test copying same card to different calendars (color should update)
8. **Settings Placement**: Test board settings at beginning vs end of file

#### Platform Testing
1. **Mobile**: Verify context menu integration on mobile devices
2. **Desktop**: Confirm submenu behavior and keyboard navigation
3. **Cross-platform**: Test consistent behavior across operating systems

#### Integration Testing
1. **Multiple Calendars**: Test with various calendar configurations
2. **Calendar Types**: Verify compatibility with different Full Calendar source types
3. **Existing Events**: Confirm no interference with existing calendar functionality
4. **Plugin Reload**: Test feature persistence across plugin reloads

#### User Experience Testing
1. **Settings Discovery**: Verify users can easily find and understand the feature toggle
2. **Error Messages**: Confirm error messages are helpful and actionable
3. **Performance**: Test with large numbers of calendars and cards
4. **Accessibility**: Verify keyboard navigation and screen reader compatibility

### Test Results Summary
- ✅ Basic functionality works across all supported platforms
- ✅ Edge case handling successfully manages special characters and wildcards
- ✅ Error recovery provides meaningful feedback to users
- ✅ Settings integration follows established plugin patterns
- ✅ Performance remains responsive with typical usage volumes
- ✅ Integration maintains Full Calendar plugin compatibility

### Recommended Testing Environment
- Obsidian version 1.0.0+
- Full Calendar plugin installed and configured
- Test vault with various directory structures
- Multiple calendar sources with different configurations
- Both mobile and desktop testing environments 