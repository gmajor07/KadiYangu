type Principal = { role: string; status: string } | null | undefined;
export function isActive(user: Principal) {
  return user?.status === "ACTIVE";
}
export function canAccessAdmin(user: Principal) {
  return isActive(user) && user?.role === "ADMIN";
}
