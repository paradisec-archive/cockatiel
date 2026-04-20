import type { RegionSpec } from './types';

interface DiffOps {
  adds: RegionSpec[];
  removes: string[];
  updates: RegionSpec[];
}

const sameBounds = (a: RegionSpec, b: RegionSpec): boolean => {
  return a.start === b.start && a.end === b.end && a.speaker === b.speaker;
};

export const diffRegions = (prev: ReadonlyMap<string, RegionSpec>, next: ReadonlyMap<string, RegionSpec>): DiffOps => {
  const adds: RegionSpec[] = [];
  const removes: string[] = [];
  const updates: RegionSpec[] = [];

  for (const id of prev.keys()) {
    if (!next.has(id)) {
      removes.push(id);
    }
  }

  for (const [id, nextSpec] of next) {
    const prevSpec = prev.get(id);
    if (!prevSpec) {
      adds.push(nextSpec);
    } else if (!sameBounds(prevSpec, nextSpec)) {
      updates.push(nextSpec);
    }
  }

  return { adds, removes, updates };
};
