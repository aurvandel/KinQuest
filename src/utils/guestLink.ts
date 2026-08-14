export const INVITE_CODE_STORAGE_KEY = "wilderhunt_invite_code";

/** Random, hard-to-guess name so each guest link click gets its own profile. */
export function generateGuestUsername(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `Guest-${suffix}`;
}

/** Builds a share link that carries the invite code and auto-joins as an anonymous guest. */
export function buildGuestShareLink(tab: string): string {
  const params = new URLSearchParams();
  const inviteCode = localStorage.getItem(INVITE_CODE_STORAGE_KEY);
  if (inviteCode) {
    params.set("invite", inviteCode);
  }
  params.set("guest", "1");
  return `${window.location.origin}${window.location.pathname}?${params.toString()}#${tab}`;
}
