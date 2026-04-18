/**
 * This module provides a mapping between human-readable domain names and their
 * corresponding numeric IDs, as well as helper functions to convert between them.
 */

/**
 * A constant object that maps domain names to their unique numeric IDs.
 */
export const DOMAIN_MAPPING = {
  // Math domains
  "Algebra": 0,
  "Problem-Solving and Data Analysis": 1,
  "Advanced Math": 2,
  "Geometry and Trigonometry": 3,
  
  // Reading & Writing domains
  "Information and Ideas": 4,
  "Craft and Structure": 5,
  "Expression of Ideas": 6,
  "Standard English Conventions": 7
} as const;

/**
 * A reverse mapping from domain IDs back to their names.
 * This is generated automatically from the `DOMAIN_MAPPING` object.
 */
export const REVERSE_DOMAIN_MAPPING = Object.fromEntries(
  Object.entries(DOMAIN_MAPPING).map(([name, id]) => [id, name])
);

/**
 * Retrieves the numeric ID for a given domain name.
 * @param domainName - The name of the domain.
 * @returns The corresponding domain ID, or 0 as a default.
 */
export function getDomainId(domainName: string): number {
  return DOMAIN_MAPPING[domainName as keyof typeof DOMAIN_MAPPING] ?? 0;
}

/**
 * Retrieves the name for a given domain ID.
 * @param domainId - The numeric ID of the domain.
 * @returns The corresponding domain name, or "Unknown" if not found.
 */
export function getDomainName(domainId: number): string {
  return REVERSE_DOMAIN_MAPPING[domainId] ?? "Unknown";
}
