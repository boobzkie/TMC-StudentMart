export function getToken() {
  return localStorage.getItem("token");
}

export function getStoredUser() {
  try {
    const user = localStorage.getItem("user");

    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function getStoredRole() {
  return String(
    localStorage.getItem("role") || ""
  ).toLowerCase();
}

export function saveAuth({ token, user, role }) {
  const normalizedUser = user || getStoredUser();
  const normalizedRole = String(role || normalizedUser?.role || getStoredRole() || "").toLowerCase();

  localStorage.setItem("token", token || getToken() || "");
  if (normalizedUser) {
    localStorage.setItem("user", JSON.stringify(normalizedUser));
  }
  localStorage.setItem("role", normalizedRole);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function isPortalRole(role) {
  return ["admin", "staff"].includes(String(role || "").toLowerCase());
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}

export function hasPortalSession() {
  const token = getToken();
  const role = getStoredRole();
  const user = getStoredUser();

  return Boolean(token) && isPortalRole(role) && Boolean(user);
}