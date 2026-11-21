"use client";

import { useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";

const MAX_SIDE = 1600;

/**
 * Camera or gallery. With JS the photo is shrunk to ≤1600 px JPEG (a phone photo of 4 MB
 * becomes ~200 KB) and put back into the same file input; without JS the original uploads.
 */
export function BillPhoto({
  label,
  help,
  error,
}: {
  label: string;
  help: string;
  error?: string | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return setPreview(null);
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    if (!blob || !inputRef.current) return;
    const small = new File([blob], "bill.jpg", { type: "image/jpeg" });
    const list = new DataTransfer();
    list.items.add(small);
    inputRef.current.files = list.files;
    setPreview(URL.createObjectURL(small));
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-[15px] font-semibold">{label}</span>
      <label className="flex min-h-24 cursor-pointer items-center gap-4 rounded-field border-2 border-dashed border-rule-strong bg-card p-3 hover:border-signal has-focus-visible:outline-3 has-focus-visible:outline-signal">
        {preview ? (
          // Local blob preview: next/image can't optimise object URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-20 rounded-lg object-cover" />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-lg bg-paper-deep text-ink-2">
            <Icon name="camera" size={30} />
          </span>
        )}
        <span className="text-[14px] text-ink-2">{help}</span>
        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept="image/*"
          capture="environment"
          onChange={onPick}
          className="sr-only"
        />
      </label>
      {error ? <p className="text-[14px] font-semibold text-due">{error}</p> : null}
    </div>
  );
}
