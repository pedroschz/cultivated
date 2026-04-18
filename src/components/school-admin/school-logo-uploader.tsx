"use client";

import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebaseClient";
import Image from "next/image";

interface SchoolLogoUploaderProps {
  schoolId: string | null;
  currentLogoUrl: string | null;
  onLogoUpdated: (url: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function SchoolLogoUploader({ schoolId, currentLogoUrl, onLogoUpdated, isOpen, onClose }: SchoolLogoUploaderProps) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'resize' | null; handle?: 'nw'|'ne'|'sw'|'se'|'n'|'s'|'e'|'w'; startX?: number; startY?: number; startSel?: { x:number; y:number; w:number; h:number } }>({ type: null });

  const VIEW_W = 480;
  const VIEW_H = 360;

  const displayMetrics = useMemo(() => {
    if (!imgNatural) return null;
    const scale = Math.min(VIEW_W / imgNatural.w, VIEW_H / imgNatural.h);
    const imgW = imgNatural.w * scale;
    const imgH = imgNatural.h * scale;
    const imgLeft = (VIEW_W - imgW) / 2;
    const imgTop = (VIEW_H - imgH) / 2;
    return { imgW, imgH, imgLeft, imgTop, scale };
  }, [imgNatural]);

  useEffect(() => {
    if (!displayMetrics || selection) return;
    const { imgW, imgH, imgLeft, imgTop } = displayMetrics;
    const size = Math.min(imgW, imgH) * 0.6;
    const x = imgLeft + (imgW - size) / 2;
    const y = imgTop + (imgH - size) / 2;
    setSelection({ x, y, w: size, h: size });
  }, [displayMetrics, selection]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/png') { toast.error('Please upload a PNG file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('File too large (max 2MB)'); return; }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setImgNatural(null);
    setSelection(null);
  };

  const performCropAndUpload = async () => {
    if (!cropSrc || !imgNatural || !selection || !displayMetrics || !schoolId || !storage || !db) return;
    try {
      setIsUploading(true);
      const { imgLeft, imgTop, scale } = displayMetrics;
      const srcX = Math.max(0, (selection.x - imgLeft) / scale);
      const srcY = Math.max(0, (selection.y - imgTop) / scale);
      const srcW = Math.min(imgNatural.w, selection.w / scale);
      const srcH = Math.min(imgNatural.h, selection.h / scale);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(srcW));
      canvas.height = Math.max(1, Math.round(srcH));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      const img = new window.Image();
      img.src = cropSrc;
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Failed to load image')); });

      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/png'));
      const objectRef = ref(storage, `schools/${schoolId}/logo.png`);
      await uploadBytes(objectRef, blob, { contentType: 'image/png', cacheControl: 'public,max-age=86400' });
      const url = await getDownloadURL(objectRef);
      
      await setDoc(doc(db, 'schools', schoolId), { logoUrl: url, logoUpdatedAt: Date.now() }, { merge: true });
      onLogoUpdated(url);
      toast.success('Logo updated');
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    onClose();
  };

  const clampSelection = (sel: { x:number; y:number; w:number; h:number }) => {
    if (!displayMetrics) return sel;
    const { imgW, imgH, imgLeft, imgTop } = displayMetrics;
    const minW = 32, minH = 32;
    let w = Math.max(minW, Math.min(sel.w, imgW));
    let h = Math.max(minH, Math.min(sel.h, imgH));
    let x = Math.max(imgLeft, Math.min(sel.x, imgLeft + imgW - w));
    let y = Math.max(imgTop, Math.min(sel.y, imgTop + imgH - h));
    return { x, y, w, h };
  };

  const onViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selection) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hSize = 10;
    const { x, y, w, h } = selection;
    if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) {
       setDragMode({ type: 'move', startX: cx, startY: cy, startSel: { ...selection } });
    }
  };

  const onViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragMode.type || !selection) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dx = cx - (dragMode.startX || 0);
    const dy = cy - (dragMode.startY || 0);
    const start = dragMode.startSel || selection;
    if (dragMode.type === 'move') {
      setSelection(clampSelection({ x: start.x + dx, y: start.y + dy, w: start.w, h: start.h }));
    }
  };

  const onViewportMouseUp = () => setDragMode({ type: null });

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cropSrc ? 'Crop logo' : 'Upload school logo'}</DialogTitle>
        </DialogHeader>
        
        {!cropSrc ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-md">
            <p className="mb-4 text-sm text-muted-foreground">Upload a PNG image (max 2MB)</p>
            <Input type="file" accept="image/png" onChange={handleFileChange} />
          </div>
        ) : (
          <div 
            className="relative bg-muted overflow-hidden select-none mx-auto"
            style={{ width: VIEW_W, height: VIEW_H }}
            onMouseDown={onViewportMouseDown}
            onMouseMove={onViewportMouseMove}
            onMouseUp={onViewportMouseUp}
            onMouseLeave={onViewportMouseUp}
          >
             {cropSrc && (
               // eslint-disable-next-line @next/next/no-img-element
               <img 
                 src={cropSrc} 
                 alt="Crop target"
                 onLoad={(e) => setImgNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                 style={{
                    position: 'absolute',
                    left: displayMetrics?.imgLeft,
                    top: displayMetrics?.imgTop,
                    width: displayMetrics?.imgW,
                    height: displayMetrics?.imgH,
                    pointerEvents: 'none'
                 }}
               />
             )}
             {selection && (
               <div 
                 className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                 style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}
               />
             )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={performCropAndUpload} disabled={!cropSrc || isUploading}>
            {isUploading ? 'Uploading...' : 'Save Logo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
