import { z } from 'zod';

const INSTALLER_API_URL = process.env.INSTALLER_API_URL || 'https://your-worker.workers.dev/api';

export const install_plugin = {
  name: 'install_plugin',
  description: 'Install an OpenClaw plugin by name. Plugins are in-process code modules that extend OpenClaw with tools, RPC methods, CLI commands, and background services.',
  inputSchema: z.object({
    name: z.string().describe('The plugin name or package to install (e.g., @getfoundry/foundry-openclaw)')
  }),

  execute: async ({ name }: { name: string }) => {
    console.log(`[INSTALLER] Installing plugin: ${name}`);

    try {
      const response = await fetch(`${INSTALLER_API_URL}/plugins/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INSTALLER_API_TOKEN || ''}`
        },
        body: JSON.stringify({ plugin: name })
      });

      if (!response.ok) {
        const error = await response.text();
        return `Failed to install plugin: ${error}`;
      }

      const result = await response.json();

      if (result.error) {
        return `Installation failed: ${result.error}`;
      }

      return `Successfully installed plugin: ${name}. Installation ID: ${result.jobId}. Status: ${result.status}. ${result.message || ''}`;
    } catch (error) {
      console.error('[INSTALLER] Plugin installation failed:', error);
      return `Failed to install plugin: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

export const install_skill = {
  name: 'install_skill',
  description: 'Install an OpenClaw skill by slug from ClawHub. Skills are AgentSkills-compatible folders with SKILL.md that teach agents how to use tools.',
  inputSchema: z.object({
    slug: z.string().describe('The skill slug to install from ClawHub (e.g., research, code-analysis)')
  }),

  execute: async ({ slug }: { slug: string }) => {
    console.log(`[INSTALLER] Installing skill: ${slug}`);

    try {
      const response = await fetch(`${INSTALLER_API_URL}/skills/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INSTALLER_API_TOKEN || ''}`
        },
        body: JSON.stringify({ skill: slug })
      });

      if (!response.ok) {
        const error = await response.text();
        return `Failed to install skill: ${error}`;
      }

      const result = await response.json();

      if (result.error) {
        return `Installation failed: ${result.error}`;
      }

      return `Successfully installed skill: ${slug}. Installation ID: ${result.jobId}. Status: ${result.status}. ${result.message || ''}`;
    } catch (error) {
      console.error('[INSTALLER] Skill installation failed:', error);
      return `Failed to install skill: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

export const list_installed = {
  name: 'list_installed',
  description: 'List all installed plugins and skills',
  inputSchema: z.object({}),

  execute: async () => {
    console.log('[INSTALLER] Listing installed plugins and skills');

    try {
      const response = await fetch(`${INSTALLER_API_URL}/plugins`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.INSTALLER_API_TOKEN || ''}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        return `Failed to list installations: ${error}`;
      }

      const result = await response.json();

      const plugins = result.plugins || [];
      const skills = result.skills || [];

      let message = 'Installed items:\n\n';
      
      if (plugins.length > 0) {
        message += 'Plugins:\n';
        for (const plugin of plugins) {
          message += `  - ${plugin.name} (installed: ${plugin.installedAt})\n`;
        }
      } else {
        message += 'No plugins installed\n';
      }

      if (skills.length > 0) {
        message += '\nSkills:\n';
        for (const skill of skills) {
          message += `  - ${skill.slug} (installed: ${skill.installedAt})\n`;
        }
      } else {
        message += '\nNo skills installed\n';
      }

      return message.trim();
    } catch (error) {
      console.error('[INSTALLER] Failed to list installations:', error);
      return `Failed to list installations: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};
