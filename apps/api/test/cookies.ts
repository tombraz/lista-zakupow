type SetCookie = string | string[] | undefined;

/** Pełny nagłówek Set-Cookie ciasteczka sesji Better Auth (z atrybutami). */
export function sessionCookie(setCookie: SetCookie): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
  const session = cookies.find((cookie) => cookie.includes("session_token="));
  if (!session) throw new Error(`no session cookie in ${JSON.stringify(setCookie)}`);
  return session;
}

/** `nazwa=wartość` ciasteczka sesji do nagłówka Cookie kolejnego żądania. */
export function cookieHeader(setCookie: SetCookie): string {
  return sessionCookie(setCookie).split(";")[0] ?? "";
}
