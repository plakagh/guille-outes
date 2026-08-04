"use client";

import { useTransition } from "react";
import { setPublished } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

/** Optimistic-free toggle: submits, then the page re-renders from the database. */
export function PublishToggle({
  id,
  published,
  labels,
}: {
  id: string;
  published: boolean;
  labels: { publish: string; unpublish: string };
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const form = new FormData();
          form.set("id", id);
          form.set("published", String(!published));
          await setPublished(form);
        })
      }
      aria-pressed={published}
      className={cn(
        "inline-flex h-8 items-center gap-2 border px-3 text-[0.75rem] font-bold uppercase tracking-wide transition disabled:opacity-50",
        published ? "border-pine text-pine hover:bg-pine hover:text-white" : "border-line text-mute hover:border-ink hover:text-ink",
      )}
    >
      <span
        className={cn("size-2 rounded-full", published ? "bg-pine" : "bg-mute-soft")}
        aria-hidden="true"
      />
      {published ? labels.unpublish : labels.publish}
    </button>
  );
}
