export const PREDEFINED_ROLES = [
  { id: "admin", label: "Администратор", labelEn: "Administrator" },
  { id: "manager", label: "Менеджер", labelEn: "Manager" },
  { id: "master", label: "Мастер", labelEn: "Master" },
] as const;

export type StaffRoleId = "admin" | "manager" | "master";

// Roles that receive ALL notifications (bookings + orders)
export const ADMIN_ROLES: string[] = ["admin", "manager"];

// Roles that receive only their own booking notifications
export const MASTER_ROLES: string[] = ["master"];

export function isPredefinedRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return PREDEFINED_ROLES.some(r => r.id === role);
}
