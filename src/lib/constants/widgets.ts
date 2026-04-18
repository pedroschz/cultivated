import { BentoItem } from '@/components/dashboard/BentoGrid';

export const DEFAULT_COLS = 8;
/**
 * GRID_SCALE: Multiplier to convert logical units to grid units.
 * 
 * IMPORTANT: All widget sizes stored in DashboardWidget (widget.w, widget.h) are in GRID UNITS.
 * 
 * Conversion:
 * - Logical 1x1 = Grid 2x2 (SMALLEST possible size)
 * - Logical 2x2 = Grid 4x4
 * - Logical 2x4 = Grid 4x8
 * 
 * When checking widget sizes, remember:
 * - widget.w === 2 && widget.h === 2 = SMALLEST size (1x1 logical)
 * - widget.w === 4 && widget.h === 4 = medium size (2x2 logical)
 * - widget.w === 2 && widget.h === 4 = narrow tall (1x2 logical)
 */
export const GRID_SCALE = 2;

export type WidgetType =
  | 'practice'
  | 'streak'
  | 'leaderboard'
  | 'friendsActivity'
  | 'myTutor'
  | 'stickyNote'
  | 'masteryProgress'
  | 'skillMastery'
  | 'strengthsWeaknesses'
  | 'assignments'
  | 'statAccuracy'
  | 'statStudyTime'
  | 'statQuestions'
  | 'statPoints'
  | 'statProjectedScore';

export interface DashboardWidget extends BentoItem {
  type: WidgetType;
  config?: Record<string, any>;
  locked?: boolean;
}

export interface WidgetDefinition {
  title: string;
  description: string;
  // NOTE: These are LOGICAL units, not grid units!
  // They get multiplied by GRID_SCALE when creating actual widgets.
  // Example: defaultW: 2 means logical 2, which becomes grid 4 (2 * GRID_SCALE)
  defaultW: number; // Logical width (1 unit = 1 column in default 3-col layout, but grid is 6-col so scale=2)
  defaultH: number; // Logical height
  minW: number; // Logical minimum width (becomes grid minW * GRID_SCALE)
  minH: number; // Logical minimum height (becomes grid minH * GRID_SCALE)
  maxW: number; // Logical maximum width (becomes grid maxW * GRID_SCALE)
  maxH: number; // Logical maximum height (becomes grid maxH * GRID_SCALE)
  mandatory?: boolean;
  defaultConfig?: Record<string, any>;
}

export const WIDGET_DEFINITIONS: Record<WidgetType, WidgetDefinition> = {
  practice: {
    title: 'Quick Practice',
    description: 'Jump into a focused session.',
    defaultW: 3,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 6,
    maxH: 3,
    mandatory: false,
  },
  streak: {
    title: 'Streak',
    description: 'Momentum and consistency snapshot.',
    defaultW: 3,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 6,
    maxH: 3,
  },
  leaderboard: {
    title: 'Leaderboard',
    description: 'See where you rank.',
    defaultW: 2,
    defaultH: 3,
    minW: 1,
    minH: 1,
    maxW: 6,
    maxH: 4,
    defaultConfig: { scope: 'global' },
  },
  friendsActivity: {
    title: 'Friends Activity',
    description: 'Keep tabs on your circle.',
    defaultW: 2,
    defaultH: 3,
    minW: 1,
    minH: 1,
    maxW: 6,
    maxH: 4,
  },
  myTutor: {
    title: 'My Tutor',
    description: 'Jump back into a tutoring session.',
    defaultW: 3,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 4,
    maxH: 3,
  },
  stickyNote: {
    title: 'Sticky Note',
    description: 'A space for quotes, goals, and reminders.',
    defaultW: 3,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 6,
    maxH: 3,
    defaultConfig: { 
      note: '',
      fontSize: 16,
    },
  },
  masteryProgress: {
    title: 'Mastery Progress',
    description: 'Your mastery trend over the last week.',
    defaultW: 4,
    defaultH: 3,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
  },
  skillMastery: {
    title: 'Skill Mastery',
    description: 'Deep dive into your domain progress.',
    defaultW: 4,
    defaultH: 3,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 5,
  },
  strengthsWeaknesses: {
    title: 'Strengths & Focus Areas',
    description: 'Where you shine and where to focus next.',
    defaultW: 4,
    defaultH: 2,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 3,
  },
  assignments: {
    title: 'School Assignments',
    description: 'Progress on assigned practice goals.',
    defaultW: 4,
    defaultH: 3,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
  },
  statAccuracy: {
    title: 'Accuracy',
    description: 'Recent answer accuracy.',
    defaultW: 2,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 2,
  },
  statStudyTime: {
    title: 'Study Time',
    description: 'Total study minutes.',
    defaultW: 2,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 2,
  },
  statQuestions: {
    title: 'Questions',
    description: 'Total questions answered.',
    defaultW: 2,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 2,
  },
  statPoints: {
    title: 'Point Boost',
    description: 'Estimated SAT points gained.',
    defaultW: 2,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 2,
  },
  statProjectedScore: {
    title: 'Projected Score',
    description: 'Baseline plus growth.',
    defaultW: 2,
    defaultH: 2,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 2,
  },
};

