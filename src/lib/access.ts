import { AppUser, Permission } from "@/types";

/** Verifica se o usuário tem uma permissão específica (owner tem todas). */
export function can(user: AppUser | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  return user.permissions.includes(permission);
}

/** Verifica se o usuário tem pelo menos uma das permissões. */
export function canAny(user: AppUser | null, permissions: Permission[]): boolean {
  return permissions.some((p) => can(user, p));
}
