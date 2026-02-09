type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | ClassValue[];

/**
 * Merges class names. Pass base classes first, then optional `className` to extend.
 * Usage: cn("base classes", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter((x) => typeof x === "string" && x.length > 0)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");
}
