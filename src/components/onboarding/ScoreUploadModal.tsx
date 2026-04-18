"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ScoreUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
}

export function ScoreUploadModal({ isOpen, onClose, onFileSelect }: ScoreUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles?.length) {
      const droppedFile = droppedFiles[0];
      if (droppedFile.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setFile(droppedFile);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleConfirm = () => {
    if (file) {
      onFileSelect(file);
      onClose();
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload SAT Scores</DialogTitle>
          <DialogDescription>
            Upload your CollegeBoard SAT scores report PDF. We'll automatically extract your scores.
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <div
            className={cn(
              "mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors duration-200",
              isDragging
                ? "border-blue-500 bg-blue-50/50"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-800"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50">
              <Upload className="h-6 w-6" />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Drag and drop your PDF here
              </p>
              <p className="mt-1 text-xs text-gray-500">or</p>
              <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900">
                <span>Browse files</span>
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handleFileInput}
                />
              </label>
            </div>
            <p className="mt-4 text-xs text-gray-400">PDF up to 10MB</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/50">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {file.name}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!file}>
            Process Scores
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
