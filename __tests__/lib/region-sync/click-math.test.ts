import { describe, expect, it } from 'vitest';
import { clientXToTime } from '@/lib/region-sync/click-math';

describe('clientXToTime', () => {
  it('maps a click at the container left edge to time 0 when unscrolled', () => {
    const t = clientXToTime({ clientX: 100, configuredPxPerSec: 50, containerLeft: 100, containerWidth: 500, duration: 10, scrollLeft: 0 });
    expect(t).toBe(0);
  });

  it('applies configured pxPerSec in the zoomed case', () => {
    const t = clientXToTime({ clientX: 200, configuredPxPerSec: 50, containerLeft: 100, containerWidth: 500, duration: 10, scrollLeft: 0 });
    // (200 - 100 + 0) / 50 = 2.0
    expect(t).toBe(2);
  });

  it('falls back to container-width / duration when configured pxPerSec is 0 (fit-to-window)', () => {
    // container is 500px wide, 10s audio → implicit 50 px/sec
    const t = clientXToTime({ clientX: 350, configuredPxPerSec: 0, containerLeft: 100, containerWidth: 500, duration: 10, scrollLeft: 0 });
    // (350 - 100 + 0) / 50 = 5.0
    expect(t).toBe(5);
  });

  it('accounts for scroll offset in the zoomed case', () => {
    const t = clientXToTime({ clientX: 200, configuredPxPerSec: 100, containerLeft: 100, containerWidth: 500, duration: 60, scrollLeft: 300 });
    // (200 - 100 + 300) / 100 = 4.0
    expect(t).toBe(4);
  });

  it('returns null when duration is 0', () => {
    const t = clientXToTime({ clientX: 200, configuredPxPerSec: 50, containerLeft: 100, containerWidth: 500, duration: 0, scrollLeft: 0 });
    expect(t).toBeNull();
  });

  it('returns null when fit-to-window would produce a zero px/sec (zero-width container)', () => {
    const t = clientXToTime({ clientX: 200, configuredPxPerSec: 0, containerLeft: 100, containerWidth: 0, duration: 10, scrollLeft: 0 });
    expect(t).toBeNull();
  });
});
