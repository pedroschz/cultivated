"use client";

import React, { useState } from 'react';
import { 
  WIDGET_DEFINITIONS, 
  WidgetType, 
  DashboardWidget, 
  GRID_SCALE,
  getWidgetLayoutCategory,
  WidgetLayoutCategory
} from '@/lib/constants/widgets';
import { WidgetRenderer } from './WidgetRenderer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components';

const ALL_WIDGET_TYPES = Object.keys(WIDGET_DEFINITIONS) as WidgetType[];

// Determine which layout categories are allowed for a widget based on its constraints
const getAllowedCategories = (type: WidgetType): WidgetLayoutCategory[] => {
  const def = WIDGET_DEFINITIONS[type];
  const minW = def.minW * GRID_SCALE;
  const minH = def.minH * GRID_SCALE;
  const maxW = def.maxW * GRID_SCALE;
  const maxH = def.maxH * GRID_SCALE;
  
  const allowed: WidgetLayoutCategory[] = [];
  
  // minimal: requires exactly 2x2 grid units
  // Widget can be minimal if it can be 2x2 (minW <= 2 AND minH <= 2)
  if (minW <= 2 && minH <= 2) {
    allowed.push('minimal');
  }
  
  // minimal-vertical: requires width = 2, height > 2 (2x3, 2x4, etc.)
  // Widget can be minimal-vertical if minW <= 2 AND maxH > 2
  if (minW <= 2 && maxH > 2) {
    allowed.push('minimal-vertical');
  }
  
  // minimal-horizontal: requires width > 2, height = 2 (3x2, 4x2, etc.)
  // Widget can be minimal-horizontal if maxW > 2 AND minH <= 2
  if (maxW > 2 && minH <= 2) {
    allowed.push('minimal-horizontal');
  }
  
  // regular: everything else (any size that doesn't fit minimal categories, or 4x4+)
  // Regular is allowed if widget can be larger than minimal sizes
  // This includes: 4x4+, or any size that doesn't match minimal constraints
  if (maxW >= 4 || maxH >= 4 || (minW > 2 || minH > 2)) {
    allowed.push('regular');
  }
  
  // If somehow no categories are allowed, default to regular
  if (allowed.length === 0) {
    allowed.push('regular');
  }
  
  return allowed;
};

const createWidget = (type: WidgetType, w: number, h: number): DashboardWidget => {
  return {
    id: `${type}-${w}x${h}`,
    type,
    x: 0,
    y: 0,
    w,
    h,
    minW: 1, 
    minH: 1,
    maxW: 12,
    maxH: 12,
    config: WIDGET_DEFINITIONS[type].defaultConfig
  };
};

