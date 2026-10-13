import { CircleCheck, CircleX, Clock3 } from "lucide-react";

import "./StatusBadge.css";

function StatusBadge({ status }) {
  const value = String(status || "unknown").toLowerCase();

  let Icon = CircleCheck;

  if (value === "pending") {
    Icon = Clock3;
  }

  if (
    value === "rejected" ||
    value === "inactive"
  ) {
    Icon = CircleX;
  }

  const label =
    value.charAt(0).toUpperCase() +
    value.slice(1);

  return (
    <span className={`status-badge ${value}`}>
      <Icon size={13} />
      {label}
    </span>
  );
}

export default StatusBadge;