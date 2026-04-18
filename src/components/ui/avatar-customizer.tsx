"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AVATAR_COLORS, AVATAR_EMOJIS, DEFAULT_AVATAR } from "@/lib/constants/avatar";
import { cn } from "@/lib/utils";

interface AvatarCustomizerProps {
  currentIcon?: string;
  currentColor?: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  showPreview?: boolean;
  className?: string;
}

export function AvatarCustomizer({
  currentIcon = DEFAULT_AVATAR.icon,
  currentColor = DEFAULT_AVATAR.color,
  onIconChange,
  onColorChange,
  showPreview = true,
  className
}: AvatarCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'color'>('emoji');

  return (
    <div className={cn("space-y-6", className)}>
      {/* Preview */}
      {showPreview && (
        <div className="flex flex-col items-center space-y-4">
          <Label>Preview</Label>
          <CustomAvatar 
            icon={currentIcon} 
            color={currentColor} 
            size="xl"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <Button
          variant={activeTab === 'emoji' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('emoji')}
          className="flex-1"
        >
          😊 Icon
        </Button>
        <Button
          variant={activeTab === 'color' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('color')}
          className="flex-1"
        >
          🎨 Color
        </Button>
      </div>

      {/* Emoji Selection */}
      {activeTab === 'emoji' && (
        <div className="space-y-3">
          <Label>Choose an emoji</Label>
          <div className="grid grid-cols-8 gap-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
            {AVATAR_EMOJIS.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => onIconChange(emoji)}
                className={cn(
                  "p-2 rounded-lg border-2 transition-all hover:scale-110",
                  currentIcon === emoji 
                    ? "border-primary bg-primary/10 scale-110" 
                    : "border-transparent hover:border-muted-foreground/20"
                )}
              >
                <span className="text-xl">{emoji}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color Selection */}
      {activeTab === 'color' && (
        <div className="space-y-3">
          <Label>Choose a background color</Label>
          <div className="grid grid-cols-8 gap-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
            {AVATAR_COLORS.map((color, index) => (
              <button
                key={`${color}-${index}`}
                onClick={() => onColorChange(color)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                  currentColor === color 
                    ? "border-gray-800 scale-110 ring-2 ring-gray-300" 
                    : "border-gray-300 hover:border-gray-500"
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Random Button */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const randomEmoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
            onIconChange(randomEmoji);
          }}
          className="flex-1"
        >
          Random Icon
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
            onColorChange(randomColor);
          }}
          className="flex-1"
        >
          Random Color
        </Button>
      </div>
    </div>
  );
} 