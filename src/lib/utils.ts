import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely convert a value to a Date object.
 * Handles Date prototype loss from Zustand persist (JSON serialization
 * turns Date objects into ISO strings).
 */
export function safeDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}
