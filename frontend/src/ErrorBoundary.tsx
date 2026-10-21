import { Component, ReactNode, ComponentProps } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ComponentProps<ErrorBoundary>): void {
    this.setState({
      errorInfo: errorInfo.componentStack ?? null,
    });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
          }}
        >
          <h2 style={{ color: "#B42326" }}>Something went wrong</h2>
          <p style={{ color: "#62758B", marginBottom: 16 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{
              padding: "10px 20px",
              background: "#15518A",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Refresh Page
          </button>
          {this.state.errorInfo && process.env.NODE_ENV === "development" && (
            <pre style={{ textAlign: "left", marginTop: 20, fontSize: 12, color: "#62758B" }}>
              {this.state.errorInfo}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
