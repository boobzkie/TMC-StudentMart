import "./Badge.css";

function Badge({ className = "", variant = "neutral", size = "md", children, ...props }) {
  return (
    <span className={`tmc-badge tmc-badge--${variant} tmc-badge--${size} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

Badge.displayName = "Badge";

export default Badge;
