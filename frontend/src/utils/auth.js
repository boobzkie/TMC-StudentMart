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

export function isAuthenticated() {
  return Boolean(getToken());
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}