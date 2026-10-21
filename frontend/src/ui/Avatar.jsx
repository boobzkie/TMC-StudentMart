import "./Avatar.css";

function Avatar({ src, alt, size = "md", className = "", ...props }) {
  const initials = src ? null : (alt || "U").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "TM";
  return (
    <span className={`tmc-avatar tmc-avatar--${size} ${className}`.trim()} {...props} aria-label={alt}>
      {src ? <img src={src} alt={alt || ""} /> : initials}
    </span>
  );
}

Avatar.displayName = "Avatar";

export default Avatar;
