import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes intelligently.
 * Use this anywhere you conditionally combine classNames.
 *
 * Example:
 *   cn('px-4 py-2', isActive && 'bg-primary', 'hover:bg-primary-600')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
