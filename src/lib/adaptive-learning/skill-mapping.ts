/**
 * This file defines the mapping between specific skills and broader educational domains.
 * It serves as a central source of truth for all skill-related information,
 * including their names, associated domains, and legacy subdomain IDs for
 * backward compatibility with the adaptive learning engine.
 */

export interface SkillMapping {
  skill: string;
  domain: number;
  domainName: string;
  subdomainId: string; // Used for backward compatibility with the adaptive learning engine
}

// All skills related to the Math section
export const MATH_SKILLS: SkillMapping[] = [
  // Algebra (Domain 0)
  { skill: 'Linear equations in one variable', domain: 0, domainName: 'Algebra', subdomainId: '0' },
  { skill: 'Linear equations in two variables', domain: 0, domainName: 'Algebra', subdomainId: '1' },
  { skill: 'Linear functions', domain: 0, domainName: 'Algebra', subdomainId: '2' },
  { skill: 'Systems of two linear equations in two variables', domain: 0, domainName: 'Algebra', subdomainId: '3' },
  { skill: 'Linear inequalities in one or two variables', domain: 0, domainName: 'Algebra', subdomainId: '4' },

  // Advanced Math (Domain 1)
  { skill: 'Equivalent expressions', domain: 1, domainName: 'Advanced Math', subdomainId: '5' },
  { skill: 'Nonlinear equations in one variable and systems of equations in two variables', domain: 1, domainName: 'Advanced Math', subdomainId: '6' },
  { skill: 'Nonlinear functions', domain: 1, domainName: 'Advanced Math', subdomainId: '7' },

  // Problem-Solving and Data Analysis (Domain 2)
  { skill: 'Ratios, rates, proportional relationships, and units', domain: 2, domainName: 'Problem-Solving and Data Analysis', subdomainId: '8' },
  { skill: 'One-variable data: Distributions and measures of center and spread', domain: 2, domainName: 'Problem-Solving and Data Analysis', subdomainId: '9' },
  { skill: 'Two-variable data: Models and scatterplots', domain: 2, domainName: 'Problem-Solving and Data Analysis', subdomainId: '10' },
  { skill: 'Percentages', domain: 2, domainName: 'Problem-Solving and Data Analysis', subdomainId: '11' },
  { skill: 'Probability and conditional probability', domain: 2, domainName: 'Problem-Solving and Data Analysis', subdomainId: '12' },
  { skill: 'Inference from sample statistics and margin of error', domain: 2, domainName: 'Problem-Solving and Data Analysis', subdomainId: '13' },
  { skill: 'Evaluating statistical claims: Observational studies and experiments', domain: 2, domainName: 'Problem-Solving and Data Analysis', subdomainId: '14' },

  // Geometry and Trigonometry (Domain 3)
  { skill: 'Area and volume', domain: 3, domainName: 'Geometry and Trigonometry', subdomainId: '15' },
  { skill: 'Lines, angles, and triangles', domain: 3, domainName: 'Geometry and Trigonometry', subdomainId: '16' },
  { skill: 'Circles', domain: 3, domainName: 'Geometry and Trigonometry', subdomainId: '17' },
  { skill: 'Right triangles and trigonometry', domain: 3, domainName: 'Geometry and Trigonometry', subdomainId: '18' },
];

// All skills related to the Reading and Writing section
export const READING_WRITING_SKILLS: SkillMapping[] = [
  // Information and Ideas (Domain 4)
  { skill: 'Central Ideas and Details', domain: 4, domainName: 'Information and Ideas', subdomainId: '19' },
  { skill: 'Command of Evidence', domain: 4, domainName: 'Information and Ideas', subdomainId: '20' },
  { skill: 'Inferences', domain: 4, domainName: 'Information and Ideas', subdomainId: '21' },

  // Craft and Structure (Domain 5)
  { skill: 'Words in Context', domain: 5, domainName: 'Craft and Structure', subdomainId: '22' },
  { skill: 'Text Structure and Purpose', domain: 5, domainName: 'Craft and Structure', subdomainId: '23' },
  { skill: 'Cross-Text Connections', domain: 5, domainName: 'Craft and Structure', subdomainId: '24' },

  // Expression of Ideas (Domain 6)
  { skill: 'Rhetorical Synthesis', domain: 6, domainName: 'Expression of Ideas', subdomainId: '25' },
  { skill: 'Transitions', domain: 6, domainName: 'Expression of Ideas', subdomainId: '26' },

  // Standard English Conventions (Domain 7)
  { skill: 'Boundaries', domain: 7, domainName: 'Standard English Conventions', subdomainId: '27' },
  { skill: 'Form, Structure, and Sense', domain: 7, domainName: 'Standard English Conventions', subdomainId: '28' },
];

/** A comprehensive array containing all skills from all sections. */
export const ALL_SKILLS = [...MATH_SKILLS, ...READING_WRITING_SKILLS];

