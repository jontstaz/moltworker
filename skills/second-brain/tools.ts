/**
 * Second Brain skill - MCP tools for Obsidian vault management
 *
 * Provides tools for reading, writing, searching, and managing
 * markdown notes in a Git-backed Obsidian vault.
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Configuration
const VAULT_PATH = process.env.SECOND_BRAIN_PATH || '/root/second-brain';
const AUTO_COMMIT = process.env.SECOND_BRAIN_AUTO_COMMIT === 'true';

// Tool definitions
export const tools = [
  {
    name: 'read_note',
    description: 'Read a markdown note from the Second Brain vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the note (e.g., "01 Projects/My Project.md")'
        },
        include_metadata: {
          type: 'boolean',
          description: 'Whether to parse and return YAML frontmatter',
          default: true
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_note',
    description: 'Create or update a markdown note in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path for the note'
        },
        content: {
          type: 'string',
          description: 'Markdown content'
        },
        metadata: {
          type: 'object',
          description: 'YAML frontmatter data (optional)'
        },
        append: {
          type: 'boolean',
          description: 'Append to existing content instead of overwriting',
          default: false
        },
        auto_commit: {
          type: 'boolean',
          description: 'Commit changes after writing',
          default: AUTO_COMMIT
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'search_vault',
    description: 'Full-text search across all notes in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term or regex pattern'
        },
        path_filter: {
          type: 'string',
          description: 'Limit search to specific folder (e.g., "01 Projects")'
        },
        include_content: {
          type: 'boolean',
          description: 'Return matching content snippets',
          default: true
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results',
          default: 20
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_notes',
    description: 'Browse vault structure and list notes',
    inputSchema: {
      type: 'object',
      properties: {
        folder: {
          type: 'string',
          description: 'Folder path to list (default: root)',
          default: ''
        },
        recursive: {
          type: 'boolean',
          description: 'Include subfolders',
          default: false
        },
        include_content: {
          type: 'boolean',
          description: 'Include note content preview',
          default: false
        }
      }
    }
  },
  {
    name: 'commit_changes',
    description: 'Commit and push changes to GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message (default: auto-generated)'
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific files to commit (default: all changes)'
        },
        push: {
          type: 'boolean',
          description: 'Push to remote',
          default: true
        }
      }
    }
  },
  {
    name: 'create_daily_note',
    description: 'Create a daily journal entry from template',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (default: today)'
        },
        template: {
          type: 'string',
          description: 'Template name (default: "Daily Journal")',
          default: 'Daily Journal'
        },
        content: {
          type: 'object',
          description: 'Template variables to fill'
        }
      }
    }
  },
  {
    name: 'resolve_wikilink',
    description: 'Resolve a WikiLink to its actual file path',
    inputSchema: {
      type: 'object',
      properties: {
        link: {
          type: 'string',
          description: 'WikiLink text (e.g., "My Note" or "Folder/My Note")'
        }
      },
      required: ['link']
    }
  }
];

// Tool implementations
export async function read_note(args: { path: string; include_metadata?: boolean }) {
  const { path: notePath, include_metadata = true } = args;
  const fullPath = path.join(VAULT_PATH, notePath);

  // Security check - ensure path is within vault
  if (!fullPath.startsWith(VAULT_PATH)) {
    return { error: 'Invalid path: outside vault directory' };
  }

  if (!fs.existsSync(fullPath)) {
    return { error: `Note not found: ${notePath}` };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');

  const result: Record<string, any> = {
    path: notePath,
    exists: true,
    size: content.length
  };

  if (include_metadata) {
    const parsed = parseFrontmatter(content);
    result.metadata = parsed.metadata;
    result.body = parsed.body;
    result.wiki_links = extractWikiLinks(parsed.body);
    result.outbound_links = parsed.body.match(/\[\[([^\]]+)\]\]/g) || [];
  } else {
    result.content = content;
  }

  return result;
}

export async function write_note(args: {
  path: string;
  content: string;
  metadata?: Record<string, any>;
  append?: boolean;
  auto_commit?: boolean;
}) {
  const { path: notePath, content, metadata, append = false, auto_commit = AUTO_COMMIT } = args;
  const fullPath = path.join(VAULT_PATH, notePath);

  // Security check
  if (!fullPath.startsWith(VAULT_PATH)) {
    return { error: 'Invalid path: outside vault directory' };
  }

  // Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let finalContent: string;

  if (append && fs.existsSync(fullPath)) {
    const existing = fs.readFileSync(fullPath, 'utf-8');
    finalContent = existing + '\n\n' + content;
  } else {
    // Build content with frontmatter if provided
    if (metadata && Object.keys(metadata).length > 0) {
      const frontmatter = buildFrontmatter(metadata);
      finalContent = frontmatter + '\n' + content;
    } else {
      finalContent = content;
    }
  }

  fs.writeFileSync(fullPath, finalContent, 'utf-8');

  const result: Record<string, any> = {
    path: notePath,
    written: true,
    size: finalContent.length
  };

  if (auto_commit) {
    const commitResult = await commit_changes({
      message: `Update ${notePath} via OpenClaw`,
      files: [notePath]
    });
    result.commit = commitResult;
  }

  return result;
}

export async function search_vault(args: {
  query: string;
  path_filter?: string;
  include_content?: boolean;
  max_results?: number;
}) {
  const { query, path_filter, include_content = true, max_results = 20 } = args;

  const searchPath = path_filter ? path.join(VAULT_PATH, path_filter) : VAULT_PATH;

  if (!searchPath.startsWith(VAULT_PATH)) {
    return { error: 'Invalid path filter: outside vault directory' };
  }

  try {
    // Use ripgrep if available, otherwise fallback to node search
    const results = await searchWithRipgrep(searchPath, query, max_results);

    if (!include_content) {
      return { results: results.map(r => ({ path: r.path, line: r.line })) };
    }

    return { results };
  } catch (error) {
    // Fallback to node-based search
    const results = await searchWithNode(searchPath, query, max_results);
    return { results };
  }
}

export async function list_notes(args: {
  folder?: string;
  recursive?: boolean;
  include_content?: boolean;
}) {
  const { folder = '', recursive = false, include_content = false } = args;
  const fullPath = path.join(VAULT_PATH, folder);

  if (!fullPath.startsWith(VAULT_PATH)) {
    return { error: 'Invalid folder: outside vault directory' };
  }

  if (!fs.existsSync(fullPath)) {
    return { error: `Folder not found: ${folder}` };
  }

  const result = await listDirectory(fullPath, recursive, include_content);
  return { folder, contents: result };
}

export async function commit_changes(args: {
  message?: string;
  files?: string[];
  push?: boolean;
}) {
  const { message, files, push = true } = args;

  // Check if we're in a git repo
  if (!fs.existsSync(path.join(VAULT_PATH, '.git'))) {
    return { error: 'Not a git repository' };
  }

  try {
    // Configure git user if not already set
    try {
      execSync('git config user.name', { cwd: VAULT_PATH, stdio: 'pipe' });
    } catch {
      execSync('git config user.name "OpenClaw"', { cwd: VAULT_PATH });
      execSync('git config user.email "openclaw@localhost"', { cwd: VAULT_PATH });
    }

    // Stage files
    if (files && files.length > 0) {
      const filePaths = files.map(f => path.join(VAULT_PATH, f)).join(' ');
      execSync(`git add ${filePaths}`, { cwd: VAULT_PATH });
    } else {
      execSync('git add -A', { cwd: VAULT_PATH });
    }

    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { cwd: VAULT_PATH, encoding: 'utf-8' });
    if (!status.trim()) {
      return { committed: false, message: 'No changes to commit' };
    }

    // Commit
    const commitMessage = message || `Vault update: ${new Date().toISOString()}`;
    const fullMessage = `${commitMessage}\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;

    execSync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, { cwd: VAULT_PATH });

    // Get commit hash
    const commitHash = execSync('git rev-parse --short HEAD', {
      cwd: VAULT_PATH,
      encoding: 'utf-8'
    }).trim();

    let pushResult = { pushed: false };

    if (push) {
      try {
        execSync('git push origin HEAD', { cwd: VAULT_PATH, stdio: 'pipe' });
        pushResult = { pushed: true };
      } catch (pushError) {
        pushResult = {
          pushed: false,
          error: pushError instanceof Error ? pushError.message : 'Push failed'
        };
      }
    }

    return {
      committed: true,
      commit_hash: commitHash,
      message: commitMessage,
      files_changed: status.trim().split('\n').length,
      push: pushResult
    };
  } catch (error) {
    return {
      error: 'Commit failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function create_daily_note(args: {
  date?: string;
  template?: string;
  content?: Record<string, string>;
}) {
  const date = args.date || new Date().toISOString().split('T')[0];
  const templateName = args.template || 'Daily Journal';
  const variables = args.content || {};

  // Parse date
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  // Default variables
  const defaultVars: Record<string, string> = {
    date: date,
    year: String(year),
    month: String(month).padStart(2, '0'),
    day: String(day).padStart(2, '0'),
    weekday: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
    timestamp: new Date().toISOString(),
    ...variables
  };

  // Load template
  const templatePath = path.join(VAULT_PATH, 'Templates', `${templateName}.md`);
  let templateContent: string;

  if (fs.existsSync(templatePath)) {
    templateContent = fs.readFileSync(templatePath, 'utf-8');
  } else {
    // Default template
    templateContent = `# {{date}} - {{weekday}}\n\n## Morning\n\n\n## Afternoon\n\n\n## Evening\n\n\n## Notes\n`;
  }

  // Fill template
  const filledContent = fillTemplate(templateContent, defaultVars);

  // Write to Journal folder
  const notePath = path.join('06 Journal', `${date}.md`);

  return write_note({
    path: notePath,
    content: filledContent,
    auto_commit: AUTO_COMMIT
  });
}

export async function resolve_wikilink(args: { link: string }) {
  const { link } = args;

  // Clean the link (remove aliases)
  const cleanLink = link.split('|')[0].trim();

  // Possible paths to check
  const possiblePaths = [
    cleanLink,
    `${cleanLink}.md`,
    ...findAllMarkdownFiles(VAULT_PATH).map(f =>
      path.relative(VAULT_PATH, f).replace(/\\/g, '/')
    ).filter(f => {
      const basename = path.basename(f, '.md');
      return basename === cleanLink || f === cleanLink;
    })
  ];

  // Check each path
  for (const testPath of [...new Set(possiblePaths)]) {
    const fullPath = path.join(VAULT_PATH, testPath);
    if (fs.existsSync(fullPath)) {
      return {
        link: cleanLink,
        resolved_path: testPath,
        exists: true
      };
    }
  }

  // Not found - suggest where it could be created
  return {
    link: cleanLink,
    resolved_path: `${cleanLink}.md`,
    exists: false,
    suggestion: `Create at: ${cleanLink}.md`
  };
}

// Helper functions

function parseFrontmatter(content: string): { metadata: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const yamlContent = match[1];
    const body = content.slice(match[0].length);
    const metadata = parseYaml(yamlContent);
    return { metadata, body };
  }

  return { metadata: {}, body: content };
}

function parseYaml(yaml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Array item
    if (trimmed.startsWith('- ')) {
      if (currentKey) {
        currentArray.push(trimmed.slice(2).trim());
      }
      continue;
    }

    // Save previous array if exists
    if (currentKey && currentArray.length > 0) {
      result[currentKey] = currentArray;
      currentArray = [];
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      currentKey = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value) {
        // Try to parse as number, boolean, or keep as string
        if (value === 'true') {
          result[currentKey] = true;
        } else if (value === 'false') {
          result[currentKey] = false;
        } else if (/^-?\d+$/.test(value)) {
          result[currentKey] = parseInt(value, 10);
        } else if (/^-?\d+\.\d+$/.test(value)) {
          result[currentKey] = parseFloat(value);
        } else if (value.startsWith('"') && value.endsWith('"')) {
          result[currentKey] = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          result[currentKey] = value.slice(1, -1);
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array
          try {
            result[currentKey] = JSON.parse(value.replace(/'/g, '"'));
          } catch {
            result[currentKey] = value;
          }
        } else {
          result[currentKey] = value;
        }
        currentKey = null;
      }
    }
  }

  // Save final array if exists
  if (currentKey && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }

  return result;
}

function buildFrontmatter(metadata: Record<string, any>): string {
  const lines = ['---'];

  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(`  ${subKey}: ${subValue}`);
      }
    } else if (typeof value === 'string' && value.includes(':')) {
      lines.push(`${key}: "${value}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

function extractWikiLinks(content: string): string[] {
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return [...new Set(links)];
}

async function searchWithRipgrep(
  searchPath: string,
  query: string,
  maxResults: number
): Promise<Array<{ path: string; line: number; content: string; match: string }>> {
  try {
    // Escape special regex characters for ripgrep if it's a literal search
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const { stdout } = await execAsync(
      `rg -n --type md -m ${maxResults} "${escapedQuery}" "${searchPath}" || true`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    const results: Array<{ path: string; line: number; content: string; match: string }> = [];

    if (!stdout) return results;

    const lines = stdout.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const match = line.match(/^([^:]+):(\d+):(.+)$/);
      if (match) {
        const fullPath = match[1];
        const lineNum = parseInt(match[2], 10);
        const content = match[3];

        const relativePath = path.relative(VAULT_PATH, fullPath);

        // Extract the actual match
        const matchRegex = new RegExp(query, 'i');
        const matchResult = content.match(matchRegex);

        results.push({
          path: relativePath,
          line: lineNum,
          content: content.trim(),
          match: matchResult ? matchResult[0] : ''
        });
      }
    }

    return results;
  } catch {
    throw new Error('ripgrep failed');
  }
}

async function searchWithNode(
  searchPath: string,
  query: string,
  maxResults: number
): Promise<Array<{ path: string; line: number; content: string; match: string }>> {
  const results: Array<{ path: string; line: number; content: string; match: string }> = [];
  const files = findAllMarkdownFiles(searchPath);
  const regex = new RegExp(query, 'i');

  for (const file of files) {
    if (results.length >= maxResults) break;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push({
          path: path.relative(VAULT_PATH, file),
          line: i + 1,
          content: lines[i].trim(),
          match: lines[i].match(regex)?.[0] || ''
        });

        if (results.length >= maxResults) break;
      }
    }
  }

  return results;
}

function findAllMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

async function listDirectory(
  dirPath: string,
  recursive: boolean,
  includeContent: boolean
): Promise<Array<{ name: string; type: 'file' | 'folder'; path: string; content?: string; size?: number }>> {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: Array<{ name: string; type: 'file' | 'folder'; path: string; content?: string; size?: number }> = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(VAULT_PATH, fullPath);

    if (entry.isDirectory()) {
      const folderEntry: any = {
        name: entry.name,
        type: 'folder',
        path: relativePath
      };

      if (recursive) {
        folderEntry.children = await listDirectory(fullPath, true, includeContent);
      }

      result.push(folderEntry);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const fileEntry: any = {
        name: entry.name,
        type: 'file',
        path: relativePath,
        size: fs.statSync(fullPath).size
      };

      if (includeContent) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        fileEntry.content_preview = content.slice(0, 500) + (content.length > 500 ? '...' : '');
      }

      result.push(fileEntry);
    }
  }

  return result;
}

function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }

  // Remove unreplaced template variables
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

// Export for testing
export const _helpers = {
  parseFrontmatter,
  buildFrontmatter,
  extractWikiLinks,
  fillTemplate
};
