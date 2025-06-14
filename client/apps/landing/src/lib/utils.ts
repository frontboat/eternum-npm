import { divideByPrecision } from "@frontboat/eternum";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatNumber = (num: number, decimals: number): string => {
  return num.toFixed(decimals).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
};

export const currencyFormat = (num: number, decimals: number): string => {
  return formatNumber(divideByPrecision(num), decimals);
};

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  // If the string is short enough, don't shorten it
  if (string.length <= 10) {
    return string;
  }
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export const trimAddress = (addr?: string): string => {
  if (!addr || !addr.startsWith("0x")) return addr || "";
  return "0x" + addr.slice(2).replace(/^0+/, "");
};

// Format relative time (e.g. "5 minutes ago", "2 hours ago", etc.)
export function formatRelativeTime(timestamp: number | string | null | undefined): string {
  if (!timestamp) return "N/A";

  // Convert to date objects for both timestamps
  const date = new Date(timestamp);
  const now = new Date();

  // Calculate time difference in milliseconds
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