/** Provides descriptive information for each domain. */
export const DOMAIN_INFO = {
  0: { name: 'Algebra', description: 'Linear equations, inequalities, and functions' },
  1: { name: 'Advanced Math', description: 'Nonlinear equations, functions, and expressions' },
  2: { name: 'Problem-Solving and Data Analysis', description: 'Ratios, data analysis, probability, and statistics' },
  3: { name: 'Geometry and Trigonometry', description: 'Area, volume, angles, triangles, and circles' },
  4: { name: 'Information and Ideas', description: 'Central ideas, evidence, and inferences' },
  5: { name: 'Craft and Structure', description: 'Words in context, text structure, and cross-text connections' },
  6: { name: 'Expression of Ideas', description: 'Rhetorical synthesis and transitions' },
  7: { name: 'Standard English Conventions', description: 'Sentence boundaries, form, structure, and sense' },
};

/**
 * Unified SkillService that provides O(1) lookups for skills, subdomain IDs, and domains.
 * This centralizes all skill-related utilities and avoids repeated O(n) scans.
 */
export const SkillService = (() => {
  // Precomputed lookup maps
  const skillNameToMapping = new Map<string, SkillMapping>();
  const subdomainIdToMapping = new Map<string, SkillMapping>();
  const domainToSkills = new Map<number, SkillMapping[]>();

  for (const mapping of ALL_SKILLS) {
    skillNameToMapping.set(mapping.skill, mapping);
    subdomainIdToMapping.set(String(mapping.subdomainId), mapping);
    const list = domainToSkills.get(mapping.domain) || [];
    list.push(mapping);
    domainToSkills.set(mapping.domain, list);
  }

  return {
    getBySkillName(skillName: string): SkillMapping | null {
      return skillNameToMapping.get(skillName) || null;
    },
    getBySubdomainId(subdomainId: string | number): SkillMapping | null {
      return subdomainIdToMapping.get(String(subdomainId)) || null;
    },
    getSubdomainIdBySkillName(skillName: string): string | null {
      const mapping = skillNameToMapping.get(skillName);
      return mapping ? mapping.subdomainId : null;
    },
    getDomainForSkill(skillName: string): number | null {
      const mapping = skillNameToMapping.get(skillName);
      return mapping ? mapping.domain : null;
    },
    getSkillsForDomain(domainId: number): SkillMapping[] {
      return domainToSkills.get(domainId) ? [...(domainToSkills.get(domainId) as SkillMapping[])] : [];
    },
    getDomainName(domainId: number): string {
      return DOMAIN_INFO[domainId as keyof typeof DOMAIN_INFO]?.name || `Domain ${domainId}`;
    },
    // Expose read-only copies of maps if needed elsewhere
    _maps: {
      skillNameToMapping,
      subdomainIdToMapping,
      domainToSkills,
    }
  } as const;
})();

/**
 * Retrieves the complete skill mapping object for a given skill name.
 * @param skillName - The name of the skill to look up.
 * @returns The corresponding SkillMapping object, or null if not found.
 */
export function getSkillMapping(skillName: string): SkillMapping | null {
  return SkillService.getBySkillName(skillName);
}

/**
 * Gets the legacy subdomain ID for a given skill name.
 * @param skillName - The name of the skill.
 * @returns The subdomain ID as a string, or null if not found.
 */
export function getSubdomainId(skillName: string): string | null {
  return SkillService.getSubdomainIdBySkillName(skillName);
}

/**
* Retrieves the domain number for a given skill name.
* @param skillName - The name of the skill.
* @returns The domain number, or null if not found.
*/
export function getDomainForSkill(skillName: string): number | null {
  return SkillService.getDomainForSkill(skillName);
}

/**
 * Gets the name of a domain from its ID.
 * @param domainId - The ID of the domain.
 * @returns The name of the domain.
 */
export function getDomainName(domainId: number): string {
  return SkillService.getDomainName(domainId);
}

/**
 * Retrieves all skills that belong to a specific domain.
 * @param domainId - The ID of the domain.
 * @returns An array of SkillMapping objects for that domain.
 */
export function getSkillsForDomain(domainId: number): SkillMapping[] {
  return SkillService.getSkillsForDomain(domainId);
}

/**
 * Defines the range of legacy subdomain IDs that fall into each domain.
 * This is crucial for backward compatibility with older data and the scoring engine.
 */
export const DOMAIN_RANGES = {
  '0': [0, 4],   // Algebra
  '1': [5, 7],   // Advanced Math
  '2': [8, 14],  // Problem-Solving and Data Analysis
  '3': [15, 18], // Geometry and Trigonometry
  '4': [19, 21], // Information and Ideas
  '5': [22, 23], // Craft and Structure
  '6': [24, 25], // Expression of Ideas
  '7': [26, 28], // Standard English Conventions
};
