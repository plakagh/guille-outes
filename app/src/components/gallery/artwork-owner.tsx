"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n/provider";
import { EyeIcon, EyeOffIcon, TrashIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { deleteArtwork, setArtworkVisibility, updateArtwork } from "@/lib/gallery/actions";
import { AGE_MAX, AGE_MIN, AUTHOR_NAME_MAX, TITLE_MAX } from "@/lib/gallery/model";
import type { Artwork } from "@/lib/db/gallery";

/**
 * What the family that published a drawing can do with it afterwards.
 *
 * Three things, and they are deliberately three rather than one "manage" screen:
 * correct the title or the name, take it off the wall, and erase it. The middle
 * one is reversible and the last one is not, so they do not share a button.
 *
 * Withdrawal has to be as easy as consent was (RGPD Art. 7(3)), which is why
 * "quitar de la galería" is one click on the drawing itself and not a form
 * buried in the account area — though it is there too.
 */
export function ArtworkOwnerPanel({ artwork }: { artwork: Artwork }) {
  const { t, href } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const o = t.gallery.owner;

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("id", artwork.id);

    start(async () => {
      const result = await updateArtwork(form);
      setMessage(result.ok ? o.saved : t.gallery.errors[errorKey(result.error)]);
      if (result.ok) router.refresh();
    });
  };

  const toggle = () => {
    const form = new FormData();
    form.set("id", artwork.id);
    form.set("publish", String(artwork.status !== "published"));

    start(async () => {
      await setArtworkVisibility(form);
      router.refresh();
    });
  };

  const erase = () => {
    const form = new FormData();
    form.set("id", artwork.id);

    start(async () => {
      const result = await deleteArtwork(form);
      if (result.ok) router.push(href("gallery"));
    });
  };

  return (
    <section className="border border-line bg-shell p-5">
      <h2 className="text-xl">{o.title}</h2>
      <p className="mt-1 text-[0.8125rem] text-mute">{o.blurb}</p>

      <form onSubmit={save} className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-[0.75rem] font-semibold uppercase tracking-wide text-mute">
            {t.gallery.publish.titleLabel}
          </span>
          <input
            name="title"
            defaultValue={artwork.title}
            required
            maxLength={TITLE_MAX}
            className="h-11 w-full border border-line bg-white px-3 text-[0.9375rem] focus:border-ink focus:outline-none"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold uppercase tracking-wide text-mute">
              {t.gallery.publish.nameLabel}
            </span>
            <input
              name="author_name"
              defaultValue={artwork.authorName}
              required
              maxLength={AUTHOR_NAME_MAX}
              className="h-11 w-full border border-line bg-white px-3 text-[0.9375rem] focus:border-ink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold uppercase tracking-wide text-mute">
              {t.gallery.publish.ageLabel}
            </span>
            <input
              name="author_age"
              type="number"
              min={AGE_MIN}
              max={AGE_MAX}
              defaultValue={artwork.authorAge ?? ""}
              className="h-11 w-full border border-line bg-white px-3 text-[0.9375rem] focus:border-ink focus:outline-none"
            />
          </label>
        </div>

        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {o.save}
        </Button>
        {message && <p className="text-[0.8125rem] font-semibold text-pine">{message}</p>}
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {/*
          A drawing the shop retired stays retired: the owner's update policy
          refuses those rows outright, so offering the button would be offering
          something that cannot work.
        */}
        {!artwork.hiddenByAdmin && (
          <Button type="button" size="sm" variant="ghost" onClick={toggle} disabled={pending}>
            {artwork.status === "published" ? (
              <>
                <EyeOffIcon className="size-4" />
                {o.hide}
              </>
            ) : (
              <>
                <EyeIcon className="size-4" />
                {o.show}
              </>
            )}
          </Button>
        )}

        {confirming ? (
          <>
            <Button type="button" size="sm" variant="sale" onClick={erase} disabled={pending}>
              {o.deleteConfirm}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {t.common.close}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirming(true)}
            disabled={pending}
          >
            <TrashIcon className="size-4" />
            {o.delete}
          </Button>
        )}
      </div>

      {artwork.hiddenByAdmin && (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-mute">{o.retiredNote}</p>
      )}
      <p className="mt-3 text-[0.75rem] leading-relaxed text-mute">{o.deleteNote}</p>
    </section>
  );
}

/** Only the field errors can reach this panel; the rest are impossible here. */
function errorKey(error: string): "titleEmpty" | "nameEmpty" | "nameFullName" | "ageRange" | "unknown" {
  if (error === "title_empty" || error === "title_too_long") return "titleEmpty";
  if (error === "name_empty" || error === "name_too_long") return "nameEmpty";
  if (error === "name_looks_like_full_name") return "nameFullName";
  if (error === "age_out_of_range") return "ageRange";
  return "unknown";
}
