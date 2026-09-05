"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Upload } from "lucide-react";
import { updateAvatarAction, type UpdateAvatarState } from "@/lib/account/update-avatar";

const OUTPUT_SIZE = 320;
const initialState: UpdateAvatarState = { status: "idle" };

// Reads the chosen file into an <img>, then draws it into a square canvas
// with the shorter edge cropped to center -- a plain center-crop-to-square
// rather than a draggable crop UI, since the project has no cropping library.
function cropToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="gap-2">
      <Upload className="h-4 w-4" />
      {pending ? "Saving..." : "Save Avatar"}
    </Button>
  );
}

export function AvatarPicker({
  initialAvatar,
  fallbackText,
  onSaved,
}: {
  initialAvatar: string | null;
  fallbackText: string;
  onSaved?: () => void;
}) {
  const [state, formAction] = useActionState(async (prev: UpdateAvatarState, formData: FormData) => {
    const result = await updateAvatarAction(prev, formData);
    if (result.status === "success") onSaved?.();
    return result;
  }, initialState);
  const [preview, setPreview] = useState<string | null>(initialAvatar);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    try {
      const dataUrl = await cropToSquareDataUrl(file);
      setPreview(dataUrl);
      setError(null);
    } catch {
      setError("Could not process that image. Try a different file.");
    }
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <Avatar size="lg" className="h-16 w-16">
        <AvatarImage src={preview ?? undefined} alt="Avatar preview" />
        <AvatarFallback className="text-lg">{fallbackText}</AvatarFallback>
      </Avatar>
      <div className="flex flex-1 flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-2 file:border-brand-primary file:bg-transparent file:px-3 file:py-1.5 file:font-heading file:text-xs file:font-semibold file:tracking-wide file:text-brand-primary file:uppercase hover:file:bg-brand-primary/10"
        />
        {error && (
          <p className="flex items-center gap-2 text-sm text-rose-600">
            <ShieldAlert className="h-4 w-4" />
            {error}
          </p>
        )}
        {state.status === "error" && (
          <p className="flex items-center gap-2 text-sm text-rose-600">
            <ShieldAlert className="h-4 w-4" />
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <p className="text-sm text-emerald-600">{state.message}</p>
        )}
        <input type="hidden" name="avatarDataUrl" value={preview ?? ""} />
        <div>
          <SaveButton disabled={!preview || preview === initialAvatar} />
        </div>
      </div>
    </form>
  );
}
