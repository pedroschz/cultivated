"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, HelpCircle, Trash2 } from "lucide-react";
import { app } from '@/lib/firebaseClient';
import { getAuth } from "firebase/auth";

type AnnotationRect = {
  left: number; // relative to container
  top: number; // relative to container
  width: number;
  height: number;
};

type Annotation = {
  id: string;
  rects: AnnotationRect[];
  comment?: string;
  selectedText?: string;
  helpLoading?: boolean;
  helpError?: string;
  helpContent?: string;
};

interface TextAnnotatorProps {
  children: React.ReactNode;
  className?: string;
  questionContext?: string;
  passageContext?: string;
  studentRegion?: string;
  onHighlightsChange?: (highlights: string[]) => void;
  disabled?: boolean; // When true, disables all selection/highlighting features
}

function computeUnionBox(rects: AnnotationRect[]): AnnotationRect {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}

function rectIntersectionArea(a: AnnotationRect, b: AnnotationRect): number {
  const x1 = Math.max(a.left, b.left);
  const y1 = Math.max(a.top, b.top);
  const x2 = Math.min(a.left + a.width, b.left + b.width);
  const y2 = Math.min(a.top + a.height, b.top + b.height);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  return w * h;
}

function iou(a: AnnotationRect, b: AnnotationRect): number {
  const inter = rectIntersectionArea(a, b);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

export function TextAnnotator({ children, className, questionContext, passageContext, studentRegion, onHighlightsChange, disabled = false }: TextAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showToolsForId, setShowToolsForId] = useState<string | null>(null);
  const showToolsTimeoutRef = useRef<number | null>(null);
  const lastHighlightsCsvRef = useRef<string>("");

  const HOVER_SAFE_PX = 20;

  const clearShowToolsException = useCallback((id?: string) => {
    setShowToolsForId((cur) => (id && cur === id ? null : cur));
    if (showToolsTimeoutRef.current) {
      window.clearTimeout(showToolsTimeoutRef.current);
      showToolsTimeoutRef.current = null;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    // Ensure selection is inside our container
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return;
    if (!container.contains(anchorNode) || !container.contains(focusNode)) return;

    // Gather rects relative to container
    const range = selection.getRangeAt(0);
    const clientRects = Array.from(range.getClientRects());
    const containerRect = container.getBoundingClientRect();
    const rects: AnnotationRect[] = clientRects
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => ({
        left: r.left - containerRect.left,
        top: r.top - containerRect.top,
        width: r.width,
        height: r.height,
      }));

    // Capture selected text before clearing selection
    const selectedText = (range.cloneContents().textContent || selection.toString() || '').trim();

    // Clear selection immediately
    selection.removeAllRanges();

    if (rects.length === 0) return;

    // Add a new annotation (do not auto-open editor; only open on pencil click)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAnnotations((prev) => [...prev, { id, rects, selectedText }]);

    // Briefly show tools even if not hovering right after selection
    if (showToolsTimeoutRef.current) {
      window.clearTimeout(showToolsTimeoutRef.current);
      showToolsTimeoutRef.current = null;
    }
    setShowToolsForId(id);
    showToolsTimeoutRef.current = window.setTimeout(() => {
      setShowToolsForId((cur) => (cur === id ? null : cur));
      showToolsTimeoutRef.current = null;
    }, 2000);
  }, [annotations]);

  const handleSaveComment = useCallback((id: string, value: string) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, comment: value.trim() || undefined } : a)));
    setActiveEditorId(null);
  }, []);

  const handleCancelEdit = useCallback(() => setActiveEditorId(null), []);

  const requestHelp = useCallback(async (ann: Annotation) => {
    // Start loading state
    setAnnotations((prev) => prev.map((a) => (a.id === ann.id ? { ...a, helpLoading: true, helpError: undefined } : a)));
    try {
      if (!app) throw new Error('Firebase app not initialized');
      const auth = getAuth(app);
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        // Fallback for unauthenticated users if needed, or throw error
        throw new Error('Please sign in to get AI help');
      }

      const res = await fetch('/api/tutor/help', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          questionContext: questionContext || '',
          passageContext: passageContext || '',
          selectedText: ann.selectedText || '',
          studentRegion: studentRegion || ''
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      const text = data.text || '';

      setAnnotations((prev) => prev.map((a) => (a.id === ann.id ? { ...a, helpLoading: false, helpContent: text } : a)));
    } catch (e: any) {
      setAnnotations((prev) => prev.map((a) => (a.id === ann.id ? { ...a, helpLoading: false, helpError: e?.message || 'Failed to fetch context' } : a)));
    }
  }, [passageContext, questionContext, studentRegion]);

  const renderedOverlays = useMemo(() => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    return annotations.map((ann) => {
      const union = computeUnionBox(ann.rects);
      const isEditing = activeEditorId === ann.id;
      const isHovered = hoveredId === ann.id;
      const shouldShowTools = isHovered || isEditing || showToolsForId === ann.id;

      return (
        <React.Fragment key={ann.id}>
          {/* Hover-safe hitbox around the whole selection */}
          <div
            key={`${ann.id}-hitbox`}
            onMouseEnter={() => setHoveredId(ann.id)}
            onMouseLeave={() => {
              setHoveredId((cur) => (cur === ann.id ? null : cur));
              clearShowToolsException(ann.id);
            }}
            style={{
              position: "absolute",
              left: union.left - HOVER_SAFE_PX,
              top: union.top - HOVER_SAFE_PX,
              width: union.width + HOVER_SAFE_PX * 2,
              height: union.height + HOVER_SAFE_PX * 2,
              pointerEvents: "auto",
              background: "transparent",
              zIndex: 1,
            }}
          />

          {ann.rects.map((r, idx) => (
            <div
              key={`${ann.id}-rect-${idx}`}
              onMouseEnter={() => setHoveredId(ann.id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === ann.id ? null : cur))}
              style={{
                position: "absolute",
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
                background: "rgba(88, 204, 2, 0.3)", // flat green highlight
                borderRadius: 4,
                pointerEvents: "auto",
              }}
            />
          ))}

          {/* Action buttons (only visible on hover or while editing), rendered via portal to escape clipping */}
          {shouldShowTools && containerRect && createPortal(
            (
              <div
                onMouseEnter={() => setHoveredId(ann.id)}
                onMouseLeave={() => {
                  setHoveredId((cur) => (cur === ann.id ? null : cur));
                  clearShowToolsException(ann.id);
                }}
                style={{
                  position: "fixed",
                  left: containerRect.left + union.left + union.width + 6,
                  top: containerRect.top + union.top - 18,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  zIndex: 9999,
                  pointerEvents: "auto",
                }}
              >
                <button
                  type="button"
                  aria-label="Add comment"
                  onClick={() => setActiveEditorId(ann.id)}
                  style={{
                    width: 24,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 9999,
                    background: "#FFFFFF",
                    border: "2px solid #E5E5E5",
                    color: "#4B4B4B",
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={() => requestHelp(ann)}
                  style={{
                    width: 24,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 9999,
                    background: "#FFFFFF",
                    border: "2px solid #E5E5E5",
                    color: "#4B4B4B",
                  }}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete highlight"
                  onClick={() => {
                    setAnnotations((prev) => prev.filter((a) => a.id !== ann.id));
                    if (activeEditorId === ann.id) setActiveEditorId(null);
                    if (hoveredId === ann.id) setHoveredId(null);
                    if (showToolsForId === ann.id) setShowToolsForId(null);
                  }}
                  style={{
                    width: 24,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 9999,
                    background: "#FFFFFF",
                    border: "2px solid #E5E5E5",
                    color: "#FF4B4B",
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
            document.body
          )}

          {/* Inline editor (ported to body to avoid cropping) */}
          {isEditing && containerRect && createPortal(
            (
              <div
                style={{
                  position: "fixed",
                  left: Math.max(8, containerRect.left + union.left),
                  top: containerRect.top + union.top + union.height + 8,
                  zIndex: 10000,
                  background: "#FFFFFF",
                  border: "2px solid #E5E5E5",
                  borderBottomWidth: "4px",
                  borderRadius: 16,
                  padding: 8,
                  width: Math.min(360, Math.max(220, union.width)),
                  pointerEvents: "auto",
                  color: "#4B4B4B",
                }}
              >
                <div className="space-y-2">
                  <textarea
                    defaultValue={ann.comment || ""}
                    placeholder="Add a note..."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 12,
                      border: "2px solid #E5E5E5",
                      background: "#FFFFFF",
                      color: "#4B4B4B",
                      resize: "vertical",
                      outline: "none"
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setActiveEditorId(null);
                      }
                    }}
                    id={`annotator-textarea-${ann.id}`}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleCancelEdit()}
                      className="text-sm px-3 py-1 rounded-xl border-2 border-[#E5E5E5] border-b-4 font-bold text-[#777777]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(
                          `annotator-textarea-${ann.id}`
                        ) as HTMLTextAreaElement | null;
                        handleSaveComment(ann.id, el?.value || "");
                      }}
                      className="text-sm px-3 py-1 rounded-xl border-0 border-b-[4px] border-b-[#79b933] bg-[#93d333] text-white font-bold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Hover tooltip showing saved note, rendered via portal to escape clipping */}
          {isHovered && ann.comment && !isEditing && containerRect && createPortal(
            (
              <div
                style={{
                  position: "fixed",
                  left: Math.max(24, containerRect.left + union.left - 8),
                  top: Math.max(24, containerRect.top + union.top - 8),
                  transform: "translate(-100%, -100%)",
                  zIndex: 9999,
                  background: "#FFFFFF",
                  border: "2px solid #E5E5E5",
                  borderBottomWidth: "4px",
                  borderRadius: 16,
                  padding: 8,
                  maxWidth: 360,
                  pointerEvents: "auto",
                  color: "#4B4B4B",
                }}
                onMouseEnter={() => setHoveredId(ann.id)}
                onMouseLeave={() => setHoveredId((cur) => (cur === ann.id ? null : cur))}
              >
                <div className="text-sm text-[#4B4B4B] font-medium">{ann.comment}</div>
              </div>
            ),
            document.body
          )}

          {/* Help response window (appears above tools; only while hovering like tools) */}
          {shouldShowTools && containerRect && (ann.helpLoading || ann.helpContent || ann.helpError) && createPortal(
            (() => {
              const anchorTop = containerRect!.top + union.top - 18;
              const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
              const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
              const popupWidth = 320;
              // space if positioned to the right of the selection
              const rightAnchor = containerRect!.left + union.left + union.width + 6;
              // candidate left when flipping to the left of the selection
              const leftAnchor = Math.max(8, containerRect!.left + union.left - popupWidth - 6);
              // choose side that keeps popup within viewport (prefer right)
              const finalLeft = (rightAnchor + popupWidth <= (viewportWidth - 8)) ? rightAnchor : leftAnchor;
              const availableUp = Math.max(120, Math.min(anchorTop - 24, viewportHeight - 48));
              return (
                <div
                  style={{
                    position: 'fixed',
                    left: finalLeft,
                    top: anchorTop,
                    transform: 'translateY(-100%)',
                    zIndex: 10001,
                    background: '#FFFFFF',
                    backgroundColor: '#FFFFFF',
                    opacity: 1,
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none',
                    willChange: 'transform, opacity',
                    border: '2px solid #E5E5E5',
                    borderBottomWidth: '4px',
                    borderRadius: 16,
                    padding: 10,
                    width: popupWidth,
                    maxHeight: availableUp,
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    wordBreak: 'break-word',
                    pointerEvents: 'auto',
                    color: '#4B4B4B',
                  }}
                >
                  <div className="text-sm text-[#4B4B4B] font-medium">
                    {ann.helpLoading ? 'Getting context…' : ann.helpError ? ann.helpError : ann.helpContent}
                  </div>
                </div>
              );
            })(),
            document.body
          )}
        </React.Fragment>
      );
    });
  }, [annotations, activeEditorId, hoveredId, handleCancelEdit, handleSaveComment]);

  // Report highlight text changes to parent, only when highlights actually change
  useEffect(() => {
    const highlights = Array.from(
      new Set(
        annotations
          .map((a) => (a.selectedText || '').trim())
          .filter((t) => t.length > 0)
      )
    );
    const csv = highlights.join('|');
    if (csv !== lastHighlightsCsvRef.current) {
      lastHighlightsCsvRef.current = csv;
      if (onHighlightsChange) onHighlightsChange(highlights);
    }
  }, [annotations]);

  return (
    <div
      ref={containerRef}
      onMouseUp={disabled ? undefined : handleMouseUp}
      className={className}
      style={{ 
        position: "relative",
        userSelect: disabled ? "none" : "auto",
        WebkitUserSelect: disabled ? "none" : "auto",
      }}
    >
      {children}
      {/* Overlay layer - only render if not disabled */}
      {!disabled && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none", // allow text selection through; overlays enable pointer events individually
          }}
        >
          {renderedOverlays}
        </div>
      )}
    </div>
  );
}

export default TextAnnotator;
