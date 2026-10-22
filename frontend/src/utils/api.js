export const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "http://127.0.0.1:8000";

const tableCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function sortRows(rows, sort, getValue) {
  if (!Array.isArray(rows) || !sort?.key) return Array.isArray(rows) ? rows : [];
  const multiplier = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((leftRow, rightRow) => {
    const left = getValue ? getValue(leftRow, sort.key) : leftRow?.[sort.key];
    const right = getValue ? getValue(rightRow, sort.key) : rightRow?.[sort.key];
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === "number" && Number.isFinite(left) && typeof right === "number" && Number.isFinite(right)) return (left - right) * multiplier;
    if (/date|_at|last_seen/i.test(sort.key)) {
      const leftDate = Date.parse(left);
      const rightDate = Date.parse(right);
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) return (leftDate - rightDate) * multiplier;
    }
    return tableCollator.compare(String(left), String(right)) * multiplier;
  });
}

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
