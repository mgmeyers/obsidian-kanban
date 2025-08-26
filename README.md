# Kanban Plus

**Enhanced Kanban boards with cross-file card movement, calendar integration, and advanced workflow features.**

Kanban Plus extends the popular Kanban plugin with powerful new features designed for complex project management and interconnected workflows in Obsidian.

## ✨ Key Features

### 🔗 **Cross-File Card Movement**

- **Associate multiple Kanban files** with any board
- **Move cards between different files** seamlessly
- **Unified workflow management** across projects
- **Smart metadata injection** - automatically adds kanban metadata to associated files

### 📅 **Calendar Integration**

- **Hashtag-based color display** - cards automatically show calendar colors
- **Copy cards to Full Calendar** with one click and automatic hashtag addition
- **Dynamic color resolution** - no configuration required
- **Smart text contrast** - readable text on any background
- **Emoji color indicators** in calendar picker
- **Cross-platform support** (desktop and mobile)

### ⚙️ **Advanced Configuration**

- **Board-specific settings** can be placed at file beginning
- **Associated file management** through intuitive UI
- **Flexible settings inheritance** from global to board level

### 🎨 **Enhanced Visual Experience**

- **Hashtag-driven card colors** with instant visual feedback
- **Zero-configuration color management** - works with existing Full Calendar settings
- **Smart contrast algorithms** for optimal readability
- **Modern, responsive interface**

## 🚀 Getting Started

### Installation

1. **Download**: Get Kanban Plus from the Obsidian Community Plugins
2. **Enable**: Activate the plugin in Settings → Community Plugins
3. **Configure**: Set up your preferences in the plugin settings

### Basic Usage

1. **Create a Kanban board**: Add `kanban-plugin: board` to any markdown file's frontmatter
2. **Add lists and cards**: Use the intuitive drag-and-drop interface
3. **Associate files**: Open board settings to link other Kanban files
4. **Move cards across files**: Right-click any card → Move to file → Select destination

## 📋 Cross-File Workflow

### Setting Up Associated Files

1. Open any Kanban board
2. Click the settings gear icon
3. Scroll to **"Associated Files"** section
4. Click **"Add associated file"**
5. Select another markdown file from your vault
6. The file will automatically get kanban metadata if needed

### Moving Cards Between Files

1. Right-click on any card
2. Select **"Move to list"**
3. Choose from:
   - **Local lists**: Current board lanes
   - **File lists**: `filename/list-name` format
4. Card moves instantly with all content preserved

## 📅 Calendar Integration

### Setup

1. Install and configure the [Full Calendar](https://github.com/davish/obsidian-full-calendar) plugin
2. Enable "Full note" mode in Full Calendar settings
3. In Kanban Plus settings, enable **"Copy to Calendar"**

### Automatic Color Display

Cards automatically display calendar colors when they contain hashtags matching calendar names:

- **Add hashtags manually**: `My task #Work` → shows Work calendar color
- **Multiple calendars**: `#Work #Personal` → uses first matching calendar
- **Case-insensitive**: `#work` matches "Work" calendar

### Copy to Calendar

1. Right-click any card
2. Select **"Copy to calendar"**
3. Choose destination calendar with emoji color indicators
4. Card appears in calendar as all-day event
5. If missing, calendar hashtag is automatically added to card
6. Card background instantly updates to match calendar color
7. Drag in Full Calendar to set specific times

## 🛠️ Advanced Configuration

### Board Settings Location

- **Traditional**: Settings stored at end of file
- **Header Mode**: Settings at beginning for quick editing
- Configure per-board in board settings

### Settings Hierarchy

```
Global Plugin Settings
    ↓ (inherited by)
Board-Specific Settings
    ↓ (inherited by)
Individual Card Properties
```

### Associated Files Management

- **Add files**: Through board settings file picker
- **Remove files**: Click "Remove file" button
- **Auto-metadata**: Files automatically get kanban support
- **No limits**: Associate as many files as needed

## 🎯 Use Cases

### Project Management

- **Main board**: Project overview with major milestones
- **Sub-boards**: Detailed tasks for each milestone
- **Cross-movement**: Promote tasks from sub-projects to main board

### Content Creation

- **Ideas board**: Brainstorming and initial concepts
- **Writing board**: Articles in progress
- **Publishing board**: Final review and publishing pipeline
- **Calendar sync**: Deadlines and publication dates

### Personal Productivity

- **Inbox board**: Capture all incoming tasks
- **Weekly board**: Current week's priorities
- **Project boards**: Long-term initiatives
- **Calendar integration**: Time-blocked scheduling

## 🔧 Technical Details

### File Format Compatibility

- **Markdown-based**: All boards are standard markdown files
- **Portable**: Works across different Obsidian installations
- **Version control friendly**: Git-compatible format
- **Future-proof**: No proprietary formats

### Performance

- **Optimized rendering**: Fast even with large boards
- **Lazy loading**: Associated files loaded on-demand
- **Efficient sync**: Only changed boards are saved
- **Mobile optimized**: Smooth performance on all platforms

### Data Safety

- **Non-destructive**: Original file structure preserved
- **Atomic operations**: All changes are transactional
- **Backup compatible**: Works with any backup solution
- **Sync friendly**: Compatible with Obsidian Sync

## 🤝 Contributing

We welcome contributions! Whether it's:

- 🐛 **Bug reports**
- 💡 **Feature suggestions**
- 📝 **Documentation improvements**
- 🔧 **Code contributions**

### Development Setup

```bash
# Clone the repository
git clone https://github.com/geetduggal/kanban-plus
cd kanban-plus

# Install dependencies
npm install

# Build for development
npm run dev

# Build for production
npm run build
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built upon the excellent [obsidian-kanban](https://github.com/mgmeyers/obsidian-kanban) by mgmeyers
- Inspired by the Obsidian community's collaborative spirit
- Calendar integration designed for [Full Calendar](https://github.com/davish/obsidian-full-calendar) plugin

---

**Made with ❤️ for the Obsidian community**

_Transform your markdown files into a powerful, interconnected project management system._
