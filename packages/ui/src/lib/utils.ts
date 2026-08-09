import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanPhone(value: string): string {
  // Remove non-digits
  let cleaned = value.replace(/\D/g, "");
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");
  // Truncate to 11 characters
  return cleaned.slice(0, 11);
}

export function formatPhone(value: string): string {
  // Clean first to get raw digits
  const cleaned = value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
  if (!cleaned) return "";

  if (cleaned.length <= 2) {
    return `(${cleaned}`;
  }
  if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  }
  if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}
