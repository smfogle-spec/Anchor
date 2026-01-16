import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundaryRecovery extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Error caught by boundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    this.props.onReset?.();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleRefresh = () => {
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;
      const { fallbackMessage = "Something went wrong while loading this section." } = this.props;

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-lg w-full border-destructive/30">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Oops! Something went wrong</CardTitle>
              <CardDescription className="text-sm mt-2">
                {fallbackMessage}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={this.handleRetry} className="flex-1 gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={this.handleGoHome} className="flex-1 gap-2">
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </div>

              <button
                onClick={this.toggleDetails}
                className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Hide technical details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Show technical details
                  </>
                )}
              </button>

              {showDetails && (
                <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-40">
                  <p className="text-destructive font-semibold mb-2">
                    {error?.name}: {error?.message}
                  </p>
                  {errorInfo?.componentStack && (
                    <pre className="text-muted-foreground whitespace-pre-wrap">
                      {errorInfo.componentStack.slice(0, 500)}
                    </pre>
                  )}
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                Your work has been preserved. If this keeps happening, try refreshing the page.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryRecovery;
