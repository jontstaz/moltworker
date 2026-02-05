import type { Sandbox, Process } from '@cloudflare/sandbox';
import type { PluginManifest, SkillManifest, InstallationManifest, InstallationJob, InstallationStatus } from './types';
import { waitForProcess } from './gateway/utils';

const MOLTBOT_PORT = 18789;
const BACKUP_DIR = '/data/moltbot';
const CONFIG_DIR = '/root/.openclaw';
const SKILLS_DIR = '/root/clawd/skills';
const PLUGINS_CONFIG_FILE = `${CONFIG_DIR}/plugins.json`;
const MANIFEST_FILE = `${BACKUP_DIR}/installation-manifest.json`;
const INSTALLATION_TIMEOUT_MS = 120000;

export class InstallationManager {
  private activeJobs: Map<string, InstallationJob> = new Map();

  constructor(private sandbox: Sandbox) {}

  async installPlugin(pluginName: string): Promise<InstallationJob> {
    const jobId = crypto.randomUUID();
    const job: InstallationJob = {
      id: jobId,
      type: 'plugin',
      target: pluginName,
      status: 'installing',
      startedAt: new Date().toISOString(),
      output: []
    };

    this.activeJobs.set(jobId, job);

    try {
      console.log(`[PLUGIN INSTALL] Starting installation of ${pluginName}`);
      const proc = await this.sandbox.startProcess(`openclaw plugins install ${pluginName}`);
      await waitForProcess(proc as { status: string }, INSTALLATION_TIMEOUT_MS);

      const logs = await proc.getLogs();
      job.output = [logs.stdout || '', logs.stderr || ''];

      job.status = 'completed';
      job.completedAt = new Date().toISOString();

      console.log(`[PLUGIN INSTALL] Installation completed for ${pluginName}`);
      console.log('[PLUGIN INSTALL] Exit code:', proc.exitCode);

      await this.updateManifest('plugin', { name: pluginName, installedAt: job.startedAt! });
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[PLUGIN INSTALL FAILED] ${pluginName}:`, error);
    }

    return job;
  }

  async installSkill(skillSlug: string): Promise<InstallationJob> {
    const jobId = crypto.randomUUID();
    const job: InstallationJob = {
      id: jobId,
      type: 'skill',
      target: skillSlug,
      status: 'installing',
      startedAt: new Date().toISOString(),
      output: []
    };

    this.activeJobs.set(jobId, job);

    try {
      console.log(`[SKILL INSTALL] Starting installation of ${skillSlug}`);
      const proc = await this.sandbox.startProcess(`npx clawhub install ${skillSlug}`);
      await waitForProcess(proc as { status: string }, INSTALLATION_TIMEOUT_MS);

      const logs = await proc.getLogs();
      job.output = [logs.stdout || '', logs.stderr || ''];

      job.status = 'completed';
      job.completedAt = new Date().toISOString();

      console.log(`[SKILL INSTALL] Installation completed for ${skillSlug}`);
      console.log('[SKILL INSTALL] Exit code:', proc.exitCode);

      await this.updateManifest('skill', { slug: skillSlug, installedAt: job.startedAt! });
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SKILL INSTALL FAILED] ${skillSlug}:`, error);
    }

    return job;
  }

  async uninstallPlugin(pluginName: string): Promise<boolean> {
    try {
      console.log(`[PLUGIN UNINSTALL] Starting uninstallation of ${pluginName}`);
      const proc = await this.sandbox.startProcess(`openclaw plugins uninstall ${pluginName}`);
      await waitForProcess(proc as { status: string }, INSTALLATION_TIMEOUT_MS);

      const logs = await proc.getLogs();
      console.log('[PLUGIN UNINSTALL] Exit code:', proc.exitCode);
      console.log('[PLUGIN UNINSTALL] Output:', logs.stdout);

      await this.removeFromManifest('plugin', pluginName);
      return true;
    } catch (error) {
      console.error(`[PLUGIN UNINSTALL FAILED] ${pluginName}:`, error);
      return false;
    }
  }

  async uninstallSkill(skillSlug: string): Promise<boolean> {
    try {
      console.log(`[SKILL UNINSTALL] Starting uninstallation of ${skillSlug}`);
      const proc = await this.sandbox.startProcess(`npx clawhub uninstall ${skillSlug}`);
      await waitForProcess(proc as { status: string }, INSTALLATION_TIMEOUT_MS);

      const logs = await proc.getLogs();
      console.log('[SKILL UNINSTALL] Exit code:', proc.exitCode);
      console.log('[SKILL UNINSTALL] Output:', logs.stdout);

      await this.removeFromManifest('skill', skillSlug);
      return true;
    } catch (error) {
      console.error(`[SKILL UNINSTALL FAILED] ${skillSlug}:`, error);
      return false;
    }
  }

  async listInstalled(): Promise<{ plugins: PluginManifest[]; skills: SkillManifest[] }> {
    try {
      const manifest = await this.getManifest();
      return {
        plugins: manifest.plugins || [],
        skills: manifest.skills || []
      };
    } catch (error) {
      console.error('[LIST INSTALLED FAILED]', error);
      return { plugins: [], skills: [] };
    }
  }

  private async getManifest(): Promise<InstallationManifest> {
    try {
      const proc = await this.sandbox.startProcess(`cat ${MANIFEST_FILE}`);
      await waitForProcess(proc as { status: string }, 5000);

      const logs = await proc.getLogs();
      const content = logs.stdout || '{}';
      return JSON.parse(content);
    } catch (error) {
      console.log('[GET MANIFEST] No existing manifest, starting fresh');
      return { plugins: [], skills: [], lastUpdated: new Date().toISOString() };
    }
  }

  private async updateManifest(
    type: 'plugin' | 'skill',
    entry: PluginManifest | SkillManifest
  ): Promise<void> {
    const manifest = await this.getManifest();

    if (type === 'plugin') {
      manifest.plugins = manifest.plugins || [];
      manifest.plugins.push(entry as PluginManifest);
    } else {
      manifest.skills = manifest.skills || [];
      manifest.skills.push(entry as SkillManifest);
    }

    manifest.lastUpdated = new Date().toISOString();

    await this.sandbox.startProcess(`mkdir -p ${BACKUP_DIR}`);

    const manifestJson = JSON.stringify(manifest);
    await this.sandbox.startProcess(`echo '${manifestJson}' > ${MANIFEST_FILE}`);
  }

  private async removeFromManifest(
    type: 'plugin' | 'skill',
    name: string
  ): Promise<void> {
    const manifest = await this.getManifest();

    if (type === 'plugin') {
      manifest.plugins = (manifest.plugins || []).filter(p => p.name !== name);
    } else {
      manifest.skills = (manifest.skills || []).filter(s => s.slug !== name);
    }

    manifest.lastUpdated = new Date().toISOString();

    const manifestJson = JSON.stringify(manifest);
    await this.sandbox.startProcess(`echo '${manifestJson}' > ${MANIFEST_FILE}`);
  }

  getJob(jobId: string): InstallationJob | undefined {
    return this.activeJobs.get(jobId);
  }

  getAllJobs(): InstallationJob[] {
    return Array.from(this.activeJobs.values());
  }
}
