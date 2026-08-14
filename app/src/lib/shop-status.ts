/**
 * Whether the shop can take money yet.
 *
 * The site is public while it is being finished — see `ComingSoonGate`, which
 * says as much on the way in — but nothing can be bought until the catalogue,
 * the stock and the payment gateway are all true at the same time. Adding to
 * the basket is deliberately still allowed: a basket lives in this browser and
 * survives until opening day, so someone browsing today can leave it ready
 * rather than having to remember what they liked.
 *
 * One constant, checked in three places, because each of them is a real door
 * and closing only the visible one closes nothing:
 *
 *   * the basket's "go to pay" button — the door people use;
 *   * the checkout page — the door a bookmark or a typed URL opens;
 *   * `placeOrder` — the door a crafted POST opens, and the only one that
 *     actually charges anybody.
 *
 * Opening day: flip this to `true`. Nothing else has to change, and the copy
 * that explains the wait (`comingSoon.*`) can then be deleted along with the
 * gate.
 */
// Annotated `boolean` rather than left as the literal `false`: without it every
// open-shop branch in the codebase types as dead code, and flipping the flag
// would light up errors in files that are perfectly correct.
export const CHECKOUT_OPEN: boolean = false;
