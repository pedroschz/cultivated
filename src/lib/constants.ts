// SAT Domain and Subdomain Constants
export const DOMAIN_NAMES: { [key: string]: string } = {
  // Math domains
  '0': 'Algebra',
  '1': 'Problem Solving and Data Analysis',
  '2': 'Advanced Math',
  '3': 'Geometry and Trigonometry',
  // Reading & Writing domains
  '4': 'Information and Ideas',
  '5': 'Craft and Structure',
  '6': 'Expression of Ideas',
  '7': 'Standard English Conventions'
};

export const SUBDOMAIN_NAMES: { [key: string]: string } = {
  // Algebra
  '0': 'Solving linear equations and inequalities',
  '1': 'Linear equation word problems',
  '2': 'Linear relationship word problems',
  '3': 'Graphs of linear equations and functions',
  '4': 'Solving systems of linear equations',
  '5': 'Systems of linear equations word problems',
  '6': 'Linear inequality word problems',
  '7': 'Graphs of linear systems and inequalities',
  // Problem Solving and Data Analysis
  '8': 'Ratios, rates, and proportions',
  '9': 'Unit conversion',
  '10': 'Percentages',
  '11': 'Center, spread, and shape of distributions',
  '12': 'Data representations',
  '13': 'Scatterplots',
  '14': 'Linear and exponential growth',
  '15': 'Probability and relative frequency',
  '16': 'Data inferences',
  '17': 'Evaluating statistical claims',
  // Advanced Math
  '18': 'Factoring quadratic and polynomial expressions',
  '19': 'Radicals and rational exponents',
  '20': 'Operations with polynomials',
  '21': 'Operations with rational expressions',
  '22': 'Nonlinear functions',
  '23': 'Isolating quantities',
  '24': 'Solving quadratic equations',
  '25': 'Linear and quadratic systems',
  '26': 'Radical, rational, and absolute value equations',
  '27': 'Quadratic and exponential word problems',
  '28': 'Quadratic graphs',
  '29': 'Exponential graphs',
  '30': 'Polynomial and other nonlinear graphs',
  // Geometry and Trigonometry
  '31': 'Area and volume',
  '32': 'Congruence, similarity, and angle relationships',
  '33': 'Right triangle trigonometry',
  '34': 'Circle theorems',
  '35': 'Unit circle trigonometry',
  '36': 'Circle equations',
  // Information and Ideas
  '37': 'Command of Evidence',
  '38': 'Central Ideas and Details',
  '39': 'Inferences',
  // Craft and Structure
  '40': 'Words in Context',
  '41': 'Text Structure and Purpose',
  '42': 'Cross-Text Connections',
  // Expression of Ideas
  '43': 'Transitions: Foundation',
  '44': 'Rhetorical Synthesis: Foundations',
  // Standard English Conventions
  '45': 'Form, Structure, and Sense',
  '46': 'Boundaries'
};

// Practice Session Durations (in minutes)
export const PRACTICE_DURATIONS = [5, 10, 15, 20, 30, 60] as const;
export type PracticeSessionDuration = typeof PRACTICE_DURATIONS[number];

// Question Difficulty Levels
export const DIFFICULTY_LEVELS = {
  0: 'Easy',
  1: 'Medium', 
  2: 'Hard'
} as const;

// Subject Categories
export const SUBJECT_CATEGORIES = {
  MATH: 'Math',
  READING_WRITING: 'Reading & Writing'
} as const;

// Math domains (0-3)
export const MATH_DOMAINS = [0, 1, 2, 3];
// Reading & Writing domains (4-7)  
export const READING_WRITING_DOMAINS = [4, 5, 6, 7];

// Score ranges for performance categories
export const PERFORMANCE_CATEGORIES = {
  EXCELLENT: { min: 90, label: 'Excellent', color: 'text-green-600' },
  GOOD: { min: 75, label: 'Good', color: 'text-blue-600' },
  FAIR: { min: 60, label: 'Fair', color: 'text-yellow-600' },
  NEEDS_IMPROVEMENT: { min: 0, label: 'Needs Improvement', color: 'text-red-600' }
} as const;

// Chart colors for data visualization
export const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',
  secondary: 'hsl(var(--chart-2))',
  accent: 'hsl(var(--chart-3))',
  warning: 'hsl(var(--chart-4))',
  destructive: 'hsl(var(--chart-5))'
} as const;

// Animation durations
export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500
} as const;

// Breakpoints for responsive design
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;

// Common spacing values
export const SPACING = {
  xs: '0.25rem',
  sm: '0.5rem', 
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem'
} as const; 