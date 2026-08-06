"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n/provider";
import { EyeIcon, EyeOffIcon, TrashIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { removeArtwork, restoreArtwork, retireArtwork } from "@/lib/admin/gallery-actions";

/**
 * The three moderation buttons, on one row of the list.
 *
 * Retire and restore are one toggle because they are one decision. Delete is
 * separate and asks a second time, because it is the only one of the three that
 * cannot be walked back — and unlike the family's own delete, it removes
 * somebody else's child's drawing.
 */
export function ArtworkModeration({
  id,
  retired,
}: {
  id: string;
  /** `hidden_by_admin`: the shop took it down, rather than the family. */
  retired: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const a = t.gallery.admin;

  const run = (action: (form: FormData) => Promise<unknown>) => {
    const form = new FormData();
    form.set("id", id);
    start(async () => {
      await action(form);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {retired ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(restoreArtwork)}
        >
          <EyeIcon className="size-4" />
          {a.restore}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(retireArtwork)}
        >
          <EyeOffIcon className="size-4" />
          {a.retire}
        </Button>
      )}

      {confirming ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="sale"
            disabled={pending}
            onClick={() => run(removeArtwork)}
          >
            {a.deleteConfirm}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            {t.common.close}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <TrashIcon className="size-4" />
          {a.delete}
        </Button>
      )}
    </div>
  );
}
