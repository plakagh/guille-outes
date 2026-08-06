"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CameraIcon } from "@/components/icons";
import { PublishDialog } from "@/components/gallery/publish-dialog";
import { Button } from "@/components/ui/button";
import { ARTWORK_MAX_BYTES, isArtworkType } from "@/lib/gallery/model";

type Chosen = { file: File; url: string; width: number; height: number };

/**
 * "Sube una foto de tu dibujo."
 *
 * A file input and nothing more clever. On a phone or a tablet — which is every
 * device this will be used on, at a stand, standing up — the native picker
 * already offers the camera, the gallery and the recent photos; a custom
 * drag-and-drop zone would be worse at all three and would not work at all with
 * a thumb.
 *
 * `capture` is deliberately **not** set. It forces the camera and removes the
 * choice, and half the time the drawing was photographed ten minutes ago in the
 * queue.
 */
export function UploadPanel({
  signedIn,
  returnTo,
  privacyHref,
}: {
  signedIn: boolean;
  returnTo: string;
  privacyHref: string;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [error, setError] = useState<"unsupported_type" | "too_large" | null>(null);
  const [open, setOpen] = useState(false);

  /*
    An object URL is a live handle on a file, not a string: nothing frees it but
    an explicit revoke, so a child who tries six photos would otherwise leave six
    of them pinned in memory. It is created and released where the file changes —
    an event handler — rather than in an effect keyed on the file, which would
    make the preview arrive one render after the file it belongs to.
  */
  const openRef = useRef<string | null>(null);

  const replace = (next: Chosen | null) => {
    if (openRef.current) URL.revokeObjectURL(openRef.current);
    openRef.current = next?.url ?? null;
    setChosen(next);
  };

  // The last one outlives every handler, so the unmount path has to free it too.
  useEffect(() => {
    return () => {
      if (openRef.current) URL.revokeObjectURL(openRef.current);
    };
  }, []);

  const choose = async (file: File | undefined) => {
    setError(null);
    if (!file) return;

    // Checked here for a useful message, and again in the Server Action and in
    // the bucket, which are the two that actually decide.
    if (!isArtworkType(file.type)) {
      setError("unsupported_type");
      replace(null);
      return;
    }
    if (file.size > ARTWORK_MAX_BYTES) {
      setError("too_large");
      replace(null);
      return;
    }

    const size = await readDimensions(file);
    replace({
      file,
      url: URL.createObjectURL(file),
      width: size?.width ?? 1000,
      height: size?.height ?? 1000,
    });
    setOpen(true);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(event) => void choose(event.target.files?.[0])}
      />

      <Button type="button" size="lg" variant="outline" onClick={() => inputRef.current?.click()}>
        <CameraIcon className="size-5" />
        {t.gallery.uploadCta}
      </Button>

      {error && (
        <p role="alert" className="mt-3 text-[0.875rem] font-semibold text-flame">
          {t.gallery.errors[error === "too_large" ? "tooLarge" : "unsupportedType"]}
        </p>
      )}

      <PublishDialog
        open={open}
        onClose={() => {
          setOpen(false);
          // Clearing the input matters: picking the same file twice fires no
          // `change` event otherwise, so a second attempt would do nothing.
          if (inputRef.current) inputRef.current.value = "";
          replace(null);
        }}
        origin="upload"
        previewUrl={chosen?.url ?? null}
        signedIn={signedIn}
        returnTo={returnTo}
        privacyHref={privacyHref}
        makeFile={async () =>
          chosen ? { file: chosen.file, width: chosen.width, height: chosen.height } : null
        }
      />
    </div>
  );
}

/**
 * The image's real dimensions, for the aspect ratio the gallery tile reserves.
 *
 * Display metadata and nothing else — the server clamps whatever arrives — so
 * failing to read it is not an error, just a square guess.
 */
async function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
