"use client";

import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  preview: string | null;
  fallbackInitials: string;
  fallbackColor?: string;
  size?: "sm" | "md" | "lg";
  onSelect: (file: File, preview: string) => void;
  onRemove?: () => void;
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-28 w-28",
};

const iconSizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const textSizes = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-3xl",
};

export function AvatarPicker({
  preview,
  fallbackInitials,
  fallbackColor = "bg-blue-500",
  size = "lg",
  onSelect,
  onRemove,
}: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSelect(file, dataUrl);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative group cursor-pointer"
      >
        <Avatar className={cn(sizeClasses[size], "border-2 border-muted")}>
          {preview && <AvatarImage src={preview} alt="Preview" />}
          <AvatarFallback
            className={cn(
              "text-white font-medium",
              textSizes[size],
              fallbackColor
            )}
          >
            {fallbackInitials}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "absolute inset-0 rounded-full flex items-center justify-center",
            "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity",
            !preview && "opacity-100"
          )}
        >
          <Camera className={cn("text-white", iconSizes[size])} />
        </div>
      </button>

      {preview && onRemove && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
