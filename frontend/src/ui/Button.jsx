import { forwardRef } from "react";
import "./Button.css";

const Button = forwardRef(({ className = "", variant = "primary", size = "md", disabled = false, loading = false, type = "button", children, ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    disabled={disabled || loading}
    className={`tmc-btn tmc-btn--${variant} tmc-btn--${size} ${className}`.trim()}
    aria-busy={loading}
    {...props}
  >
    {loading && <span className="tmc-btn-spinner" aria-hidden="true" />}
    {children}
  </button>
));

Button.displayName = "Button";

export default Button;
