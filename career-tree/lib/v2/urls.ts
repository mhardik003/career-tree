export function splitNodeId(id: string): { type: string; slug: string } {
  const separator = id.indexOf(":");
  if (separator <= 0 || separator === id.length - 1) {
    throw new Error(`Invalid v2 node id: ${id}`);
  }
  return { type: id.slice(0, separator), slug: id.slice(separator + 1) };
}

export function nodeHref(id: string, fromId?: string): string {
  const { type, slug } = splitNodeId(id);
  const base = `/careers/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`;
  return fromId ? `${base}?from=${encodeURIComponent(fromId)}` : base;
}

export function exploreHref(id: string, fromId?: string): string {
  const { type, slug } = splitNodeId(id);
  const base = `/explore/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`;
  return fromId ? `${base}?from=${encodeURIComponent(fromId)}` : base;
}