/**
 * NEW: Determines widget layout category based on size.
 * 
 * IMPORTANT: item.w and item.h are in GRID UNITS.
 * 
 * Categories:
 * - 'minimal': 2x2 grid units (SMALLEST size)
 * - 'minimal-vertical': width = 2, height > 2 (2x3, 2x4, 2x5, etc.)
 * - 'minimal-horizontal': height = 2, width > 2 (3x2, 4x2, 5x2, etc.)
 * - 'regular': everything else
 * 
 * Examples:
 * - widget.w=2, widget.h=2 → 'minimal' (SMALLEST size)
 * - widget.w=2, widget.h=4 → 'minimal-vertical' (narrow but tall)
 * - widget.w=4, widget.h=2 → 'minimal-horizontal' (wide but short)
 * - widget.w=4, widget.h=4 → 'regular' (square, medium)
 * - widget.w=6, widget.h=6 → 'regular' (large square)
 */
export type WidgetLayoutCategory = 'minimal' | 'minimal-vertical' | 'minimal-horizontal' | 'regular';

export const getWidgetLayoutCategory = (item: DashboardWidget): WidgetLayoutCategory => {
  // All checks are in GRID UNITS
  // Minimal: 2x2 or smaller (1x1, 1x2, 2x1, 2x2)
  if ((item.w === 2 && item.h === 2) || (item.w === 1 && item.h === 2) || (item.w === 2 && item.h === 1) || (item.w === 1 && item.h === 1)) {
    return 'minimal'; // SMALLEST size
  }
  if (item.w === 2 && item.h > 2) {
    return 'minimal-vertical'; // Narrow but tall (2x3, 2x4, 2x5, etc.)
  }
  if (item.h === 2 && item.w > 2) {
    return 'minimal-horizontal'; // Wide but short (3x2, 4x2, 5x2, etc.)
  }
  return 'regular'; // Everything else
};

/**
 * @deprecated Use getWidgetLayoutCategory instead. This is kept for backward compatibility.
 * 
 * Determines widget variant based on size.
 * 
 * IMPORTANT: item.w and item.h are in GRID UNITS, so we divide by GRID_SCALE to get logical units.
 * 
 * Variant thresholds (in LOGICAL units):
 * - large: logical width >= 4 OR logical height >= 3
 *   (grid width >= 8 OR grid height >= 6)
 * - medium: logical width >= 3 OR logical height >= 2
 *   (grid width >= 6 OR grid height >= 4)
 * - small: everything else
 *   (grid width < 6 AND grid height < 4)
 * 
 * Examples:
 * - widget.w=2, widget.h=2 → logical 1x1 → 'small' (SMALLEST size)
 * - widget.w=4, widget.h=4 → logical 2x2 → 'medium'
 * - widget.w=6, widget.h=4 → logical 3x2 → 'medium'
 * - widget.w=8, widget.h=6 → logical 4x3 → 'large'
 */
export const getWidgetVariant = (item: DashboardWidget) => {
  // Convert grid units to logical units
  const scaledW = item.w / GRID_SCALE;
  const scaledH = item.h / GRID_SCALE;
  if (scaledW >= 4 || scaledH >= 3) return 'large';
  if (scaledW >= 3 || scaledH >= 2) return 'medium';
  return 'small';
};
