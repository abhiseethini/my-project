/**
 * Item matching — compares lost vs found reports by category, keywords, color, location.
 */

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .split(/[\s,./\-_|]+/)
    .filter((w) => w.length > 1);
}

function overlapScore(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let matches = 0;
  setA.forEach((w) => {
    if (setB.has(w)) matches++;
  });
  return matches / Math.max(setA.size, setB.size);
}

function normalizeCategory(value) {
  return (value || '').toLowerCase().replace(/s$/, '').trim();
}

function categoriesMatch(a, b) {
  const na = normalizeCategory(a);
  const nb = normalizeCategory(b);
  return na && nb && (na === nb || na.includes(nb) || nb.includes(na));
}

export function computeMatchScore(lost, found) {
  let score = 0;

  if (categoriesMatch(lost.category, found.category)) score += 35;

  score += overlapScore(lost.itemName, found.itemName) * 30;
  score += overlapScore(lost.description, found.description) * 15;

  if (lost.color && found.color && lost.color.toLowerCase() === found.color.toLowerCase()) score += 15;

  if (lost.brand && found.brand && lost.brand.toLowerCase() === found.brand.toLowerCase()) score += 10;

  if (lost.location && found.location) {
    score += overlapScore(lost.location, found.location) * 15;
  }

  if (lost.marks && found.marks) {
    score += overlapScore(lost.marks, found.marks) * 10;
  }

  return Math.min(Math.round(score), 100);
}

export function findPossibleMatches(items, threshold = 35) {
  const lost = items.filter((i) => i.type === 'lost' && i.status === 'active');
  const found = items.filter((i) => i.type === 'found' && i.status === 'active');
  const matches = [];

  lost.forEach((l) => {
    found.forEach((f) => {
      const score = computeMatchScore(l, f);
      if (score >= threshold) {
        matches.push({ lost: l, found: f, score });
      }
    });
  });

  return matches.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function findMatchesForItem(item, allItems, threshold = 30) {
  const opposite = allItems.filter(
    (i) => i.type !== item.type && i.status === 'active' && i.id !== item.id
  );

  return opposite
    .map((other) => ({
      item: other,
      score: item.type === 'lost' ? computeMatchScore(item, other) : computeMatchScore(other, item),
    }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
