"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * @file This component provides error boundary functionality specifically for
 * navigation-related errors. It catches JavaScript errors in the component tree
 * and displays a user-friendly error UI with recovery options.
 */

/**
 * Represents the state of the NavigationErrorBoundary component.
 */
interface NavigationErrorBoundaryState {
  /** Whether an error has been caught. */
  hasError: boolean;
  /** The error object that was caught, if any. */
  error?: Error;
}

/**
 * A React error boundary component that catches navigation-related errors
 * and provides a user-friendly error recovery interface.
 * 
 * This component extends React.Component and implements the error boundary
 * lifecycle methods to catch errors in its child components.
 */
export class NavigationErrorBoundary extends React.Component<
  React.PropsWithChildren<object>,
  NavigationErrorBoundaryState
> {
  /**
   * Constructor initializes the component state.
   * @param props - The component props.
   */
  constructor(props: React.PropsWithChildren<object>) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Static method called when an error is thrown in a child component.
   * Updates the component state to indicate an error has occurred.
   * 
   * @param error - The error that was thrown.
   * @returns The new state object indicating an error has occurred.
   */
  static getDerivedStateFromError(error: Error): NavigationErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Lifecycle method called when an error is caught.
   * Logs the error details for debugging purposes.
   * 
   * @param error - The error that was thrown.
   * @param errorInfo - Additional error information from React.
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Navigation error caught by boundary:', error, errorInfo);
  }

  /**
   * Handles the reset action when the user clicks the recovery button.
   * Clears the error state and navigates to the dashboard.
   */
  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    // Try to navigate to dashboard safely
    window.location.href = '/dashboard';
  };

  /**
   * Renders either the error UI or the child components.
   * 
   * @returns A React element - either the error UI or the children.
   */
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              {/* Error icon */}
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Navigation Error</CardTitle>
              <CardDescription>
                Something went wrong while navigating. This might be a temporary issue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details display */}
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <p className="font-medium mb-1">Error details:</p>
                <p className="font-mono text-xs break-all">
                  {this.state.error?.message || 'Unknown navigation error'}
                </p>
              </div>
              
              {/* Recovery action buttons */}
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleReset} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Return to Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()} 
                  className="w-full"
                >
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Render children normally when no error has occurred
    return this.props.children;
  }
} 