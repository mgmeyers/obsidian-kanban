# Kanban Plus Features

## 🔗 Cross-File Card Movement

### Overview

Kanban Plus introduces the revolutionary ability to move cards between different Kanban files, enabling complex multi-board workflows that were previously impossible.

### Key Capabilities

- **Associate unlimited files** with any Kanban board
- **Move cards instantly** between associated files
- **Preserve all card data** during cross-file moves
- **Smart metadata injection** - associated files automatically become Kanban-enabled
- **Intuitive file management** through clean board settings UI

### How It Works

#### Setting Up Associated Files

1. Open any Kanban board's settings (gear icon)
2. Scroll to "Associated Files" section
3. Click "Add associated file"
4. Select any markdown file from your vault
5. File automatically gets `kanban-plugin: board` metadata if needed

#### Moving Cards Between Files

1. Right-click any card to open context menu
2. See separate menu options:
   - **"Move to list"** → Shows current board's lanes (`List Name`)
   - **"Move to list (filename)"** → Shows associated file's lanes (`List Name`)
3. Hover over any option to see available destination lanes
4. Click destination to move card instantly

### Use Cases

- **Project hierarchies**: Main project → Sub-projects → Tasks
- **Workflow stages**: Inbox → Processing → Done → Archive
- **Team collaboration**: Individual boards → Team board → Company board
- **Content pipelines**: Ideas → Draft → Review → Published

---

## 📅 Advanced Calendar Integration

### Overview

Revolutionary hashtag-based integration with Full Calendar plugin, featuring automatic color association and smart visual feedback.

### Enhanced Features

- **Hashtag-driven color display** - cards automatically show calendar colors
- **One-click card copying** to Full Calendar with automatic hashtag addition
- **Dynamic color resolution** - no configuration required
- **Smart text contrast** for optimal readability
- **Emoji color indicators** in calendar picker
- **Live sync** with Full Calendar settings
- **Cross-platform support** (desktop and mobile)

### Hashtag-Based Visual System

Cards automatically display calendar colors when they contain matching hashtags:

1. **Hashtag detection** - scans card content for hashtags like `#Work`, `#Personal`
2. **Calendar matching** - compares hashtags to Full Calendar configuration
3. **Color application** - first matching hashtag determines card appearance
4. **Real-time updates** - colors change instantly when hashtags are modified

### Copy to Calendar Enhancement

When you copy a card to a calendar:

1. **Event creation** - markdown file created in calendar directory
2. **Hashtag addition** - calendar name added as hashtag if not present
3. **Instant visual feedback** - card immediately displays calendar colors
4. **Persistent association** - hashtag provides lasting visual connection

### Calendar Picker Enhancements

- **🔴 Red calendars** - easily identifiable
- **🔵 Blue calendars** - clear visual distinction
- **🟢 Green calendars** - natural color coding
- **🟡 Yellow calendars** - bright and visible
- **🟣 Purple calendars** - distinctive marking
- **🟠 Orange calendars** - warm color option

### Smart Color Algorithm

Advanced contrast algorithm ensures text is always readable:

- **Light backgrounds** → black text for optimal contrast
- **Dark backgrounds** → white text for maximum readability
- **Mid-tone backgrounds** → calculated contrast optimization
- **Matches Full Calendar** color decisions exactly

### Zero-Configuration Design

- **No setup required** - reads existing Full Calendar settings
- **No data storage** - colors calculated dynamically from hashtags
- **Always current** - reflects latest Full Calendar configuration
- **Automatic updates** - changes to calendars instantly update card colors

---

## ⚙️ Advanced Configuration System

### Board Settings Flexibility

- **Header placement**: Settings at file beginning for quick editing
- **Footer placement**: Traditional settings at file end
- **Per-board configuration**: Choose placement per board
- **Global defaults**: Set organization-wide preferences

### Settings Hierarchy

```
Global Plugin Settings (baseline)
    ↓
Board-Specific Settings (override)
    ↓
Individual Card Properties (final)
```

### Associated Files Management

- **Visual file list** with full paths displayed
- **One-click removal** with confirmation
- **Search-enabled picker** for large vaults
- **Automatic validation** ensures only valid files
- **Real-time updates** when files are added/removed

---

## 🎨 Enhanced User Experience

### Modern Interface Design

