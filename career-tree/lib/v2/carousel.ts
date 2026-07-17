export interface CarouselItem {
  id: string;
  offset: number;
}

function modulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

export function moveSelection(
  ids: string[],
  selectedId: string,
  delta: number,
): string | null {
  if (!ids.length) return null;
  const selectedIndex = Math.max(0, ids.indexOf(selectedId));
  return ids[modulo(selectedIndex + delta, ids.length)];
}

export function carouselWindow(
  ids: string[],
  selectedId: string,
  visibleCount: 1 | 3 | 5,
): CarouselItem[] {
  if (!ids.length) return [];
  const selectedIndex = Math.max(0, ids.indexOf(selectedId));
  const radius = Math.floor(visibleCount / 2);
  const offsets =
    ids.length >= visibleCount
      ? Array.from({ length: visibleCount }, (_, index) => index - radius)
      : Array.from(
          { length: ids.length },
          (_, index) => index - Math.floor((ids.length - 1) / 2),
        );
  const used = new Set<string>();
  return offsets.flatMap((offset) => {
    const id = ids[modulo(selectedIndex + offset, ids.length)];
    if (used.has(id)) return [];
    used.add(id);
    return [{ id, offset }];
  });
}
