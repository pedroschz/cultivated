"use client";

/**
 * WIDGET SIZING SYSTEM - IMPORTANT:
 * 
 * All widget sizes (widget.w, widget.h) are in GRID UNITS, not logical units.
 * 
 * GRID_SCALE = 2, meaning:
 * - Logical 1x1 = Grid 2x2 (SMALLEST possible size)
 * - Logical 2x2 = Grid 4x4
 * - Logical 2x4 = Grid 4x8
 * 
 * NEW LAYOUT CATEGORY SYSTEM (use getWidgetLayoutCategory):
 * - 'minimal': 2x2 grid units (SMALLEST size)
 * - 'minimal-vertical': width = 2, height > 2 (2x3, 2x4, 2x5, etc.)
 * - 'minimal-horizontal': height = 2, width > 2 (3x2, 4x2, 5x2, etc.)
 * - 'regular': everything else
 * 
 * Size Reference:
 * - 2x2 grid units = 'minimal' (1x1 logical) - this is the minimum
 * - 2x4 grid units = 'minimal-vertical' (1x2 logical, narrow but taller)
 * - 4x2 grid units = 'minimal-horizontal' (2x1 logical, wide but short)
 * - 4x4 grid units = 'regular' (2x2 logical, square, medium)
 * - 6x6 grid units = 'regular' (3x3 logical, large square)
 * 
 * When checking sizes:
 * - widget.w === 2 && widget.h === 2 = 'minimal' (SMALLEST)
 * - widget.w === 2 && widget.h === 4 = 'minimal-vertical' (narrow tall)
 * - widget.w === 4 && widget.h === 2 = 'minimal-horizontal' (wide short)
 * - widget.w === 4 && widget.h === 4 = 'regular' (medium square)
 * 
 * @deprecated getWidgetVariant() is kept for backward compatibility but use getWidgetLayoutCategory() instead.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardContent,
  Progress,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components';
import { 
  Users,
  Trophy,
  MessageSquareQuote,
  Sparkles,
  Flame,
  BookOpenCheck,
  BarChart3,
  ExternalLink,
  Bold,
  Italic,
  Type
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkillMastery } from '@/components/SkillMastery';
import { HistoricalMasteryCard } from '@/components';
import { ConsistencyMap } from '@/components/dashboard/ConsistencyMap';
import { PracticeWidget } from '@/components/dashboard/PracticeWidget';
import { CustomAvatar } from '@/components/ui/custom-avatar';
import { getInitials } from '@/lib/constants/avatar';
import { 
  DashboardWidget, 
  WIDGET_DEFINITIONS, 
  WidgetType,
  GRID_SCALE,
  getWidgetVariant,
  getWidgetLayoutCategory,
  WidgetLayoutCategory
} from '@/lib/constants/widgets';
import { 
  mockConsistencyDays, 
  mockHistoricalData, 
  mockUserStats, 
  mockLeaderboardEntries, 
  mockFriendsActivity, 
  mockAssignments,
  mockSkillMasteryData
} from './mock-data';

interface WidgetRendererProps {
  widget: DashboardWidget;
  isEditing?: boolean;
}

const formatLastActive = (timestamp?: number) => {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  // If less than 2 minutes ago, consider them online
  if (diff < 120000) return 'online';
  // Show minutes if less than 1 hour
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  // Show hours if less than 24 hours
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  // Show days otherwise
  const days = Math.floor(diff / 86400000);
  return days === 0 ? 'Today' : `${days}d ago`;
};

interface StickyNoteWidgetProps {
  note: string;
  fontSize: number;
  isEditing: boolean;
  layoutCategory: WidgetLayoutCategory;
  onUpdateNote: (note: string) => void;
  onUpdateFontSize: (fontSize: number) => void;
}

const StickyNoteWidget = ({ note, fontSize, isEditing, layoutCategory, onUpdateNote, onUpdateFontSize }: StickyNoteWidgetProps) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const isUserTypingRef = useRef(false);
  const lastSyncedNoteRef = useRef(note);
  
  const textStyle: React.CSSProperties = {
    fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
    fontSize: `${fontSize}px`,
  };
  
  // Initialize content on mount or when switching to editing mode
  useEffect(() => {
    if (contentEditableRef.current && isEditing) {
      const currentContent = contentEditableRef.current.innerHTML;
      // Only update if contentEditable is empty or if note prop changed from outside
      if (!currentContent || (note !== lastSyncedNoteRef.current && !isUserTypingRef.current)) {
        contentEditableRef.current.innerHTML = note || '';
        setIsEmpty(!contentEditableRef.current.textContent?.trim());
        lastSyncedNoteRef.current = note;
      }
    }
  }, [note, isEditing]);
  
  const handleInput = () => {
    if (contentEditableRef.current) {
      const textContent = contentEditableRef.current.textContent?.trim() || '';
      setIsEmpty(!textContent);
      // Update character count immediately (reads from DOM, no state update needed)
    }
  };
  
  const handleBlur = () => {
    if (contentEditableRef.current) {
      isUserTypingRef.current = true;
      const htmlContent = contentEditableRef.current.innerHTML;
      const textContent = contentEditableRef.current.textContent?.trim() || '';
      const textLength = textContent.length;
      if (textLength <= 280) {
        lastSyncedNoteRef.current = htmlContent;
        onUpdateNote(htmlContent);
      }
      setTimeout(() => {
        isUserTypingRef.current = false;
      }, 100);
    }
  };
  
  const toggleFormat = (command: string, tag: string) => {
    const editable = contentEditableRef.current;
    if (!editable) return;
    
    // Save current selection before focusing
    const savedSelection = window.getSelection();
    let savedRange: Range | null = null;
    if (savedSelection && savedSelection.rangeCount > 0) {
      savedRange = savedSelection.getRangeAt(0).cloneRange();
    }
    
    // Focus the editable
    editable.focus();
    
    // Restore selection if we had one
    if (savedRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
    
    // Get current selection after focus
    let selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // No selection, select all or create a collapsed range at end
      selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      if (editable.textContent && editable.textContent.trim()) {
        // If there's content, select all
        range.selectNodeContents(editable);
      } else {
        // If empty, just position cursor
        range.selectNodeContents(editable);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // Check if we're inside the tag we want to toggle
    let element = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container as Element;
    
    let isFormatted = false;
    while (element && element !== editable) {
      if (element.tagName?.toLowerCase() === tag.toLowerCase() || 
          (tag === 'b' && element.tagName?.toLowerCase() === 'strong')) {
        isFormatted = true;
        break;
      }
      element = element.parentElement;
    }
    
    if (isFormatted) {
      // Remove formatting
      document.execCommand('removeFormat', false);
      // Also try to unwrap the specific tag
      const selectedText = range.toString();
      if (selectedText || range.collapsed) {
        if (range.collapsed) {
          const parent = container.nodeType === Node.TEXT_NODE 
            ? container.parentElement 
            : container as Element;
          if (parent && (parent.tagName?.toLowerCase() === tag.toLowerCase() || 
              (tag === 'b' && parent.tagName?.toLowerCase() === 'strong'))) {
            // Unwrap the parent
            const parentElement = parent;
            const parentParent = parentElement.parentElement;
            if (parentParent) {
              while (parentElement.firstChild) {
                parentParent.insertBefore(parentElement.firstChild, parentElement);
              }
              parentParent.removeChild(parentElement);
            }
          }
        } else {
          // Unwrap selected content
          const contents = range.extractContents();
          range.insertNode(contents);
        }
      }
    } else {
      // Add formatting - ensure we have a selection
      if (range.collapsed && editable.textContent && editable.textContent.trim()) {
        // If collapsed and there's content, try to select the word at cursor
        // Move start backward to word boundary
        try {
          range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
          range.setEnd(range.endContainer, Math.min(range.endContainer.textContent?.length || 0, range.endOffset + 1));
        } catch (e) {
          // If that fails, just use the collapsed range
        }
      }
      document.execCommand(command, false, undefined);
    }
    
    // Update content after formatting
    setTimeout(() => {
      handleBlur();
      editable.focus();
    }, 10);
  };
  
  const toggleBold = () => toggleFormat('bold', 'b');
  const toggleItalic = () => toggleFormat('italic', 'i');
  
  if (layoutCategory === 'minimal') {
    return (
      <div className="h-full flex flex-col p-1">
        {isEditing && (
          <div className="flex items-center gap-1 mb-1 pb-1 border-b border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleBold}
              title="Bold"
            >
              <Bold className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleItalic}
              title="Italic"
            >
              <Italic className="h-3 w-3" />
            </Button>
            <Select
              value={String(fontSize)}
              onValueChange={(value) => onUpdateFontSize(Number(value))}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12px</SelectItem>
                <SelectItem value="14">14px</SelectItem>
                <SelectItem value="16">16px</SelectItem>
                <SelectItem value="18">18px</SelectItem>
                <SelectItem value="20">20px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {isEditing ? (
          <div className="flex-1 relative">
            <div
              ref={contentEditableRef}
              contentEditable
              onInput={handleInput}
              onBlur={handleBlur}
              className="flex-1 resize-none bg-transparent text-xs p-1 overflow-auto outline-none min-h-full"
              style={textStyle}
              suppressContentEditableWarning
            />
            {isEmpty && (
              <div className="absolute top-1 left-1 text-xs text-muted-foreground pointer-events-none">
                Note...
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex-1 text-xs p-1 overflow-auto"
            style={textStyle}
            dangerouslySetInnerHTML={{ __html: note }}
          />
        )}
        {isEditing && (
          <div className="text-[8px] text-muted-foreground text-right">
            {(contentEditableRef.current?.textContent?.length || 0)}/280
          </div>
        )}
      </div>
    );
  }
  
  if (layoutCategory === 'minimal-vertical' || layoutCategory === 'minimal-horizontal') {
    return (
      <div className="h-full flex flex-col p-2">
        {isEditing && (
          <div className="flex items-center gap-1 mb-1 pb-1 border-b border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleBold}
              title="Bold"
            >
              <Bold className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleItalic}
              title="Italic"
            >
              <Italic className="h-3 w-3" />
            </Button>
            <Select
              value={String(fontSize)}
              onValueChange={(value) => onUpdateFontSize(Number(value))}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12px</SelectItem>
                <SelectItem value="14">14px</SelectItem>
                <SelectItem value="16">16px</SelectItem>
                <SelectItem value="18">18px</SelectItem>
                <SelectItem value="20">20px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {isEditing ? (
          <div className="flex-1 relative">
            <div
              ref={contentEditableRef}
              contentEditable
              onInput={handleInput}
              onBlur={handleBlur}
              className="flex-1 resize-none bg-transparent text-xs overflow-auto outline-none min-h-full"
              style={textStyle}
              suppressContentEditableWarning
            />
            {isEmpty && (
              <div className="absolute top-0 left-0 text-xs text-muted-foreground pointer-events-none">
                Type a quote, goal, or reminder...
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex-1 text-xs overflow-auto"
            style={textStyle}
            dangerouslySetInnerHTML={{ __html: note }}
          />
        )}
        {isEditing && (
          <div className="text-[10px] text-muted-foreground mt-1 text-right">
            {(contentEditableRef.current?.textContent?.length || 0)}/280
          </div>
        )}
      </div>
    );
  }
  
  // Regular: Full layout
  return (
    <div className="h-full flex flex-col">
      {isEditing && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={toggleBold}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={toggleItalic}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Type className="h-4 w-4 text-muted-foreground" />
            <Select
              value={String(fontSize)}
              onValueChange={(value) => onUpdateFontSize(Number(value))}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12px</SelectItem>
                <SelectItem value="14">14px</SelectItem>
                <SelectItem value="16">16px</SelectItem>
                <SelectItem value="18">18px</SelectItem>
                <SelectItem value="20">20px</SelectItem>
                <SelectItem value="24">24px</SelectItem>
                <SelectItem value="28">28px</SelectItem>
                <SelectItem value="32">32px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {isEditing ? (
        <div className="flex-1 relative">
          <div
            ref={contentEditableRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleBlur}
            className="flex-1 resize-none bg-transparent overflow-auto outline-none min-h-full"
            style={textStyle}
            suppressContentEditableWarning
          />
          {isEmpty && (
            <div className="absolute top-0 left-0 text-muted-foreground pointer-events-none">
              Type a quote, goal, or reminder...
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex-1 overflow-auto"
          style={textStyle}
          dangerouslySetInnerHTML={{ __html: note }}
        />
      )}
      {isEditing && (
        <div className="text-[10px] text-muted-foreground mt-2 text-right">
          {(contentEditableRef.current?.textContent?.length || 0)}/280
        </div>
      )}
    </div>
  );
};

export function WidgetRenderer({ widget, isEditing = false }: WidgetRendererProps) {
  // Local state for interactive widgets (like sticky note, leaderboard scope)
  const [localConfig, setLocalConfig] = useState(widget.config || {});

  const updateWidgetConfig = (type: string, newConfig: Record<string, any>, merge = true) => {
    setLocalConfig(prev => merge ? { ...prev, ...newConfig } : newConfig);
  };

  // Merge prop config with local config
  const currentConfig = { ...widget.config, ...localConfig };
  const currentWidget = { ...widget, config: currentConfig };

  const renderStatWidget = (title: string, value: string, subtitle: string, layoutCategory: WidgetLayoutCategory) => {
    if (layoutCategory === 'minimal') {
      // Minimal: Just value, no title or subtitle
      return (
        <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
          <div className="text-3xl font-extrabold text-foreground">{value}</div>
        </div>
      );
    }
    
    if (layoutCategory === 'minimal-vertical') {
      // Minimal-vertical: Vertical stack with compact spacing
      return (
        <div className="h-full flex flex-col justify-center gap-1 px-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{title}</div>
          <div className="text-2xl font-extrabold text-foreground">{value}</div>
          <div className="text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
      );
    }
    
    if (layoutCategory === 'minimal-horizontal') {
      // Minimal-horizontal: Horizontal layout
      return (
        <div className="h-full flex items-center justify-between px-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{title}</div>
            <div className="text-xl font-extrabold text-foreground">{value}</div>
          </div>
          <div className="text-[10px] text-muted-foreground text-right">{subtitle}</div>
        </div>
      );
    }
    
    // Regular: Full layout
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
          <BarChart3 className="h-4 w-4" /> {title}
        </div>
        <div>
          <div className="text-3xl font-extrabold text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
        </div>
      </div>
    );
  };

  const renderWidgetContent = (widget: DashboardWidget) => {
    // Get the new layout category (minimal, minimal-vertical, minimal-horizontal, regular)
    const layoutCategory = getWidgetLayoutCategory(widget);
    // Keep variant for backward compatibility with widgets that haven't been migrated yet
    const variant = getWidgetVariant(widget);
    
    switch (widget.type) {
      case 'practice': {
        const handleStartSession = (minutes: number, subject: 'Math' | 'Reading & Writing') => {
          console.log(`Start session: ${minutes} min, ${subject}`);
        };
        return (
          <PracticeWidget
            w={widget.w}
            h={widget.h}
            gridScale={GRID_SCALE}
            onStartSession={handleStartSession}
          />
        );
      }
      case 'streak': {
        const consistencyDays = mockConsistencyDays;
        const consistencyDaysThisYear = consistencyDays.filter(d => d.level > 0).length;
        const dayStreak = 12; // Mock streak

        const hasActivity = consistencyDays.some((day) => day.level > 0);
        if (!hasActivity) {
          return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Start practicing to build a streak.
            </div>
          );
        }
        
        // Migrated to new layout category system
        // 'regular' = large enough for consistency map (was 'large')
        if (layoutCategory === 'regular') {
          // Calculate grid dimensions
          // Note: widget.w and widget.h are in GRID UNITS, so multiply by pixel size
          const gridUnitPx = 80; // Should match page constant, but local is fine
          const padding = 24 * 2; // p-6 * 2
          const gap = 6; // gap-1.5 = 6px
          const dotSize = 12; // h-3 w-3 = 12px
          
          // widget.w and widget.h are in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableWidth = widget.w * gridUnitPx - padding;
          const availableHeight = widget.h * gridUnitPx - padding - 40; // -40 for text

          const dotSpace = dotSize + gap;
          const rows = Math.max(1, Math.floor(availableHeight / dotSpace)); // At least 1 row
          const cols = Math.max(1, Math.floor(availableWidth / dotSpace)); // At least 1 col
          
          // Generate extra mock data if needed to fill the grid
          const needed = rows * cols;
          let displayDays = [...consistencyDays];
          if (displayDays.length < needed) {
             const extraNeeded = needed - displayDays.length;
             const lastDate = displayDays.length > 0 
                ? new Date(displayDays[displayDays.length - 1].date)
                : new Date();
                
             for (let i = 0; i < extraNeeded; i++) {
               const nextDate = new Date(lastDate);
               nextDate.setDate(nextDate.getDate() + i + 1);
               displayDays.push({
                 date: nextDate.toISOString().split('T')[0],
                 minutes: 0,
                 level: Math.floor(Math.random() * 5) as 0 | 1 | 2 | 3 | 4
               });
             }
          }

          return (
            <div className="h-full flex flex-col justify-between gap-4 p-6">
              <div className="flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden">
                <ConsistencyMap 
                  days={displayDays} 
                  weeks={cols}
                  rows={rows}
                  dotClassName="h-3 w-3"
                  className="h-auto w-auto"
                  gridClassName="place-content-center gap-1.5"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                You&apos;ve studied on <span className="font-semibold text-foreground">{consistencyDaysThisYear} days</span> this year.
              </p>
            </div>
          );
        }
        // 'minimal-vertical' or 'minimal-horizontal' = medium size with last 7 days (was 'medium')
        if (layoutCategory === 'minimal-vertical' || layoutCategory === 'minimal-horizontal') {
          const lastSeven = consistencyDays.slice(-7);
          return (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-2 py-2">
              <div className="flex items-center justify-center gap-2">
                <Flame className="h-5 w-5 text-[#FF9600] fill-[#FF9600]" />
                <span className="text-3xl font-extrabold text-foreground">{dayStreak}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">day streak</span>
              </div>
              <div className="flex gap-2 justify-center">
                {lastSeven.map((day, idx) => (
                  <span key={`${day.date}-${idx}`} className={cn('h-3 w-3 rounded-full', day.level === 0 ? 'bg-muted/60' : day.level === 1 ? 'bg-emerald-200' : day.level === 2 ? 'bg-emerald-300' : day.level === 3 ? 'bg-emerald-400' : 'bg-emerald-500')} />
                ))}
              </div>
            </div>
          );
        }
        // 'minimal' = smallest size, just show streak number (was 'small')
        return (
          <div className="h-full flex items-center justify-center px-2 py-2">
            <div className="flex flex-col items-center gap-2">
              <Flame className="h-6 w-6 text-[#FF9600] fill-[#FF9600]" />
              <div className="text-4xl font-extrabold text-foreground">{dayStreak}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">day streak</div>
            </div>
          </div>
        );
      }
      case 'masteryProgress': {
        if (layoutCategory === 'minimal') {
          // Minimal: Show just the latest score
          const latest = mockHistoricalData[mockHistoricalData.length - 1];
          return (
            <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Mastery</div>
              <div className="text-3xl font-extrabold text-foreground">{Math.round(latest.overall)}%</div>
              <div className="text-[10px] text-muted-foreground">Last 7 days</div>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical' || layoutCategory === 'minimal-horizontal') {
          // Minimal-vertical/horizontal: Compact chart
          return (
            <div className="h-full flex flex-col justify-center px-1">
              <HistoricalMasteryCard data={mockHistoricalData} embedded className="h-full" />
            </div>
          );
        }
        
        // Regular: Full layout
        return <HistoricalMasteryCard data={mockHistoricalData} embedded className="h-full" />;
      }
      case 'strengthsWeaknesses': {
        const userStats = mockUserStats;
        
        if (layoutCategory === 'minimal') {
          // Minimal: Show top strength and weakness
          const topStrength = userStats.strengths[0];
          const topWeakness = userStats.weaknesses[0];
          return (
            <div className="h-full flex flex-col justify-center gap-2 px-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate">{topStrength?.subdomain || '--'}</span>
                <span className="text-xs font-semibold text-emerald-600">{topStrength?.accuracy.toFixed(0) || '--'}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate">{topWeakness?.subdomain || '--'}</span>
                <span className="text-xs font-semibold text-amber-600">{topWeakness?.accuracy.toFixed(0) || '--'}%</span>
              </div>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical') {
          // Minimal-vertical: Vertical stack
          return (
            <div className="h-full flex flex-col gap-3 px-2 py-1">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Strengths</p>
                <div className="space-y-2">
                  {userStats.strengths.slice(0, 2).map((item) => (
                    <div key={`${item.domain}-${item.subdomain}`} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground truncate">{item.subdomain}</span>
                      <span className="text-xs font-semibold text-emerald-600">{item.accuracy.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Focus</p>
                <div className="space-y-2">
                  {userStats.weaknesses.slice(0, 2).map((item) => (
                    <div key={`${item.domain}-${item.subdomain}`} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground truncate">{item.subdomain}</span>
                      <span className="text-xs font-semibold text-amber-600">{item.accuracy.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-horizontal') {
          // Minimal-horizontal: Side by side
          return (
            <div className="h-full grid grid-cols-2 gap-3 px-2 py-1">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Strengths</p>
                <div className="space-y-1.5">
                  {userStats.strengths.slice(0, 2).map((item) => (
                    <div key={`${item.domain}-${item.subdomain}`} className="flex flex-col">
                      <span className="text-[10px] text-foreground truncate">{item.subdomain}</span>
                      <span className="text-xs font-semibold text-emerald-600">{item.accuracy.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Focus</p>
                <div className="space-y-1.5">
                  {userStats.weaknesses.slice(0, 2).map((item) => (
                    <div key={`${item.domain}-${item.subdomain}`} className="flex flex-col">
                      <span className="text-[10px] text-foreground truncate">{item.subdomain}</span>
                      <span className="text-xs font-semibold text-amber-600">{item.accuracy.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        
        // Regular: Full layout
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">Strengths</p>
              <div className="space-y-3">
                {userStats.strengths.map((item) => (
                  <div key={`${item.domain}-${item.subdomain}`} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.subdomain}</p>
                      <p className="text-xs text-muted-foreground">{item.domain}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">{item.accuracy.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">Focus Areas</p>
              <div className="space-y-3">
                {userStats.weaknesses.map((item) => (
                  <div key={`${item.domain}-${item.subdomain}`} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.subdomain}</p>
                      <p className="text-xs text-muted-foreground">{item.domain}</p>
                    </div>
                    <span className="text-sm font-semibold text-amber-600">{item.accuracy.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case 'skillMastery': {
        if (layoutCategory === 'minimal') {
          // Minimal: Show overall score only
          const overallScore = 78;
          return (
            <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Mastery</div>
              <div className="text-3xl font-extrabold text-foreground">{overallScore}%</div>
              <div className="text-[10px] text-muted-foreground">Overall</div>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical') {
          // Minimal-vertical: Show domain scores vertically
          return (
            <div className="h-full flex flex-col justify-center gap-3 px-2 py-1">
              {mockSkillMasteryData.map((domain) => (
                <div key={domain.domainId} className="flex items-center justify-between">
                  <span className="text-xs text-foreground truncate">{domain.domainName}</span>
                  <span className="text-sm font-semibold text-emerald-600">{Math.round(domain.averageCompetency)}%</span>
                </div>
              ))}
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-horizontal') {
          // Minimal-horizontal: Show domain scores horizontally
          return (
            <div className="h-full flex items-center justify-center gap-4 px-2">
              {mockSkillMasteryData.map((domain) => (
                <div key={domain.domainId} className="flex flex-col items-center">
                  <span className="text-[10px] text-muted-foreground">{domain.domainName}</span>
                  <span className="text-lg font-extrabold text-foreground">{Math.round(domain.averageCompetency)}%</span>
                </div>
              ))}
            </div>
          );
        }
        
        // Regular: Full layout
        return (
          <div className="h-full overflow-y-auto pr-1">
            <SkillMastery 
              showOverall={false} 
              embedded 
              data={mockSkillMasteryData} 
              overallScore={78}
              layoutCategory={layoutCategory}
              widgetWidth={widget.w}
              widgetHeight={widget.h}
            />
          </div>
        );
      }
      case 'assignments': {
        const assignments = mockAssignments;
        
        if (layoutCategory === 'minimal') {
          // Minimal: Show count only
          return (
            <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Assignments</div>
              <div className="text-3xl font-extrabold text-foreground">{assignments.length}</div>
              <div className="text-[10px] text-muted-foreground">Active</div>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical') {
          // Minimal-vertical: Compact vertical list
          return (
            <div className="h-full flex flex-col gap-1.5 px-2 py-1 overflow-y-auto">
              {assignments.map((a) => {
                const goal = Number(a.minutesGoal || 0);
                const progress = Math.max(0, Math.min(100, goal > 0 ? Math.round((a.progressMinutes || 0) / goal * 100) : 0));
                return (
                  <div key={a.id} className="border border-border rounded-lg p-1.5 bg-background">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-medium text-foreground truncate flex-1">{a.title}</span>
                      {goal > 0 && (
                        <span className="text-[10px] text-muted-foreground">{progress}%</span>
                      )}
                    </div>
                    {goal > 0 && (
                      <Progress value={progress} className="h-1" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-horizontal') {
          // Minimal-horizontal: Compact horizontal cards
          return (
            <div className="h-full flex items-center gap-2 px-2 overflow-x-auto">
              {assignments.map((a) => {
                const goal = Number(a.minutesGoal || 0);
                const progress = Math.max(0, Math.min(100, goal > 0 ? Math.round((a.progressMinutes || 0) / goal * 100) : 0));
                return (
                  <div key={a.id} className="border border-border rounded-lg p-2 bg-background min-w-[120px] flex-shrink-0">
                    <div className="text-xs font-medium text-foreground truncate mb-1">{a.title}</div>
                    {goal > 0 && (
                      <>
                        <div className="text-[10px] text-muted-foreground mb-1">{progress}%</div>
                        <Progress value={progress} className="h-1" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
        
        // Regular: Full layout
        return (
          <div className="h-full overflow-y-auto pr-1 space-y-2">
            {assignments.map((a) => {
              const goal = Number(a.minutesGoal || 0);
              const progress = Math.max(0, Math.min(100, goal > 0 ? Math.round((a.progressMinutes || 0) / goal * 100) : 0));
              return (
                <div key={a.id} className="border-2 border-border rounded-xl p-2 bg-background">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="font-medium truncate max-w-[40%] text-foreground">{a.title}</div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant={a.subject === 'math' ? 'secondary' : 'outline'} className="h-7 px-2">Math</Button>
                      <Button size="sm" variant={a.subject === 'rw' ? 'secondary' : 'outline'} className="h-7 px-2">R&W</Button>
                    </div>
                    {a.dueAt ? (
                      <div className="text-xs text-muted-foreground whitespace-nowrap">Due {new Date(a.dueAt).toLocaleDateString()}</div>
                    ) : null}
                    {goal > 0 ? (
                      <div className="ml-auto flex items-center gap-2 w-56">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{a.progressMinutes || 0} / {goal} min</div>
                        <Progress value={progress} className="h-2 flex-1" />
                      </div>
                    ) : (
                      <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap">Progress updates as you practice</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case 'leaderboard': {
        const scope = (widget.config?.scope as 'global' | 'my-school' | 'friends') || 'global';
        const entries = mockLeaderboardEntries;
        const userIndex = entries.findIndex((entry) => entry.userId === '1'); // '1' is mocked 'You'

        // Migrated to new layout category system
        // 'minimal' = 2x2, show just rank (was 'small' with is2x2)
        if (layoutCategory === 'minimal') {
          const rank = userIndex >= 0 ? entries[userIndex].rank : null;
          return (
            <div className="h-full flex flex-col">
              {isEditing && (
                <Select value={scope} onValueChange={(value) => updateWidgetConfig('leaderboard', { scope: value }, true)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="friends">Friends</SelectItem>
                    <SelectItem value="my-school">My School</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex-1 flex flex-col justify-center text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Your Rank</div>
                <div className="text-4xl font-extrabold text-foreground">{rank ? `#${rank}` : '--'}</div>
              </div>
            </div>
          );
        }
        // 'minimal-vertical' = 2x3, 2x4, etc. - show board like regular layout, calculate rows that fit
        if (layoutCategory === 'minimal-vertical') {
          // Calculate how many rows can fit based on widget height
          // CardContent has pt-2 (8px top) + pb-2 (8px bottom) = 16px vertical padding for minimal-vertical
          const gridUnitPx = 80; // Grid unit size in pixels
          const cardContentPadding = 8 + 8; // pt-2 + pb-2 = 16px total vertical padding
          const selectHeight = 32; // h-8 = 32px
          const gap = 12; // gap-3 = 12px
          const rowHeight = 28; // Actual height per row (text-sm with small avatar)
          const rowGap = 8; // space-y-2 = 8px between rows
          
          // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableHeight = widget.h * gridUnitPx - cardContentPadding - selectHeight - gap;
          const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
          
          // Show entries around the user, similar to regular layout
          const start = userIndex >= 0 ? Math.max(0, userIndex - Math.floor((rowsThatFit - 1) / 2)) : 0;
          const slice = entries.slice(start, start + rowsThatFit);
          
          return (
            <div className="h-full flex flex-col gap-3">
              <Select value={scope} onValueChange={(value) => updateWidgetConfig('leaderboard', { scope: value }, true)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="friends">Friends</SelectItem>
                  <SelectItem value="my-school">My School</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {slice.map((entry) => (
                  <div key={entry.userId} className={cn('flex items-center gap-3 text-sm', entry.userId === '1' && 'font-semibold text-foreground')}>
                    <span className="text-xs text-muted-foreground w-6">#{entry.rank}</span>
                    <CustomAvatar size="sm" icon={entry.avatarIcon} color={entry.avatarColor} fallbackText={getInitials(entry.displayName || 'U')} />
                    <div className="flex-1 truncate">{entry.displayName}</div>
                    <span className="text-xs text-muted-foreground">{Math.round(entry.overallCompetency)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        // 'minimal-horizontal' = 3x2, 4x2, etc. - show buttons and rank (was 'small' with !is2x2 && !isWidth2Or3)
        if (layoutCategory === 'minimal-horizontal') {
          const rank = userIndex >= 0 ? entries[userIndex].rank : null;
          return (
            <div className="h-full flex flex-col">
              <div className="flex gap-2 justify-center items-center w-full px-1">
                {(['global', 'friends', 'my-school'] as const).map((opt) => (
                  <Button key={opt} size="sm" variant={scope === opt ? 'secondary' : 'outline'} className="h-7 px-2 flex-1 min-w-0" onClick={() => updateWidgetConfig('leaderboard', { scope: opt }, true)}>
                    <span className="truncate">{opt === 'global' ? 'Global' : opt === 'friends' ? 'Friends' : 'School'}</span>
                  </Button>
                ))}
              </div>
              <div className="text-center mt-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Your Rank</div>
                <div className="text-4xl font-extrabold text-foreground">{rank ? `#${rank}` : '--'}</div>
              </div>
            </div>
          );
        }
        // 'regular' with smaller width (< 6 grid units) = calculate rows that fit based on height (no button)
        if (layoutCategory === 'regular' && widget.w < 6) {
          // Calculate how many rows can fit based on widget height
          // CardContent has pt-6 (24px top) + pb-2 (8px bottom) = 32px vertical padding
          const gridUnitPx = 80; // Grid unit size in pixels
          const cardContentPadding = 24 + 8; // pt-6 + pb-2 = 32px total vertical padding
          const selectHeight = 32; // h-8 = 32px
          const gap = 12; // gap-3 = 12px
          const rowHeight = 28; // Actual height per row (text-sm with small avatar)
          const rowGap = 8; // space-y-2 = 8px between rows
          
          // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableHeight = widget.h * gridUnitPx - cardContentPadding - selectHeight - gap;
          const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
          
          // Show entries around the user, similar to minimal-vertical
          const start = userIndex >= 0 ? Math.max(0, userIndex - Math.floor((rowsThatFit - 1) / 2)) : 0;
          const slice = entries.slice(start, start + rowsThatFit);
          
          return (
            <div className="h-full flex flex-col gap-3">
              <Select value={scope} onValueChange={(value) => updateWidgetConfig('leaderboard', { scope: value }, true)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="friends">Friends</SelectItem>
                  <SelectItem value="my-school">My School</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {slice.map((entry) => (
                  <div key={entry.userId} className={cn('flex items-center gap-3 text-sm', entry.userId === '1' && 'font-semibold text-foreground')}>
                    <span className="text-xs text-muted-foreground w-6">#{entry.rank}</span>
                    <CustomAvatar size="sm" icon={entry.avatarIcon} color={entry.avatarColor} fallbackText={getInitials(entry.displayName || 'U')} />
                    <div className="flex-1 truncate">{entry.displayName}</div>
                    <span className="text-xs text-muted-foreground">{Math.round(entry.overallCompetency)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        // 'regular' with larger width = calculate rows that fit based on height (account for button)
        return (
          <div className="h-full flex flex-col gap-3">
            <Select value={scope} onValueChange={(value) => updateWidgetConfig('leaderboard', { scope: value }, true)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="friends">Friends</SelectItem>
                <SelectItem value="my-school">My School</SelectItem>
              </SelectContent>
            </Select>
            {/* Calculate how many rows can fit based on widget height */}
            {(() => {
              // CardContent has pt-6 (24px top) + pb-2 (8px bottom) = 32px vertical padding
              const gridUnitPx = 80; // Grid unit size in pixels
              const cardContentPadding = 24 + 8; // pt-6 + pb-2 = 32px total vertical padding
              const selectHeight = 32; // h-8 = 32px
              const gap = 12; // gap-3 = 12px
              const buttonHeight = 32; // Button height (size="sm")
              const rowHeight = 28; // Actual height per row (text-sm with small avatar)
              const rowGap = 8; // space-y-2 = 8px between rows
              
              // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
              // Account for cardContent padding, select, gap, and button
              const availableHeight = widget.h * gridUnitPx - cardContentPadding - selectHeight - gap - buttonHeight - gap;
              const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
              
              // Show entries around the user
              const start = userIndex >= 0 ? Math.max(0, userIndex - Math.floor((rowsThatFit - 1) / 2)) : 0;
              const slice = entries.slice(start, start + rowsThatFit);
              
              return (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {slice.map((entry) => (
                    <div key={entry.userId} className={cn('flex items-center gap-3 text-sm', entry.userId === '1' && 'font-semibold text-foreground')}>
                      <span className="text-xs text-muted-foreground w-6">#{entry.rank}</span>
                      <CustomAvatar size="sm" icon={entry.avatarIcon} color={entry.avatarColor} fallbackText={getInitials(entry.displayName || 'U')} />
                      <div className="flex-1 truncate">{entry.displayName}</div>
                      <span className="text-xs text-muted-foreground">{Math.round(entry.overallCompetency)}%</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <Button size="sm" variant="outline">Open leaderboard</Button>
          </div>
        );
      }
      case 'friendsActivity': {
        const friendsActivity = mockFriendsActivity;
        // Sort by most recently practiced (most recent first)
        const sorted = [...friendsActivity].sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
        
        if (layoutCategory === 'minimal') {
          // Minimal: Show just count or top friend
          const topFriend = sorted[0];
          return (
            <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
              {topFriend ? (
                <>
                  <CustomAvatar size="sm" icon={topFriend.avatarIcon} color={topFriend.avatarColor} fallbackText={getInitials(topFriend.displayName || 'U')} />
                  <div className="text-xs font-medium text-foreground truncate w-full text-center">{topFriend.displayName}</div>
                  {typeof topFriend.overallCompetency === 'number' && (
                    <div className="text-[10px] text-emerald-600">{Math.round(topFriend.overallCompetency)}%</div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Friends</div>
                  <div className="text-2xl font-extrabold text-foreground">{sorted.length}</div>
                </>
              )}
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical') {
          // Minimal-vertical: Calculate rows that fit based on widget height
          // CardContent has pt-2 (8px top) + pb-2 (8px bottom) = 16px vertical padding for minimal-vertical
          const gridUnitPx = 80; // Grid unit size in pixels
          const cardContentPadding = 8 + 8; // pt-2 + pb-2 = 16px total vertical padding
          const rowHeight = 40; // Actual height per row (text-xs with two-line text + avatar)
          const rowGap = 6; // gap-1.5 = 6px between rows
          
          // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableHeight = widget.h * gridUnitPx - cardContentPadding;
          const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
          
          const visible = sorted.slice(0, rowsThatFit);
          return (
            <div className="h-full flex flex-col gap-1.5 px-2 py-1 overflow-y-auto">
              {visible.map((friend) => (
                <div key={friend.userId} className="flex items-center gap-2">
                  <CustomAvatar size="sm" icon={friend.avatarIcon} color={friend.avatarColor} fallbackText={getInitials(friend.displayName || 'U')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{friend.displayName}</div>
                    <div className="text-[10px] text-muted-foreground">{formatLastActive(friend.lastActive)}</div>
                  </div>
                  {typeof (friend as any).recentGains === 'number' && (
                    <span className="text-[10px] font-semibold text-emerald-600">+{(friend as any).recentGains.toFixed(1)}%</span>
                  )}
                </div>
              ))}
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-horizontal') {
          // Minimal-horizontal: Calculate how many friends can fit based on widget width (doubled density)
          const gridUnitPx = 80; // Grid unit size in pixels
          const padding = 8 * 2; // px-2 * 2 = 16px total horizontal padding
          const cardMinWidth = 60; // Minimum width per card (reduced for higher density)
          const gap = 4; // gap-1 = 4px between cards (reduced gap)
          
          // widget.w is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableWidth = widget.w * gridUnitPx - padding;
          const friendsThatFit = Math.max(1, Math.floor(availableWidth / (cardMinWidth + gap)));
          
          const visible = sorted.slice(0, friendsThatFit);
          return (
            <div className="h-full flex items-center gap-1 px-2">
              {visible.map((friend) => (
                <div key={friend.userId} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                  <CustomAvatar size="sm" icon={friend.avatarIcon} color={friend.avatarColor} fallbackText={getInitials(friend.displayName || 'U')} />
                  <div className="text-[10px] font-medium text-foreground truncate w-full text-center">{friend.displayName}</div>
                  {typeof (friend as any).recentGains === 'number' && (
                    <div className="text-[9px] text-emerald-600">+{(friend as any).recentGains.toFixed(1)}%</div>
                  )}
                </div>
              ))}
            </div>
          );
        }
        
        // Regular: Calculate rows that fit based on widget height
        // Split into smaller width (< 6) and larger width (>= 6) with button
        if (layoutCategory === 'regular' && widget.w < 6) {
          // Regular with smaller width (< 6 grid units) = calculate rows that fit (no button)
          const gridUnitPx = 80; // Grid unit size in pixels
          const cardContentPadding = 24 + 8; // pt-6 + pb-2 = 32px total vertical padding
          const rowHeight = 44; // Actual height per row (text-sm with two-line text + avatar)
          const rowGap = 8; // space-y-2 = 8px between rows
          
          // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableHeight = widget.h * gridUnitPx - cardContentPadding;
          const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
          
          const visible = sorted.slice(0, rowsThatFit);
          return (
            <div className="h-full flex flex-col gap-2">
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {visible.map((friend) => (
                  <div key={friend.userId} className="flex items-center gap-3 text-sm">
                    <CustomAvatar size="sm" icon={friend.avatarIcon} color={friend.avatarColor} fallbackText={getInitials(friend.displayName || 'U')} />
                    <div className="flex-1 truncate">
                      <div className="font-medium text-foreground">{friend.displayName}</div>
                      <div className="text-xs text-muted-foreground">{formatLastActive(friend.lastActive)}</div>
                    </div>
                    {typeof (friend as any).recentGains === 'number' && (
                      <span className="text-xs font-semibold text-emerald-600">+{(friend as any).recentGains.toFixed(1)}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        
        // Regular with larger width (>= 6 grid units) = calculate rows that fit (with button)
        return (
          <div className="h-full flex flex-col gap-2">
            {/* Calculate how many rows can fit based on widget height */}
            {(() => {
              // CardContent has pt-6 (24px top) + pb-2 (8px bottom) = 32px vertical padding
              const gridUnitPx = 80; // Grid unit size in pixels
              const cardContentPadding = 24 + 8; // pt-6 + pb-2 = 32px total vertical padding
              const buttonHeight = 32; // Button height (size="sm")
              const rowHeight = 44; // Actual height per row (text-sm with two-line text + avatar)
              const rowGap = 8; // space-y-2 = 8px between rows
              
              // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
              // Account for cardContent padding and button
              const availableHeight = widget.h * gridUnitPx - cardContentPadding - buttonHeight - 8; // 8px gap before button
              const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
              
              const visible = sorted.slice(0, rowsThatFit);
              
              return (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {visible.map((friend) => (
                    <div key={friend.userId} className="flex items-center gap-3 text-sm">
                      <CustomAvatar size="sm" icon={friend.avatarIcon} color={friend.avatarColor} fallbackText={getInitials(friend.displayName || 'U')} />
                      <div className="flex-1 truncate">
                        <div className="font-medium text-foreground">{friend.displayName}</div>
                        <div className="text-xs text-muted-foreground">{formatLastActive(friend.lastActive)}</div>
                      </div>
                      {typeof friend.overallCompetency === 'number' && (
                        <span className="text-xs font-semibold text-emerald-600">{Math.round(friend.overallCompetency)}%</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
            <Button size="sm" variant="outline" className="w-full">
              View all friends
            </Button>
          </div>
        );
      }
      case 'myTutor': {
        // Calculate orb size based on widget size
        // Calculate orb size based on widget size (only width, height will be set by aspect ratio)
        const getOrbSize = () => {
          if (layoutCategory === 'minimal') return 'w-16';
          if (layoutCategory === 'minimal-vertical') return 'w-20';
          if (layoutCategory === 'minimal-horizontal') return 'w-20'; // Slightly smaller to fit better
          // For regular layout, use w-20 if height is 3 grid units, otherwise w-32
          if (layoutCategory === 'regular' && widget.h === 3) return 'w-20';
          return 'w-32';
        };
        
        const orbSize = getOrbSize();
        
        // Tutor orb component (simplified version of the one in TutorLiveCoach)
        const TutorOrb = () => {
          const [blobShape, setBlobShape] = useState({ tl: 50, tr: 50, br: 50, bl: 50, rot: 0, skewX: 0, skewY: 0, scale: 1 });
          
          // Animate the orb with subtle movement
          useEffect(() => {
            const interval = setInterval(() => {
              const intensity = 0.3; // Subtle animation
              const jitter = 15 * intensity;
              const rand = () => (Math.random() - 0.5);
              setBlobShape({
                tl: Math.max(40, Math.min(60, 50 + rand() * jitter)),
                tr: Math.max(40, Math.min(60, 50 + rand() * jitter)),
                br: Math.max(40, Math.min(60, 50 + rand() * jitter)),
                bl: Math.max(40, Math.min(60, 50 + rand() * jitter)),
                rot: rand() * 8 * intensity,
                skewX: rand() * 4 * intensity,
                skewY: rand() * 4 * intensity,
                scale: 1 + 0.1 * intensity,
              });
            }, 2000);
            return () => clearInterval(interval);
          }, []);
          
          return (
            <div className={cn("relative flex-shrink-0", orbSize)} style={{ aspectRatio: '1 / 1' }}>
              <div
                className="absolute inset-0 bg-[#93d333] cursor-pointer hover:bg-[#95DF26] transition-colors"
                style={{
                  borderRadius: `${blobShape.tl}% ${blobShape.tr}% ${blobShape.br}% ${blobShape.bl}% / ${blobShape.tr}% ${blobShape.br}% ${blobShape.bl}% ${blobShape.tl}%`,
                  opacity: 0.9,
                  transform: `translateZ(0) rotate(${blobShape.rot}deg) skew(${blobShape.skewX}deg, ${blobShape.skewY}deg) scale(${blobShape.scale})`,
                  transition: 'transform 200ms ease, border-radius 300ms ease, opacity 200ms ease, background-color 200ms ease',
                  boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.1)'
                }}
              />
              <div
                className="absolute inset-2 rounded-full bg-white opacity-20"
                style={{
                  transform: 'scale(0.8) translate(-10%, -10%)',
                  filter: 'blur(6px)'
                }}
              />
            </div>
          );
        };
        
        if (layoutCategory === 'minimal') {
          return (
            <div className="h-full flex items-center justify-center">
              <TutorOrb />
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical') {
          return (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <TutorOrb />
              <p className="text-xs font-semibold text-foreground">My Tutor</p>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-horizontal') {
          return (
            <div className="h-full flex items-center justify-between px-2">
              <div>
                <p className="text-xs font-semibold text-foreground">My Tutor</p>
                <p className="text-[10px] text-muted-foreground">Standard</p>
              </div>
              <div className="flex items-center justify-center flex-shrink-0 pt-3 pb-1">
                <TutorOrb />
              </div>
            </div>
          );
        }
        
        // Regular: Full layout
        return (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <TutorOrb />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">My Tutor</p>
              <p className="text-xs text-muted-foreground">Voice: Standard</p>
            </div>
          </div>
        );
      }
      case 'stickyNote': {
        const note = String(widget.config?.note || '');
        const fontSize = Number(widget.config?.fontSize || 16);
        
          return (
          <StickyNoteWidget
            note={note}
            fontSize={fontSize}
            isEditing={isEditing}
            layoutCategory={layoutCategory}
            onUpdateNote={(newNote) => updateWidgetConfig('stickyNote', { note: newNote })}
            onUpdateFontSize={(newFontSize) => updateWidgetConfig('stickyNote', { fontSize: newFontSize })}
          />
        );
      }
      case 'statAccuracy':
        return renderStatWidget('Accuracy', `${mockUserStats.averageAccuracy.toFixed(1)}%`, 'Last 15 days', layoutCategory);
      case 'statStudyTime':
        return renderStatWidget(
          'Study Time',
          `12h 30m`,
          `120 min in last 7 days`,
          layoutCategory
        );
      case 'statQuestions':
        return renderStatWidget(
          'Questions',
          `450`,
          `All-time answered`,
          layoutCategory
        );
      case 'statPoints':
        return renderStatWidget(
          'Point Boost',
          `+45`,
          `Based on practice time`,
          layoutCategory
        );
      case 'statProjectedScore':
        return renderStatWidget(
          'Projected',
          `1250`,
          `Based on baseline`,
          layoutCategory
        );
      default:
        return null;
    }
  };

  const meta = WIDGET_DEFINITIONS[widget.type];
  // Convert grid units to logical units for calculations
  const gridW = widget.w / GRID_SCALE;
  const gridH = widget.h / GRID_SCALE;
  
  // Get layout category for header visibility logic
  const layoutCategory = getWidgetLayoutCategory(widget);
  
  // Practice widget size checks (all in GRID UNITS):
  // These map to the new layout categories:
  // - isPractice2x2 → 'minimal' (2x2 grid units)
  // - isPractice1x2 → 'minimal-vertical' (logical 1x2 = grid 2x4)
  // - isPracticeNx1 → 'minimal' or 'minimal-vertical' (logical width 1 = grid width 2)
  // - isPracticeWidth2 → 'minimal-vertical' (width 2, height > 2)
  const isPractice1x2 = widget.type === 'practice' && Math.round(gridH) === 1 && Math.round(gridW) === 2;
  const isPracticeNx1 = widget.type === 'practice' && Math.round(gridW) === 1;
  const isPractice2x2 = widget.type === 'practice' && widget.w === 2 && widget.h === 2; // Maps to 'minimal'
  const isPracticeWidth2 = widget.type === 'practice' && widget.w === 2 && widget.h !== 2; // Maps to 'minimal-vertical'
  
  // Hide header for minimal sizes (except practice, streak, leaderboard which handle their own headers)
  // For myTutor, also hide header for minimal-vertical and minimal-horizontal
  const shouldHideHeader = 
    (layoutCategory === 'minimal' || 
     (widget.type === 'myTutor' && (layoutCategory === 'minimal-vertical' || layoutCategory === 'minimal-horizontal'))) &&
    widget.type !== 'practice' && 
    widget.type !== 'streak' && 
    widget.type !== 'leaderboard';

  const iconMap: Record<WidgetType, React.ReactElement> = {
    practice: <BookOpenCheck className="h-4 w-4" />,
    streak: <Flame className="h-4 w-4" />,
    leaderboard: <Trophy className="h-4 w-4" />,
    friendsActivity: <Users className="h-4 w-4" />,
    myTutor: <Sparkles className="h-4 w-4" />,
    stickyNote: <MessageSquareQuote className="h-4 w-4" />,
    masteryProgress: <BarChart3 className="h-4 w-4" />,
    skillMastery: <Sparkles className="h-4 w-4" />,
    strengthsWeaknesses: <Sparkles className="h-4 w-4" />,
    assignments: <BookOpenCheck className="h-4 w-4" />,
    statAccuracy: <BarChart3 className="h-4 w-4" />,
    statStudyTime: <BarChart3 className="h-4 w-4" />,
    statQuestions: <BarChart3 className="h-4 w-4" />,
    statPoints: <BarChart3 className="h-4 w-4" />,
    statProjectedScore: <BarChart3 className="h-4 w-4" />,
  };

  return (
    <Card className={cn(
      "h-full flex flex-col rounded-2xl border-2 border-border border-b-4 shadow-none gap-0",
      widget.type === 'stickyNote' ? "bg-[#FFF8D6] border-[#E8D28A]" : "bg-card"
    )}>
      {widget.type !== 'streak' && widget.type !== 'leaderboard' && widget.type !== 'stickyNote' && !shouldHideHeader && (
        <CardHeader className={cn(
          "pb-2",
          isPractice1x2 && "px-4 pt-4 pb-1",
          isPracticeNx1 && "px-0 pt-2 pb-0",
          isPractice2x2 && "px-0 pt-1 pb-0 flex items-center justify-center",
          // Compact headers for minimal-vertical and minimal-horizontal
          layoutCategory === 'minimal-vertical' && "pb-1 pt-3 px-3",
          layoutCategory === 'minimal-horizontal' && "pb-1 pt-3 px-3",
          widget.type === 'myTutor' && "pb-0"
        )}>
          <div className={cn(
            "flex items-start justify-between gap-3",
            isPractice2x2 && "w-full justify-center"
          )}>
            <div className={cn(
              "min-w-0 flex-1",
              isPractice2x2 && "flex justify-center"
            )}>
              <div className={cn(
                "flex items-center gap-2 uppercase tracking-wider text-muted-foreground font-bold truncate",
                isPracticeNx1 && "justify-center gap-0 scale-90 origin-top text-sm mt-2",
                isPractice2x2 && "justify-center gap-0 text-sm mt-2",
                !isPracticeNx1 && !isPractice2x2 && "text-xs"
              )}>
                {!isPracticeNx1 && !isPractice2x2 && iconMap[widget.type]}
                <span className="truncate">{(isPracticeNx1 || isPractice2x2) ? 'Practice' : meta.title}</span>
              </div>
              {!isPractice1x2 && !isPracticeNx1 && !isPractice2x2 && layoutCategory === 'regular' && (
                <CardDescription className="text-xs text-muted-foreground truncate">{meta.description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(
        "flex-1 min-h-0 overflow-hidden", 
        isPractice1x2 && "pt-2", 
        isPracticeNx1 && "px-1 pb-2",
        isPractice2x2 && "px-1 -mt-1 pb-2",
        isPracticeWidth2 && "px-1 pt-2 pb-2",
        widget.type === 'streak' && "pb-0 px-0",
        widget.type === 'leaderboard' && "pt-6",
        widget.type === 'stickyNote' && "pt-6",
        // Minimal sizes: maximize space, minimal padding
        shouldHideHeader && "p-1",
        layoutCategory === 'minimal-vertical' && !shouldHideHeader && "pt-2 px-2",
        layoutCategory === 'minimal-horizontal' && !shouldHideHeader && "pt-2 px-2",
        // SkillMastery: responsive padding based on size
        widget.type === 'skillMastery' && layoutCategory === 'regular' && (
          (widget.w < 6 || widget.h < 4) ? "px-2" : 
          (widget.w < 8 && widget.h < 6) ? "px-3" : 
          "px-4"
        )
      )}>
        {renderWidgetContent(currentWidget)}
      </CardContent>
    </Card>
  );
}
