// Admin configuration
// Add your admin emails here

export const ADMIN_EMAILS = [
  "director.kbridge@gmail.com",
  // Add more admin emails as needed
];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
