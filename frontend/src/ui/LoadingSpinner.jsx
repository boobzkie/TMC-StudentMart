import "./LoadingSpinner.css";

function LoadingSpinner({ size = "md", className = "", ...props }) {
  return (
    <div className={`tmc-loader tmc-loader--${size} ${className}`.trim()} {...props} role="status" aria-label="Loading">
      <div className="tmc-loader-spinner" />
    </div>
  );
}

LoadingSpinner.displayName = "LoadingSpinner";

export default LoadingSpinner;
