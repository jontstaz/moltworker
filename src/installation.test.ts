import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Sandbox } from '@cloudflare/sandbox';
import type { PluginManifest, SkillManifest } from './types';
import { InstallationManager } from './installation';

const sandboxMock = {
  startProcess: vi.fn().mockResolvedValue({
    id: 'test-proc-1',
    status: 'running',
    exitCode: 0,
    getLogs: vi.fn().mockResolvedValue({
      stdout: 'Plugin installed successfully',
      stderr: ''
    }),
    waitForPort: vi.fn().mockResolvedValue(undefined),
    kill: vi.fn().mockResolvedValue(undefined)
  }) as unknown as Sandbox,
  listProcesses: vi.fn().mockResolvedValue([])
};

describe('InstallationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('installPlugin', () => {
    it('should install a plugin successfully', async () => {
      const manager = new InstallationManager(sandboxMock as unknown as Sandbox);
      const result = await manager.installPlugin('@test/plugin');

      expect(sandboxMock.startProcess).toHaveBeenCalledWith('openclaw plugins install @test/plugin');
      expect(result).toEqual({
        id: expect.any(String),
        type: 'plugin',
        target: '@test/plugin',
        status: 'completed',
        startedAt: expect.any(String),
        completedAt: expect.any(String),
        output: ['Plugin installed successfully']
      });
    });

    it('should handle plugin installation errors', async () => {
      const errorSandbox = {
        ...sandboxMock,
        startProcess: vi.fn().mockRejectedValue(new Error('npm install failed'))
      } as unknown as Sandbox;

      const manager = new InstallationManager(errorSandbox as unknown as Sandbox);
      const result = await manager.installPlugin('@test/plugin');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('npm install failed');
    });
  });

  describe('installSkill', () => {
    it('should install a skill successfully', async () => {
      const manager = new InstallationManager(sandboxMock as unknown as Sandbox);
      const result = await manager.installSkill('test-skill');

      expect(sandboxMock.startProcess).toHaveBeenCalledWith('npx clawhub install test-skill');
      expect(result).toEqual({
        id: expect.any(String),
        type: 'skill',
        target: 'test-skill',
        status: 'completed',
        startedAt: expect.any(String),
        completedAt: expect.any(String),
        output: ['Skill installed successfully']
      });
    });

    it('should handle skill installation errors', async () => {
      const errorSandbox = {
        ...sandboxMock,
        startProcess: vi.fn().mockRejectedValue(new Error('network error'))
      } as unknown as Sandbox;

      const manager = new InstallationManager(errorSandbox as unknown as Sandbox);
      const result = await manager.installSkill('test-skill');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('network error');
    });
  });

  describe('uninstallPlugin', () => {
    it('should uninstall a plugin successfully', async () => {
      const manager = new InstallationManager(sandboxMock as unknown as Sandbox);
      const result = await manager.uninstallPlugin('@test/plugin');

      expect(sandboxMock.startProcess).toHaveBeenCalledWith('openclaw plugins uninstall @test/plugin');
      expect(result).toBe(true);
    });

    it('should handle uninstall errors gracefully', async () => {
      const errorSandbox = {
        ...sandboxMock,
        startProcess: vi.fn().mockRejectedValue(new Error('not found'))
      } as unknown as Sandbox;

      const manager = new InstallationManager(errorSandbox as unknown as Sandbox);
      const result = await manager.uninstallPlugin('@test/plugin');

      expect(result).toBe(false);
    });
  });

  describe('uninstallSkill', () => {
    it('should uninstall a skill successfully', async () => {
      const manager = new InstallationManager(sandboxMock as unknown as Sandbox);
      const result = await manager.uninstallSkill('test-skill');

      expect(sandboxMock.startProcess).toHaveBeenCalledWith('npx clawhub uninstall test-skill');
      expect(result).toBe(true);
    });
  });

  describe('listInstalled', () => {
    it('should return empty lists when no manifest exists', async () => {
      const emptySandbox = {
        ...sandboxMock,
        startProcess: vi.fn()
          .mockResolvedValueOnce({ id: 'test-proc-1', status: 'completed', exitCode: 0 })
          .mockRejectedValue(new Error('No manifest file'))
          .mockResolvedValue({
            id: 'test-proc-2',
            status: 'completed',
            exitCode: 0,
            getLogs: vi.fn().mockResolvedValue({ stdout: '{}', stderr: '' })
          }),
        listProcesses: vi.fn().mockResolvedValue([])
      } as unknown as Sandbox;

      const manager = new InstallationManager(emptySandbox as unknown as Sandbox);
      const result = await manager.listInstalled();

      expect(result).toEqual({ plugins: [], skills: [] });
    });

    it('should return installed items from manifest', async () => {
      const manifestSandbox = {
        ...sandboxMock,
        startProcess: vi.fn()
          .mockResolvedValue({ id: 'test-proc-1', status: 'completed', exitCode: 0 })
          .mockResolvedValue({
            id: 'test-proc-2',
            status: 'completed',
            exitCode: 0,
            getLogs: vi.fn().mockResolvedValue({
              stdout: JSON.stringify({
                plugins: [
                  { name: '@test/plugin', installedAt: '2026-02-02T08:00:00Z', version: '1.0.0' }
                ],
                skills: [
                  { slug: 'test-skill', installedAt: '2026-02-02T08:00:00Z', version: '2.0.0' }
                ],
                lastUpdated: '2026-02-02T08:00:00Z'
              }),
              stderr: ''
            })
          }),
        listProcesses: vi.fn().mockResolvedValue([])
      } as unknown as Sandbox;

      const manager = new InstallationManager(manifestSandbox as unknown as Sandbox);
      const result = await manager.listInstalled();

      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0]).toEqual({
        name: '@test/plugin',
        installedAt: '2026-02-02T08:00:00Z',
        version: '1.0.0'
      });
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0]).toEqual({
        slug: 'test-skill',
        installedAt: '2026-02-02T08:00:00Z',
        version: '2.0.0'
      });
    });
  });

  describe('getJob', () => {
    it('should return job by ID', async () => {
      const manager = new InstallationManager(sandboxMock as unknown as Sandbox);
      manager['activeJobs'].set('job-123', {
        id: 'job-123',
        type: 'plugin',
        target: '@test/plugin',
        status: 'completed',
        startedAt: '2026-02-02T08:00:00Z',
        completedAt: '2026-02-02T08:05:00Z',
        output: ['Success']
      });

      const job = manager.getJob('job-123');

      expect(job).toEqual({
        id: 'job-123',
        type: 'plugin',
        target: '@test/plugin',
        status: 'completed',
        startedAt: '2026-02-02T08:00:00Z',
        completedAt: '2026-02-02T08:05:00Z',
        output: ['Success']
      });
    });

    it('should return undefined for non-existent job', async () => {
      const manager = new InstallationManager(sandboxMock as unknown as Sandbox);
      const job = manager.getJob('non-existent');

      expect(job).toBeUndefined();
    });
  });

  describe('getAllJobs', () => {
    it('should return all active jobs', async () => {
      const manager = new InstallationManager(sandboxMock as unknown as Sandbox);
      manager['activeJobs'].set('job-1', {
        id: 'job-1',
        type: 'plugin',
        target: '@test/plugin',
        status: 'completed'
      });
      manager['activeJobs'].set('job-2', {
        id: 'job-2',
        type: 'skill',
        target: 'test-skill',
        status: 'completed'
      });

      const jobs = manager.getAllJobs();

      expect(jobs).toHaveLength(2);
      expect(jobs[0]).toMatchObject({
        id: 'job-1',
        type: 'plugin'
      });
      expect(jobs[1]).toMatchObject({
        id: 'job-2',
        type: 'skill'
      });
    });
  });
});
