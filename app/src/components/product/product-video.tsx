"use client";

import { useState } from "react";
import { PlayIcon } from "@/components/icons";
import type { ProductVideo as Video } from "@/lib/catalog";
import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * The product video, when there is one.
 *
 * Nothing is rendered unless the product carries a playable address — the caller
 * decides that by passing a video at all — and the caption below it disappears on
 * its own when nobody wrote one. Half-filled means half-shown, never an empty box.
 *
 * A YouTube or Vimeo embed is *not* mounted on page load: the iframe only appears
 * once the shopper asks for it. Two reasons, and both matter here. It keeps a
 * third-party player (and its cookies) off a page nobody has consented to be
 * tracked on, and it keeps the weight of the platform's JavaScript out of a
 * product page that already renders its own artwork. A self-hosted file has no
 * third party to keep out, so it is a plain `<video>` with `preload="metadata"`:
 * enough to show the controls and the duration, not enough to download the film.
 */
export function ProductVideo({
  video,
  t,
  productName,
}: {
  video: Video;
  t: Dictionary;
  productName: string;
}) {
  const [playing, setPlaying] = useState(false);
  const embedded = video.provider !== "file";

  return (
    <figure className="border border-line">
      <div className="relative aspect-video bg-ink">
        {video.provider === "file" ? (
          <video
            src={video.src}
            controls
            preload="metadata"
            playsInline
            className="h-full w-full bg-ink"
          >
            {/* A browser that cannot play the file still gets somewhere to go. */}
            <a href={video.url}>{t.pdp.videoHeading}</a>
          </video>
        ) : playing ? (
          <iframe
            // Both embeds are built with a query string, so `&` is always right.
            src={`${video.src}&autoplay=1`}
            title={`${t.pdp.videoHeading} — ${productName}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 grid place-items-center text-white"
          >
            <span className="grid size-16 place-items-center rounded-full border-2 border-white/70 transition group-hover:scale-110 group-hover:border-white group-hover:bg-white group-hover:text-ink">
              <PlayIcon className="ml-0.5 size-7" />
            </span>
            <span className="eyebrow mt-3">{t.pdp.videoPlay}</span>
          </button>
        )}
      </div>

      {(video.caption || embedded) && (
        <figcaption className="space-y-1 p-3">
          {video.caption && (
            <p className="text-[0.875rem] leading-relaxed text-ink/75">{video.caption}</p>
          )}
          {embedded && !playing && (
            <p className="text-[0.75rem] text-mute">{t.pdp.videoPrivacy}</p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
