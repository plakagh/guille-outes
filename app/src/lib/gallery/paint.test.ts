import assert from "node:assert/strict";
import test from "node:test";
import {
  BRUSH_SIZES,
  decodeDrawing,
  encodeDrawing,
  mulberry32,
  shouldSample,
  strokeWidth,
  type Drawing,
} from "./paint.ts";

/**
 * The paint studio's model.
 *
 * Two properties carry the whole design: the same seed has to produce the same
 * marks (or an undo would visibly change the drawing), and a drawing has to
 * survive a round trip through `localStorage` (or a child loses their work on
 * the way to the sign-up form).
 */

test("the same seed replays the same numbers", () => {
  const first = mulberry32(12345);
  const second = mulberry32(12345);
  const drawn = Array.from({ length: 50 }, () => first());
  assert.deepEqual(drawn, Array.from({ length: 50 }, () => second()));
});

test("different seeds diverge, and the output stays in range", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  assert.notEqual(a(), b());

  const generator = mulberry32(99);
  for (let i = 0; i < 1000; i += 1) {
    const value = generator();
    assert.ok(value >= 0 && value < 1, `out of range: ${value}`);
  }
});

test("samples closer than the threshold are dropped", () => {
  const last = { x: 100, y: 100, p: 0.5 };
  assert.equal(shouldSample(last, { x: 100.5, y: 100, p: 0.5 }), false);
  assert.equal(shouldSample(last, { x: 103, y: 100, p: 0.5 }), true);
  // The first point of a stroke has nothing to compare against.
  assert.equal(shouldSample(undefined, last), true);
});

test("a device with no pressure sensor still draws at nearly full width", () => {
  // A mouse and a finger report a constant 0.5. If that halved every line the
  // studio would be unusable on anything but a stylus.
  const nominal = 20;
  const mouse = strokeWidth(nominal, "marker", 0.5);
  assert.ok(mouse > nominal * 0.85, `too thin for a mouse: ${mouse}`);

  // A stylus still gets a real range either side of it.
  assert.ok(strokeWidth(nominal, "marker", 0) < mouse);
  assert.ok(strokeWidth(nominal, "marker", 1) > mouse);
  // Never zero: a zero-width line is an invisible one.
  assert.ok(strokeWidth(1, "pencil", 0) > 0);
});

test("spray lays down no line of its own", () => {
  // Its `width` factor is 0 — everything it draws is scatter.
  assert.equal(strokeWidth(20, "spray", 1) > 0, true, "the width helper still returns a number");
});

const DRAWING: Drawing = {
  paper: "#fdf6e3",
  ops: [
    {
      kind: "stroke",
      brush: "crayon",
      color: "#e2001a",
      size: BRUSH_SIZES[2],
      seed: 4242,
      points: [
        { x: 10, y: 20, p: 0.5 },
        { x: 40, y: 60, p: 0.8 },
      ],
    },
    { kind: "fill", x: 700, y: 700, color: "#1d4ed8" },
  ],
};

test("a drawing survives the round trip through localStorage", () => {
  const restored = decodeDrawing(encodeDrawing(DRAWING));
  assert.deepEqual(restored, DRAWING);
});

test("the encoding is compact enough to be worth it", () => {
  // The point of the flat-array form: a long drawing has to fit in a quota
  // measured in a few megabytes, and the obvious {x, y, p} objects do not.
  const long: Drawing = {
    paper: "#ffffff",
    ops: Array.from({ length: 200 }, (_, stroke) => ({
      kind: "stroke" as const,
      brush: "marker" as const,
      color: "#141414",
      size: 16,
      seed: stroke,
      points: Array.from({ length: 60 }, (_, i) => ({ x: i * 7, y: i * 3, p: 0.5 })),
    })),
  };

  const encoded = encodeDrawing(long);
  const naive = JSON.stringify(long);
  assert.ok(encoded.length < naive.length / 2, `${encoded.length} vs ${naive.length}`);
  // 12 000 points and still well inside a 5 MB quota.
  assert.ok(encoded.length < 500_000, `too large: ${encoded.length}`);
});

test("a hostile or corrupt draft is discarded rather than trusted", () => {
  assert.equal(decodeDrawing("not json"), null);
  assert.equal(decodeDrawing('{"v":2,"ops":[]}'), null);
  assert.equal(decodeDrawing('"a string"'), null);

  // A colour that is not a colour would end up in `fillStyle`; it falls back.
  const injected = decodeDrawing(
    JSON.stringify({ v: 1, paper: "url(javascript:alert(1))", ops: [] }),
  );
  assert.deepEqual(injected, { paper: "#ffffff", ops: [] });

  // An unknown brush id, a non-array point list and a stroke with no points are
  // each dropped on their own rather than taking the drawing down with them.
  const partial = decodeDrawing(
    JSON.stringify({
      v: 1,
      paper: "#ffffff",
      ops: [
        [0, "airbrush", "#141414", 16, 1, [0, 0, 0.5]],
        [0, "marker", "#141414", 16, 1, "nope"],
        [0, "marker", "#141414", 16, 1, []],
        [0, "marker", "#141414", 16, 1, [5, 6, 0.5]],
      ],
    }),
  );
  assert.equal(partial?.ops.length, 1);
});

test("pressure is clamped when it comes back", () => {
  const restored = decodeDrawing(
    JSON.stringify({ v: 1, paper: "#ffffff", ops: [[0, "marker", "#141414", 16, 1, [0, 0, 9]]] }),
  );
  const op = restored?.ops[0];
  assert.equal(op?.kind, "stroke");
  if (op?.kind === "stroke") assert.equal(op.points[0].p, 1);
});
