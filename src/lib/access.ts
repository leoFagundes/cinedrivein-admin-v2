import { AppUser, Permission } from "@/types";
import { getDevMode } from "./devMode";

/** Verifica se o usuário tem uma permissão específica (owner tem todas). */
export function can(user: AppUser | null, permission: Permission): boolean {
  if (!user) return false;
  const devMode = getDevMode();
  if (devMode.bypassPermissions) return true;
  if (devMode.simulateRole !== null) {
    return devMode.simulateRole.permissions.includes(permission);
  }
  if (user.isOwner) return true;
  return user.permissions.includes(permission);
}

/** Verifica se o usuário tem pelo menos uma das permissões. */
export function canAny(
  user: AppUser | null,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => can(user, p));
}
