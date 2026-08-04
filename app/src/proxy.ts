import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  matchLocale,
  type Locale,
} from "@/lib/i18n/config";
import { toCanonicalPath } from "@/lib/i18n/routes";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Runs on every page request and does two things, in this order:
 *
 *  1. **Locale**: makes sure the path is locale-prefixed (detecting from the
 *     `Accept-Language` header the first time), then rewrites the localized
 *     public path onto the canonical route folder.
 *  2. **Session**: refreshes the Supabase auth cookies. This is the only place
 *     that can write them, because Server Components have a read-only cookie
 *     store.
 *
 * This is deliberately *not* an authorisation layer — it never decides who may
 * see what. Guards live in the pages themselves (`getViewer()`) and, ultimately,
 * in Postgres RLS.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ---------------------------------------------------------------- locale
  const firstSegment = pathname.split("/")[1] ?? "";

  if (!isLocale(firstSegment)) {
    const locale = pickLocale(request);
    const target = request.nextUrl.clone();
    target.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    const redirect = NextResponse.redirect(target);
    rememberLocale(redirect, locale);
    return redirect;
  }

  const locale = firstSegment;
  const canonical = toCanonicalPath(pathname);

  // Rewrite the localized URL onto the canonical folder, e.g.
  // /gl/tenda/camisetas → /gl/shop/camisetas. The address bar keeps the
  // localized path, which is what gets indexed.
  let response: NextResponse;
  if (canonical && canonical !== pathname) {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = canonical;
    rewritten.search = search;
    response = NextResponse.rewrite(rewritten, { request });
  } else {
    response = NextResponse.next({ request });
  }

  // Keep the preference in step with the URL the visitor actually landed on.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    rememberLocale(response, locale);
  }

  // --------------------------------------------------------------- session
  //
  // `getUser()` validates the token and, when it has expired, triggers a
  // refresh; the new cookies are written onto `response` by `setAll` below.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

function pickLocale(request: NextRequest): Locale {
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(remembered)) return remembered;
  return matchLocale(request.headers.get("accept-language")) ?? DEFAULT_LOCALE;
}

function rememberLocale(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // Readable by client code (the locale switcher); it is not a secret.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}

export const config = {
  matcher: [
    // Everything except Next internals, the API namespace and static files.
    "/((?!_next/static|_next/image|api/|auth/|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)",
  ],
};
