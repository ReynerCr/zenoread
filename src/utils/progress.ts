/**
 * 0-100 completion of a whole document at a given reading position.
 * Page-based: fully read sections plus the fraction of the current section,
 * so a position right after a page turn equals pages read / total pages.
 * Caps at 100 for the last block of the last section.
 */
export function completionPercentage(
  sectionIndex: number,
  blockIndex: number,
  sectionCount: number,
  blocksInSection: number,
): number {
  if (sectionCount <= 0 || blocksInSection <= 0) return 0;
  const clampedBlock = Math.max(0, Math.min(blockIndex, blocksInSection - 1));
  const isLastBlockOfLastSection =
    sectionIndex === sectionCount - 1 && clampedBlock === blocksInSection - 1;
  if (isLastBlockOfLastSection) return 100;
  return Math.round(((sectionIndex + clampedBlock / blocksInSection) / sectionCount) * 100);
}