- **Clean, modern styling** consistent with Obsidian
- **Responsive design** works on all screen sizes
- **Smooth animations** for better feedback
- **Accessible colors** meeting WCAG guidelines
- **Mobile-optimized** touch interactions

### Performance Optimizations

- **Lazy loading** of associated file data
- **Efficient rendering** for large boards
- **Smart caching** reduces file system calls
- **Debounced saves** prevent excessive writes
- **Memory management** for long-running sessions

### Error Handling

- **Graceful failures** with helpful error messages
- **Console logging** for debugging
- **Atomic operations** prevent data corruption
- **Rollback capabilities** for failed operations
- **User notifications** for important events

---

## 🛠️ Technical Architecture

### Data Model

```typescript
interface KanbanSettings {
  // ... existing settings
  'associated-files'?: string[]; // New: linked file paths
  'enable-copy-to-calendar'?: boolean; // Calendar integration toggle
}

// Hashtag-based color resolution - no storage required
function getCardColor(cardContent: string): CardColor | null {
  // Parse hashtags from content: /#([^\s#]+)/g
  // Match against Full Calendar configuration
  // Return dynamic color calculation
  return dynamicallyResolvedColor;
}
```

### File Format Compatibility

- **Pure markdown** - no proprietary formats
- **Git-friendly** - clean diffs and history
- **Portable** - works across Obsidian installations
- **Future-proof** - based on open standards
- **Sync-compatible** - works with any sync solution

### Cross-File Operations

```typescript
// Simplified workflow
moveCardToAssociatedFile(
  sourceStateManager, // Current board
  targetStateManager, // Destination board
  card, // Card to move
  sourcePath, // Current position
  targetLaneIndex // Destination lane
);
```

### Security & Safety

- **Non-destructive operations** - original data preserved
- **Transactional updates** - all-or-nothing changes
- **Backup compatibility** - works with any backup system
- **Permission respect** - follows Obsidian file permissions
- **Conflict resolution** - handles concurrent edits gracefully

---

## 🎯 Real-World Workflows

### Software Development

```
📋 Product Backlog (main.md)
├── 🔗 Associated Files:
│   ├── sprint-current.md
│   ├── sprint-next.md
│   └── bugs.md
└── 📝 Move cards between:
    ├── Backlog → Current Sprint
    ├── Current Sprint → Done
    └── Bugs → Sprint Backlog
```

### Content Creation

```
📝 Content Pipeline (content.md)
├── 🔗 Associated Files:
│   ├── ideas.md
│   ├── writing.md
│   └── published.md
└── 📝 Workflow:
    ├── Ideas → Writing
    ├── Writing → Review
    └── Review → Published
```

### Personal Productivity

```
🎯 GTD System (gtd.md)
├── 🔗 Associated Files:
│   ├── inbox.md
│   ├── projects.md
│   └── someday.md
└── 📝 Processing:
    ├── Inbox → Projects
    ├── Projects → Next Actions
    └── Later → Someday/Maybe
```

### Academic Research

```
🎓 Research Project (research.md)
├── 🔗 Associated Files:
│   ├── literature-review.md
│   ├── data-collection.md
│   └── writing.md
└── 📝 Progress:
    ├── Ideas → Literature Review
    ├── Literature → Data Collection
    └── Data → Writing
```

---

## 🚀 Getting Started Guide

### Quick Setup (5 minutes)

1. **Install Kanban Plus** from Community Plugins
2. **Create a main board** - add `kanban-plugin: board` to frontmatter
3. **Create associated boards** - separate .md files for sub-projects
4. **Link them** - board settings → Associated Files → Add
5. **Start moving cards** - right-click → Move to file

### Best Practices

- **Start simple** - begin with 2-3 associated files
- **Use descriptive names** - clear file names help navigation
- **Regular maintenance** - remove unused associations
- **Backup regularly** - protect your workflow data
- **Document structure** - maintain README for team use

### Troubleshooting

- **Cards not moving?** Check file permissions and associated file list
- **Colors not persisting?** Verify Obsidian Sync is working properly
- **Performance issues?** Reduce number of associated files or use smaller boards
- **UI problems?** Restart Obsidian or disable/re-enable plugin

---

**Transform your Obsidian vault into a powerful, interconnected project management system with Kanban Plus!** 🚀
