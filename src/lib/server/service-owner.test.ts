import { describe, expect, it, vi } from 'vitest';
import { createServiceOwner, getProcessOwner, disposeProcessServices, type Services } from './service-owner';

describe('process service owner', () => {
  it('shares concurrent initialization and disposes once even during initialization', async () => {
    const dispose = vi.fn(async () => {});
    let ready!: (value: Services) => void;
    const factory = vi.fn(() => new Promise<Services>(resolve => { ready = resolve; }));
    const owner = createServiceOwner(factory);
    const first = owner.get();
    expect(owner.get()).toBe(first);
    const closing = owner.dispose();
    expect(owner.dispose()).toBe(closing);
    ready({runtime:{dispose}, config:{}} as unknown as Services);
    await closing;
    expect(factory).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
    await expect(owner.get()).rejects.toThrow('shutting down');
  });
  it('does not initialize pi merely to stop an unused process and rotates tokens between owners', async () => {
    const factory = vi.fn();
    const owner = createServiceOwner(factory);
    expect(createServiceOwner(factory).token).not.toBe(owner.token);
    await owner.dispose();
    expect(factory).not.toHaveBeenCalled();
  });
  it('keeps one runtime and signal set across module reloads and releases them on dev-server closure', async () => {
    const before = process.listenerCount('SIGTERM');
    const dispose = vi.fn(async () => {});
    const factory = vi.fn(async () => ({runtime:{dispose},config:{}} as unknown as Services));
    const first = getProcessOwner(factory);
    await first.get();
    vi.resetModules();
    const reloaded = await import('./service-owner');
    expect(reloaded.getProcessOwner(factory)).toBe(first);
    expect(factory).toHaveBeenCalledOnce();
    expect(process.listenerCount('SIGTERM')).toBe(before + 1);
    await disposeProcessServices();
    expect(dispose).toHaveBeenCalledOnce();
    expect(process.listenerCount('SIGTERM')).toBe(before);
    const restarted = reloaded.getProcessOwner(factory);
    expect(restarted.token).not.toBe(first.token);
    await reloaded.disposeProcessServices();
  });
});
