// GuestRouter.ts — small BFS over walkable tiles for the visible guest layer.
//
// Strict scope: this is *not* a general pathfinding framework. It serves the
// visible guest sprites only — guests use the returned waypoints to walk the
// floor tile-by-tile rather than drift directly toward their destination
// through blocked space.
//
// 4-connected. Returns a list of tile-centre waypoints from the start tile
// (inclusive) to the target tile (inclusive), or null if no path exists.
// Including the start tile centre lets a re-routing guest snap back to grid
// before continuing orthogonally between tile centres.
import * as GC from '../logic/GameConstants';
import { isWalkable } from '../logic/PlacementValidator';

export function findRoute(
  tiles: GC.Tile[],
  startCol: number, startRow: number,
  targetCol: number, targetRow: number,
): GC.Vec2[] | null {
  const sc = Math.floor(startCol);
  const sr = Math.floor(startRow);
  const tc = Math.floor(targetCol);
  const tr = Math.floor(targetRow);

  if (sc < 0 || sc >= GC.GRID_COLS || sr < 0 || sr >= GC.GRID_ROWS) return null;
  if (tc < 0 || tc >= GC.GRID_COLS || tr < 0 || tr >= GC.GRID_ROWS) return null;
  if (!isWalkable(tiles, tc, tr)) return null;

  const W = GC.GRID_COLS;
  const startIdx  = sr * W + sc;
  const targetIdx = tr * W + tc;
  if (startIdx === targetIdx) return [{ x: tc + 0.5, y: tr + 0.5 }];

  // We don't require the start tile to be walkable. A guest may be standing
  // on a tile that just got built over; BFS only refuses to *enter* a
  // non-walkable tile, so the search still escapes a freshly-blocked spot
  // when any walkable neighbour exists.
  const H       = GC.GRID_ROWS;
  const visited = new Uint8Array(W * H);
  const parent  = new Int32Array(W * H);
  parent.fill(-1);

  // Per-call shuffled neighbour order. Different guests sharing the same
  // start/target then trace different (still optimal) paths instead of all
  // following the same robot-like L.
  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }

  const queue: number[] = [startIdx];
  visited[startIdx] = 1;
  let head  = 0;
  let found = false;
  while (head < queue.length) {
    const idx = queue[head++];
    if (idx === targetIdx) { found = true; break; }
    const cy = (idx / W) | 0;
    const cx = idx - cy * W;
    for (const [ddx, ddy] of dirs) {
      const nx = cx + ddx;
      const ny = cy + ddy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const nIdx = ny * W + nx;
      if (visited[nIdx]) continue;
      if (!isWalkable(tiles, nx, ny)) continue;
      visited[nIdx] = 1;
      parent[nIdx]  = idx;
      queue.push(nIdx);
    }
  }
  if (!found) return null;

  // Reconstruct target → start, then reverse so path[0] is the start tile
  // centre and path[last] is the target tile centre.
  const path: GC.Vec2[] = [];
  let cur = targetIdx;
  while (cur !== -1) {
    const cy = (cur / W) | 0;
    const cx = cur - cy * W;
    path.push({ x: cx + 0.5, y: cy + 0.5 });
    if (cur === startIdx) break;
    cur = parent[cur];
  }
  path.reverse();
  return path;
}
