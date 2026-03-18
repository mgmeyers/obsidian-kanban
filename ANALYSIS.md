# OBSIDIAN-KANBAN PLUGIN: PARSERS & STATE MANAGEMENT ANALYSIS

## 1. ALL FILES IN PARSERS & HELPERS DIRECTORIES

### PARSERS (/src/parsers/)
- common.ts
- List.ts  
- parseMarkdown.ts
- extensions/blockid.ts
- extensions/genericWrapped.ts
- extensions/helpers.ts
- extensions/internalMarkdownLink.ts
- extensions/tag.ts
- extensions/taskList.ts
- extensions/types.ts
- formats/list.ts
- helpers/ast.ts
- helpers/hydrateBoard.ts
- helpers/inlineMetadata.ts
- helpers/parser.ts

### HELPERS (/src/helpers/)
- boardModifiers.ts
- patch.ts
- renderMarkdown.ts
- util.ts

---

## 2. MARKDOWN PARSING FLOW

### Parse Direction: Markdown → Object Model

**Step 1: parseMarkdown()** [parseMarkdown.ts:167]
- Extracts YAML frontmatter (first --- to closing ---)
- Extracts settings JSON footer (`...` inside %% kanban:settings...%%)
- Uses mdast-util-from-markdown with extensions
- Returns: { settings, frontmatter, ast }

**Step 2: Extensions** [parseMarkdown.ts:65-76]
- gfmTaskListItem - Standard Obsidian checkboxes [x], [ ], etc
- date/dateLink - Dates: 📅{YYYY-MM-DD} or 📅[[YYYY-MM-DD]]
- time - Times: ⏰{HH:mm}
- embedWikilink - Embeds: ![[file]]
- wikilink - Links: [[file]]
- tag - Hashtags: #tag
- blockid - Block refs: ^block-id

**Step 3: astToUnhydratedBoard()** [formats/list.ts:240]
- Scans AST for headings (Lanes)
- For each heading, finds following list (Items)
- Special case: heading titled 'Archive' goes to board.data.archive
- Creates structure with raw/unparsed metadata strings

**Step 4: hydrateBoard()** [helpers/hydrateBoard.ts:138]
- Converts dateStr string → moment.Moment(date)
- Converts timeStr string → moment.Moment(time)
- Resolves file paths to TFile objects
- Parses inline metadata fields
- Builds searchable titleSearch field

### Serialize Direction: Object Model → Markdown

**boardToMd()** [formats/list.ts:443]
- YAML frontmatter first
- For each lane: laneToMd()
- Archive section if items exist
- Settings JSON footer

**laneToMd()** [formats/list.ts:407]
- "## Lane Title" (or "## Lane Title (5)" if maxItems set)
- "**Complete**" if shouldMarkItemsComplete
- For each item: itemToMd()

**itemToMd()** [formats/list.ts:403]
- "- [checkChar] titleRaw ^blockId"
- Multi-line content indented with 4 spaces/tab

---

## 3. ITEM DATA STRUCTURE - ALL FIELDS

### ItemData Interface [types.ts:80-90]
