import type { MetadataRoute } from "next";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

/**
 * The web app manifest — what Android uses for the home-screen icon, and what
 * makes the shop installable.
 *
 * There is one manifest for three languages, so it takes the default locale's
 * copy: the name of a shop is a proper noun that does not translate, and the
 * only other string here is the tagline under the icon.
 *
 * `start_url` is the bare root rather than a locale path. `proxy.ts` sends it
 * on to `/es`, `/gl` or `/en` by the same rules as any other visit, so an
 * installed icon opens the language the visitor actually reads instead of the
 * one they happened to be on when they installed it.
 *
 * `purpose: "any"` — not `"maskable"`, which is what the generator suggested.
 * A maskable icon is cropped to whatever shape the platform likes (a circle on
 * most Androids) and is only safe if the art keeps clear of the outer fifth.
 * This one is a cut-out with horns that run to the top edge and a tongue that
 * runs off the bottom, so masking it would trim both.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getDictionary(DEFAULT_LOCALE);

  return {
    name: `${t.meta.siteName} — ${t.meta.tagline}`,
    short_name: t.meta.siteName,
    description: t.meta.description,
    start_url: "/",
    display: "standalone",
    // The same black the browser chrome is told to take in `layout.tsx`.
    theme_color: "#000000",
    background_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
