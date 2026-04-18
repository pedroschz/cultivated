/**
 * This file contains shared constants used throughout the application,
 * covering everything from educational domains to UI styles.
 */

/** Mapping of domain IDs to their human-readable names. */
export const DOMAIN_NAMES: { [key: string]: string } = {
  '0': 'Algebra',
  '1': 'Advanced Math',
  '2': 'Problem-Solving and Data Analysis',
  '3': 'Geometry and Trigonometry',
  '4': 'Information and Ideas',
  '5': 'Craft and Structure',
  '6': 'Expression of Ideas',
  '7': 'Standard English Conventions'
};

// Note: SUBDOMAIN_NAMES has been deprecated in favor of the more flexible
// skill mapping system located at: src/lib/adaptive-learning/skill-mapping.ts

/** The allowed durations for a practice session, in minutes. */
export const PRACTICE_DURATIONS = [5, 10, 15, 20, 30, 60] as const;
export type PracticeSessionDuration = typeof PRACTICE_DURATIONS[number];

/** Mapping of difficulty level IDs to their names. */
export const DIFFICULTY_LEVELS = {
  0: 'Easy',
  1: 'Medium', 
  2: 'Hard'
} as const;

/** The main subject categories. */
export const SUBJECT_CATEGORIES = {
  MATH: 'Math',
  READING_WRITING: 'Reading & Writing'
} as const;

/** An array of domain IDs that belong to the Math category. */
export const MATH_DOMAINS = [0, 1, 2, 3];
/** An array of domain IDs that belong to the Reading & Writing category. */
export const READING_WRITING_DOMAINS = [4, 5, 6, 7];

/** Defines score ranges and labels for different performance levels. */
export const PERFORMANCE_CATEGORIES = {
  EXCELLENT: { min: 90, label: 'Excellent', color: 'text-green-600' },
  GOOD: { min: 75, label: 'Good', color: 'text-blue-600' },
  FAIR: { min: 60, label: 'Fair', color: 'text-yellow-600' }
} as const;

/** Standard color palette for data visualizations and charts. */
export const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',
  secondary: 'hsl(var(--chart-2))',
  accent: 'hsl(var(--chart-3))',
  warning: 'hsl(var(--chart-4))',
  destructive: 'hsl(var(--chart-5))'
} as const;

/** Standard durations for UI animations, in milliseconds. */
export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500
} as const;

/** Standard breakpoints for responsive design, in pixels. */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;

/** Common spacing values used for layout and components. */
export const SPACING = {
  xs: '0.25rem',
  sm: '0.5rem', 
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem'
} as const;
