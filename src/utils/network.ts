export interface NetNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  infected: boolean;
  protected: boolean;
  label: string;
}

export interface NetEdge {
  a: number;
  b: number;
}

export interface NetworkState {
  nodes: NetNode[];
  edges: NetEdge[];
}

export const DEFAULT_NODE_COUNT = 12;

/** Build an empty (uninfected) network with a deterministic ring + chords layout. */
export function buildNetwork(
  nodeCount = DEFAULT_NODE_COUNT,
  width = 600,
  height = 400
): NetworkState {
  const n = Math.max(2, Math.min(40, Math.floor(nodeCount)));
  const nodes: NetNode[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 50;

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    nodes.push({
      id: i,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      infected: false,
      protected: false,
      label: `N${i}`,
    });
  }

  // Deterministic topology: ring + chords (every node connected to i+1 and i+3)
  const edges: NetEdge[] = [];
  const edgeSet = new Set<string>();
  const addEdge = (a: number, b: number) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (!edgeSet.has(key) && a !== b) {
      edgeSet.add(key);
      edges.push({ a, b });
    }
  };
  for (let i = 0; i < n; i++) {
    addEdge(i, (i + 1) % n);
    if (n > 4) addEdge(i, (i + 3) % n);
  }

  return { nodes, edges };
}

export function adjacency(state: NetworkState): Map<number, number[]> {
  const map = new Map<number, number[]>();
  state.nodes.forEach(n => map.set(n.id, []));
  state.edges.forEach(e => {
    map.get(e.a)!.push(e.b);
    map.get(e.b)!.push(e.a);
  });
  return map;
}

export interface SpreadResult {
  state: NetworkState;
  newlyInfected: number[];
}

/**
 * Deterministic spread step (no randomness).
 * A healthy, unprotected node becomes infected if the fraction of its
 * infected neighbors is >= threshold (0–1).
 */
export function spreadStep(
  state: NetworkState,
  threshold = 0.5
): SpreadResult {
  const adj = adjacency(state);
  const infectedIds = new Set(state.nodes.filter(n => n.infected).map(n => n.id));
  const newly: number[] = [];

  state.nodes.forEach(n => {
    if (n.infected || n.protected) return;
    const neighbors = adj.get(n.id) ?? [];
    if (neighbors.length === 0) return;
    const infectedNeighbors = neighbors.filter(nid => infectedIds.has(nid)).length;
    const fraction = infectedNeighbors / neighbors.length;
    if (fraction >= threshold && infectedNeighbors > 0) {
      newly.push(n.id);
    }
  });

  if (newly.length === 0) return { state, newlyInfected: [] };

  const newNodes = state.nodes.map(n =>
    newly.includes(n.id) ? { ...n, infected: true } : n
  );
  return { state: { ...state, nodes: newNodes }, newlyInfected: newly };
}

export function setNodeInfected(
  state: NetworkState,
  id: number,
  infected: boolean
): NetworkState {
  return {
    ...state,
    nodes: state.nodes.map(n => (n.id === id ? { ...n, infected } : n)),
  };
}

export function toggleNodeInfected(state: NetworkState, id: number): NetworkState {
  return {
    ...state,
    nodes: state.nodes.map(n =>
      n.id === id ? { ...n, infected: !n.infected, protected: false } : n
    ),
  };
}

export function toggleNodeProtected(state: NetworkState, id: number): NetworkState {
  return {
    ...state,
    nodes: state.nodes.map(n =>
      n.id === id
        ? { ...n, protected: !n.protected, infected: n.protected ? n.infected : false }
        : n
    ),
  };
}

export function healAll(state: NetworkState): NetworkState {
  return {
    ...state,
    nodes: state.nodes.map(n => ({ ...n, infected: false })),
  };
}

/** Clear ALL state — healed, no firewalls. Useful for full reset. */
export function clearAll(state: NetworkState): NetworkState {
  return {
    ...state,
    nodes: state.nodes.map(n => ({ ...n, infected: false, protected: false })),
  };
}

/**
 * Infect a randomly-chosen "patient zero" — picks uniformly at random from
 * the set of healthy, non-protected nodes. Returns the new state and the
 * id of the node that was infected (or -1 if no eligible node exists).
 *
 * An optional `rand` function (returning [0, 1)) can be passed for testability;
 * defaults to Math.random.
 */
export function infectPatientZero(
  state: NetworkState,
  rand: () => number = Math.random
): {
  state: NetworkState;
  infectedId: number;
} {
  const candidates = state.nodes.filter(n => !n.infected && !n.protected);
  if (candidates.length === 0) return { state, infectedId: -1 };
  const target = candidates[Math.floor(rand() * candidates.length)];
  return {
    state: {
      ...state,
      nodes: state.nodes.map(n =>
        n.id === target.id ? { ...n, infected: true } : n
      ),
    },
    infectedId: target.id,
  };
}

export function infectionPercent(state: NetworkState): number {
  if (state.nodes.length === 0) return 0;
  const infected = state.nodes.filter(n => n.infected).length;
  return (infected / state.nodes.length) * 100;
}
