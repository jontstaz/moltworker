# Second Brain

Access and manage your Obsidian vault for long-term memory, knowledge base, and workspace logging.

## Overview

This skill provides tools to interact with your Second Brain Obsidian vault stored in a GitHub repository. It supports:

- Reading and writing markdown notes with YAML frontmatter
- WikiLinks (`[[Note Name]]`) navigation
- Full-text search across the vault
- Automatic git commit and push
- Daily note creation
- Template-based note creation
- PARA method folder structure (Projects, Areas, Resources, Archives)

## Configuration

The following environment variables configure the Second Brain integration:

- `GITHUB_TOKEN` - GitHub Personal Access Token for repository access
- `SECOND_BRAIN_REPO` - Repository URL (HTTPS format with token embedded)
- `SECOND_BRAIN_AUTO_COMMIT` - Set to `true` to auto-commit changes
- `SECOND_BRAIN_PATH` - Local path in container (default: `/root/second-brain`)

## Tools

### read_note

Read a markdown note from the vault.

**Parameters:**
- `path` (string, required) - Relative path to the note (e.g., "01 Projects/My Project.md")
- `include_metadata` (boolean) - Whether to parse and return YAML frontmatter

**Returns:** Note content, metadata, and outbound wiki links.

### write_note

Create or update a markdown note.

**Parameters:**
- `path` (string, required) - Relative path for the note
- `content` (string, required) - Markdown content
- `metadata` (object, optional) - YAML frontmatter data
- `append` (boolean) - Append to existing content instead of overwriting
- `auto_commit` (boolean) - Commit changes after writing

**Returns:** Path written and commit status.

### search_vault

Full-text search across all notes.

**Parameters:**
- `query` (string, required) - Search term or regex pattern
- `path_filter` (string, optional) - Limit search to specific folder
- `include_content` (boolean) - Return matching content snippets

**Returns:** Matching files with snippets and line numbers.

### list_notes

Browse vault structure and list notes.

**Parameters:**
- `folder` (string, optional) - Folder path to list (default: root)
- `recursive` (boolean) - Include subfolders
- `include_content` (boolean) - Include note content preview

**Returns:** Folder structure with note metadata.

### commit_changes

Commit and push changes to GitHub.

**Parameters:**
- `message` (string, optional) - Commit message
- `files` (string[], optional) - Specific files to commit (default: all changes)
- `push` (boolean) - Push to remote (default: true)

**Returns:** Commit hash and push status.

### create_daily_note

Create a daily journal entry from template.

**Parameters:**
- `date` (string, optional) - Date in YYYY-MM-DD format (default: today)
- `template` (string, optional) - Template name (default: "Daily Journal")
- `content` (object, optional) - Template variables to fill

**Returns:** Path to created daily note.

### resolve_wikilink

Resolve a WikiLink to its actual file path.

**Parameters:**
- `link` (string, required) - WikiLink text (e.g., "My Note" or "Folder/My Note")

**Returns:** Resolved file path and existence status.

## Vault Structure

Your vault follows the PARA method:

```
/root/second-brain/
├── 00 Inbox/          # Capture everything first
├── 01 Projects/       # Active work with clear goals
├── 02 Areas/          # Ongoing responsibilities
├── 03 Resources/      # Knowledge base, references
├── 04 Archives/       # Completed work
├── 05 System/         # How the system operates
├── 06 Journal/        # Daily logs
├── 07 People/         # People notes
├── 08 Ideas/          # Thoughts and experiments
├── Templates/         # Note templates
├── Home.md            # Dashboard
└── Map of Content.md  # Visual overview
```

## Examples

### Read a note
```json
{
  "path": "01 Projects/OpenClaw Integration.md"
}
```

### Write a new note
```json
{
  "path": "06 Journal/2025-02-05.md",
  "content": "# Today\n\nWorked on Second Brain integration...",
  "metadata": {
    "tags": ["journal", "openclaw"],
    "mood": "productive"
  },
  "auto_commit": true
}
```

### Search for tasks
```json
{
  "query": "- [ ]",
  "path_filter": "01 Projects"
}
```

### Create daily note
```json
{
  "date": "2025-02-05",
  "content": {
    "mood": "focused",
    "focus": "Second Brain implementation"
  }
}
```

## Git Integration

Changes are committed to GitHub with:
- Automatic commit messages with timestamp
- Co-authored by attribution for OpenClaw
- Push to main branch on every change (if auto_commit enabled)

## Obsidian Features Supported

- **WikiLinks**: `[[Note Name]]` for internal linking
- **Frontmatter**: YAML metadata at note start
- **Tags**: `#tag` or `tags: [tag1, tag2]` in frontmatter
- **Dataview**: Queries are preserved (though not executed server-side)
- **Templates**: Placeholder substitution with `{{variable}}` syntax
- **Folder Notes**: Special notes with same name as folder

## Best Practices

1. **Use WikiLinks** - Link related notes for navigation
2. **Add metadata** - Use frontmatter for categorization
3. **Commit frequently** - Auto-commit ensures changes are saved
4. **Use templates** - Maintain consistent note structure
5. **Organize with PARA** - Keep Inbox clear, archive completed work
