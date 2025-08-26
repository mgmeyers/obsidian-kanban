# Kanban Plus

**A feature-enhanced fork of the popular Kanban plugin for Obsidian**

Kanban Plus is built on the solid foundation of [mgmeyers/obsidian-kanban](https://github.com/mgmeyers/obsidian-kanban) and stays synchronized with upstream while adding powerful new capabilities for advanced project management and interconnected workflows.

## 🔄 About This Fork

Kanban Plus maintains **100% compatibility** with the original Kanban plugin while extending it with:

- **Cross-file card movement** between associated Kanban boards
- **Advanced calendar integration** with hashtag-based visual feedback
- **Enhanced workflow features** for complex project management
- **Zero breaking changes** - all your existing boards continue to work perfectly

This plugin is designed to **stay in sync** with the original Kanban plugin, incorporating upstream improvements while providing additional functionality for power users.

### 🤖 **AI-Powered Development**

Kanban Plus is developed and maintained using AI-assisted tools to ensure:
- Rapid feature development and bug fixes
- Comprehensive testing across different scenarios
- Up-to-date documentation and compatibility
- Quick adaptation to Obsidian API changes

## ✨ Enhanced Features

The original Kanban plugin features, plus:

#### 🔗 **Cross-File Card Movement**

- Associate multiple Kanban files with any board
- Move cards between different files seamlessly
- Unified workflow management across projects
- Smart metadata injection - automatically adds kanban metadata to associated files

#### 📅 **Advanced Calendar Integration**

- Hashtag-based color display - cards automatically show calendar colors based on hashtags
- One-click copy to Full Calendar with automatic hashtag addition
- Dynamic color resolution - zero configuration required
- Smart text contrast - readable text on any background color
- Emoji color indicators in calendar picker for visual clarity
- Clean calendar filenames - hashtags stripped from event names

#### ⚙️ **Advanced Configuration Options**

- Flexible settings placement - board settings at file beginning or end
- Associated file management through intuitive file picker UI
- Enhanced settings inheritance from global to board level

#### 🎨 **Enhanced Visual Experience**

- Hashtag-driven card colors with instant visual feedback
- Zero-configuration color management - works with existing Full Calendar settings
- Smart contrast algorithms for optimal readability across all themes

### 🔄 **Original Kanban Features**

- Drag-and-drop card management
- Lane customization and archiving
- Date and time picker integration
- Tag and metadata support
- Mobile-responsive design
- Theme compatibility

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

- 🐛 **Bug reports** (especially ones affecting both plugins)
- 💡 **Feature suggestions** for Kanban Plus enhancements
- 📝 **Documentation improvements**
- 🔧 **Code contributions**

### 🔀 **Contribution Guidelines**

- **Core Kanban bugs**: Consider reporting to the [original repository](https://github.com/mgmeyers/obsidian-kanban) first
- **Enhancement bugs**: Report here if they affect Kanban Plus exclusive features
- **New features**: Best contributed to Kanban Plus to maintain our extended functionality
- **Documentation**: Always welcome for clarifying the relationship between plugins

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

### 🚀 **Sync with Upstream**

This fork periodically syncs with the original repository to incorporate improvements. If you're contributing core functionality improvements, consider contributing to the original project as well to benefit the entire community.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

### 🫡 **Built On**

This plugin is built on:

- **[mgmeyers/obsidian-kanban](https://github.com/mgmeyers/obsidian-kanban)** - The original Kanban plugin
- **The Obsidian Community** - Collaborative development ecosystem
- **[Full Calendar Plugin](https://github.com/davish/obsidian-full-calendar)** - Calendar integration partner

### 🤝 **Relationship with Original Plugin**

Kanban Plus is built with deep respect for the original Kanban plugin and its maintainer. This fork:

- **Preserves all original functionality** without modification
- **Adds new features** as extensions rather than replacements
- **Maintains compatibility** with the original plugin's file format
- **Stays synchronized** with upstream improvements when possible
- **Contributes back** bug fixes and improvements to the community

We encourage users to support both projects and choose the version that best fits their workflow needs.

---

**Made for the Obsidian community**
