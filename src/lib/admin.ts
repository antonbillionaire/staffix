// Admin configuration
// Add emails here OR set ADMIN_EMAILS env variable in Vercel (comma-separated)

const hardcoded = [
  "director.kbridge@gmail.com",
];

const fromEnv = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

export const ADMIN_EMAILS = [...new Set([...hardcoded, ...fromEnv])];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
