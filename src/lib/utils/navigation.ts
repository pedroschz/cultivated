import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * This module provides robust client-side navigation utilities for Next.js,
 * aiming to prevent race conditions and redundant navigations.
 */

// Global state to track if a navigation is currently in progress.
let isGloballyNavigating = false;
let navigationTimeout: NodeJS.Timeout | null = null;

/**
 * Safely navigates to a new path using the Next.js App Router.
 * It prevents navigation if already on the target page or if another navigation
 * is already in progress. Includes a fallback to `window.location.href`.
 *
 * @param router - The Next.js App Router instance.
 * @param targetPath - The path to navigate to.
 * @param currentPath - The current path of the application.
 * @param forceReload - Whether to force a full page reload (default: false).
 * @returns A promise that resolves to true if navigation was attempted, false otherwise.
 */
export const safeNavigate = async (
  router: AppRouterInstance, 
  targetPath: string,
  currentPath: string,
  forceReload: boolean = false
): Promise<boolean> => {
  if (currentPath === targetPath) {
    console.log('Navigation prevented: already on target page.', targetPath);
    return false;
  }

  if (isGloballyNavigating) {
    console.log('Navigation prevented: another navigation is in progress.');
    return false;
  }

  try {
    isGloballyNavigating = true;
    
    if (navigationTimeout) {
      clearTimeout(navigationTimeout);
    }

    console.log(`Navigating from ${currentPath} to ${targetPath} (forceReload: ${forceReload})`);
    
    if (forceReload) {
      window.location.href = targetPath;
      return true;
    }

    await router.push(targetPath);
    
    return true;
  } catch (error) {
    console.error('Navigation error, attempting fallback:', error);
    try {
      // Fallback to a hard navigation if router.push fails.
      window.location.href = targetPath;
      return true;
    } catch (fallbackError) {
      console.error('Fallback navigation failed:', fallbackError);
      return false;
    }
  } finally {
    // Reset the navigation lock after a delay to allow for transition completion.
    navigationTimeout = setTimeout(() => {
      isGloballyNavigating = false;
    }, 1000);
  }
};

/**
 * Creates a debounced version of the `safeNavigate` function.
 * This is useful for scenarios where navigation might be triggered rapidly,
 * such as in response to user input.
 *
 * @param router - The Next.js App Router instance.
 * @param delay - The debounce delay in milliseconds (default: 300).
 * @returns A debounced navigation function.
 */
export const createDebouncedNavigator = (
  router: AppRouterInstance,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (targetPath: string, currentPath: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      safeNavigate(router, targetPath, currentPath);
    }, delay);
  };
};

/**
 * Resets the global navigation lock. This can be useful for error recovery
 * or in specific UI scenarios where the lock needs to be manually cleared.
 */
export const resetNavigationState = () => {
  isGloballyNavigating = false;
  if (navigationTimeout) {
    clearTimeout(navigationTimeout);
    navigationTimeout = null;
  }
};
