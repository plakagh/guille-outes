import assert from "node:assert/strict";
import test from "node:test";
import { parseProductVideo, parseVideoUrl } from "./catalog.ts";

/**
 * The product video is the one field where a shop types a raw address and the
 * storefront hands it to the browser. What matters is that only the three shapes
 * we know how to play get through, and that nothing else does — an unplayable src
 * would render a video zone that never starts, which is precisely what the field
 * is supposed to avoid.
 */

test("a YouTube video is recognised in every shape it is shared in", () => {
  const expected = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";

  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ]) {
    assert.deepEqual(parseVideoUrl(url), { provider: "youtube", src: expected, url }, url);
  }
});

test("Vimeo, from the page or from the player", () => {
  for (const url of ["https://vimeo.com/347119375", "https://player.vimeo.com/video/347119375"]) {
    assert.deepEqual(
      parseVideoUrl(url),
      { provider: "vimeo", src: "https://player.vimeo.com/video/347119375?dnt=1", url },
      url,
    );
  }
});

test("a self-hosted file is played as it is", () => {
  const url = "https://cdn.example.com/videos/taller.mp4";
  assert.deepEqual(parseVideoUrl(url), { provider: "file", src: url, url });
});

test("anything we cannot play is refused rather than stored", () => {
  for (const url of [
    "",
    "   ",
    "not a url",
    // http would break a page served over https.
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    // Not a video address, just the platform.
    "https://www.youtube.com/",
    "https://vimeo.com/guilleoutes",
    // A page about a video is not a video.
    "https://example.com/nuestro-taller",
    // The whole point of the protocol check.
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
  ]) {
    assert.equal(parseVideoUrl(url), null, url);
  }
});

test("the caption is optional, and blank means none at all", () => {
  const url = "https://youtu.be/dQw4w9WgXcQ";

  assert.equal(parseProductVideo(url, "  ")?.caption, null);
  assert.equal(parseProductVideo(url, " Grabado en el taller ")?.caption, "Grabado en el taller");

  // No video, no zone — a caption on its own is not something to show.
  assert.equal(parseProductVideo(null, "Grabado en el taller"), null);
  assert.equal(parseProductVideo("", "Grabado en el taller"), null);
});
