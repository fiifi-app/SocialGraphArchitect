/**
 * Format a number as compact currency (e.g., $250k, $2M, $1.5B)
 */
export function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    const billions = absValue / 1_000_000_000;
    return `${sign}$${billions % 1 === 0 ? billions : billions.toFixed(1)}B`;
  } else if (absValue >= 1_000_000) {
    const millions = absValue / 1_000_000;
    return `${sign}$${millions % 1 === 0 ? millions : millions.toFixed(1)}M`;
  } else if (absValue >= 1_000) {
    const thousands = absValue / 1_000;
    return `${sign}$${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`;
  } else {
    return `${sign}$${absValue}`;
  }
}

/**
 * Format a check size range (e.g., "$250k–$2M")
 */
export function formatCheckSizeRange(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (!min && !max) {
    return '';
  }

  if (min && max) {
    return `${formatCompactCurrency(min)}–${formatCompactCurrency(max)}`;
  }

  if (min) {
    return `${formatCompactCurrency(min)}+`;
  }

  if (max) {
    return `up to ${formatCompactCurrency(max)}`;
  }

  return '';
}

/**
 * Parse compact currency string back to number (e.g., "250k" -> 250000)
 */
export function parseCompactCurrency(value: string): number | null {
  if (!value) return null;

  const cleaned = value.replace(/[$,\s]/g, '');
  const match = cleaned.match(/^(\d+\.?\d*)([kKmMbB])?$/);

  if (!match) return null;

  const num = parseFloat(match[1]);
  const suffix = match[2]?.toLowerCase();

  switch (suffix) {
    case 'k':
      return num * 1_000;
    case 'm':
      return num * 1_000_000;
    case 'b':
      return num * 1_000_000_000;
    default:
      return num;
  }
}
