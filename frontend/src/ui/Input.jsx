import { forwardRef } from "react";
import "./Input.css";

const Input = forwardRef(({ className = "", label, helper, error, required, ...props }, ref) => {
  const hasLabel = label || required;
  return (
    <div className={`tmc-input-group ${className}`.trim()}>
      {hasLabel && (
        <label className="tmc-input-label">
          {label}
          {required && <span className="tmc-input-required" aria-hidden="true"> *</span>}
        </label>
      )}
      <input className={`tmc-input ${error ? "tmc-input--error" : ""}`} {...props} ref={ref} />
      {error && <span className="tmc-input-error" role="alert">{error}</span>}
      {!error && helper && <span className="tmc-input-helper">{helper}</span>}
    </div>
  );
});

Input.displayName = "Input";

export default Input;
