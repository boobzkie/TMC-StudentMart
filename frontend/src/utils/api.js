export const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "http://127.0.0.1:8000";

export function getAuthHeaders() {
  const token = localStorage.getItem("token");

  return {
    Accept: "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}