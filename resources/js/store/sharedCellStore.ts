import { createCellStore, type SubscribableCellStore } from './cells';

/**
 * App-wide singleton cell store. `useReview` seeds it from the loaded review's
 * `cells`; the grid (M4) and footer read from it; SSE events (M4) write to it.
 */
export const sharedCellStore: SubscribableCellStore = createCellStore();