export default function WidgetVisualizerPage() {
  const GRID_UNIT_PX = 80; // Increased to 80px for better visibility
  const [selectedWidget, setSelectedWidget] = useState<WidgetType>(ALL_WIDGET_TYPES[0]);

  // Helper to get category color
  const getCategoryColor = (category: WidgetLayoutCategory) => {
    return category === 'minimal' ? 'text-orange-500' :
           category === 'minimal-vertical' ? 'text-purple-500' :
           category === 'minimal-horizontal' ? 'text-cyan-500' :
           'text-blue-500'; // regular
  };

  // Helper to get category label
  const getCategoryLabel = (category: WidgetLayoutCategory) => {
    return category === 'minimal' ? 'minimal' :
           category === 'minimal-vertical' ? 'min-vertical' :
           category === 'minimal-horizontal' ? 'min-horizontal' :
           'regular';
  };

  // Get widget info for selected widget
  const def = WIDGET_DEFINITIONS[selectedWidget];
  const minW = def.minW * GRID_SCALE;
  const maxW = def.maxW * GRID_SCALE;
  const minH = def.minH * GRID_SCALE;
  const maxH = def.maxH * GRID_SCALE;
  const allowedCategories = getAllowedCategories(selectedWidget);

  // Generate all sizes for selected widget
  const sizes: { w: number; h: number; category: WidgetLayoutCategory }[] = [];
  for (let w = minW; w <= maxW; w++) {
    for (let h = minH; h <= maxH; h++) {
      const widget = createWidget(selectedWidget, w, h);
      const category = getWidgetLayoutCategory(widget);
      sizes.push({ w, h, category });
    }
  }

  // Sort by category order, then by area, then by width
  const categoryOrder: Record<WidgetLayoutCategory, number> = {
    'minimal': 1,
    'minimal-vertical': 2,
    'minimal-horizontal': 3,
    'regular': 4
  };
  
  sizes.sort((a, b) => {
    const orderDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (orderDiff !== 0) return orderDiff;
    const areaDiff = (a.w * a.h) - (b.w * b.h);
    if (areaDiff !== 0) return areaDiff;
    return a.w - b.w;
  });

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Widget Visualizer</h1>
        <p className="text-muted-foreground mt-2">
          Visualizing all dashboard widgets in their various sizes.
          <br />
          <strong>Unit Scale:</strong> Grid Units (12-column grid system).
          <br />
          Grid Scale = {GRID_SCALE} (Logical 1x1 = Grid {GRID_SCALE}x{GRID_SCALE})
        </p>
      </div>

      <Tabs value={selectedWidget} onValueChange={(value) => setSelectedWidget(value as WidgetType)} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 h-auto p-1">
          {ALL_WIDGET_TYPES.map((type) => (
            <TabsTrigger 
              key={type} 
              value={type} 
              className="text-xs px-2 py-2 whitespace-nowrap"
            >
              {WIDGET_DEFINITIONS[type].title}
            </TabsTrigger>
          ))}
        </TabsList>

        {ALL_WIDGET_TYPES.map((type) => {
          const widgetDef = WIDGET_DEFINITIONS[type];
          const widgetMinW = widgetDef.minW * GRID_SCALE;
          const widgetMaxW = widgetDef.maxW * GRID_SCALE;
          const widgetMinH = widgetDef.minH * GRID_SCALE;
          const widgetMaxH = widgetDef.maxH * GRID_SCALE;
          const widgetAllowedCategories = getAllowedCategories(type);

          // Generate sizes for this widget
          const widgetSizes: { w: number; h: number; category: WidgetLayoutCategory }[] = [];
          for (let w = widgetMinW; w <= widgetMaxW; w++) {
            for (let h = widgetMinH; h <= widgetMaxH; h++) {
              const widget = createWidget(type, w, h);
              const category = getWidgetLayoutCategory(widget);
              widgetSizes.push({ w, h, category });
            }
          }

          // Sort by category order, then by area, then by width
          widgetSizes.sort((a, b) => {
            const orderDiff = categoryOrder[a.category] - categoryOrder[b.category];
            if (orderDiff !== 0) return orderDiff;
            const areaDiff = (a.w * a.h) - (b.w * b.h);
            if (areaDiff !== 0) return areaDiff;
            return a.w - b.w;
          });

          return (
            <TabsContent key={type} value={type} className="space-y-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-4 border-b pb-4">
                <div>
                  <h2 className="text-2xl font-semibold capitalize">{widgetDef.title}</h2>
                  <p className="text-muted-foreground mt-1">{widgetDef.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="font-mono bg-muted px-2 py-1 rounded">Type: {type}</span>
                  <span className="font-mono bg-muted px-2 py-1 rounded">Grid: {widgetMinW}-{widgetMaxW}W × {widgetMinH}-{widgetMaxH}H</span>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="text-sm font-semibold mb-2">Allowed Layout Categories:</div>
                <div className="flex flex-wrap gap-2">
                  {widgetAllowedCategories.length > 0 ? (
                    widgetAllowedCategories.map((category) => (
                      <span
                        key={category}
                        className={`px-3 py-1 rounded-md text-xs font-semibold uppercase ${getCategoryColor(category)} bg-background border`}
                      >
                        {getCategoryLabel(category)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">None (widget constraints prevent standard categories)</span>
                  )}
                </div>
                {widgetAllowedCategories.length < 4 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Note: This widget has minimum size constraints that prevent some layout categories.
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-12 items-end">
                {widgetSizes.map((size, index) => {
                  const widget = createWidget(type, size.w, size.h);
                  
                  // Explicit pixel dimensions for visualization
                  const widthPx = size.w * GRID_UNIT_PX;
                  const heightPx = size.h * GRID_UNIT_PX;
                  
                  return (
                    <div key={`${type}-${index}`} className="flex flex-col gap-2 group">
                      <div className="flex justify-between items-center text-xs text-muted-foreground uppercase tracking-wider font-bold w-[var(--width)]" style={{ '--width': `${widthPx}px` } as React.CSSProperties}>
                         <span>{size.w}x{size.h}</span>
                         <span className={getCategoryColor(size.category)}>{getCategoryLabel(size.category)}</span>
                      </div>
                      
                      {/* Fixed size container representing the grid dimensions */}
                      <div 
                          className="bg-background border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md hover:ring-2 ring-primary/20"
                          style={{ 
                              width: `${widthPx}px`, 
                              height: `${heightPx}px`,
                              minWidth: `${widthPx}px`, // prevent shrinking
                          }}
                      >
                          <WidgetRenderer widget={widget} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
