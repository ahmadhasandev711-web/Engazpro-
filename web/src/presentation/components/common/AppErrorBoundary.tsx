import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button, Card } from '../ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AppErrorBoundary caught an unhandled error]:', error, errorInfo);
  }

  public handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card
          dir="rtl"
          className="w-full min-h-[220px] p-6 my-4 border-bad/30 flex flex-col items-center justify-center text-center animate-in fade-in duration-200"
        >
          <div className="w-12 h-12 bg-bad-soft border border-bad/25 rounded-2xl flex items-center justify-center text-bad mb-3.5 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-ink mb-1">
            {this.props.fallbackTitle || 'حدث خطأ غير متوقع أثناء عرض هذا الجزء'}
          </h3>

          <p className="text-xs text-muted max-w-md mb-4 leading-relaxed">
            {this.state.error?.message || 'تعذر استكمال العرض بصورة صحيحة. يمكنك إعادة المحاولة أو تحديث الصفحة بالكامل.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={this.handleReset}
              leftIcon={<RotateCcw className="w-4 h-4" />}
              className="text-xs font-bold bg-ok hover:bg-ok/90"
            >
              إعادة المحاولة
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={this.handleReload}
              leftIcon={<RefreshCw className="w-4 h-4" />}
              className="text-xs font-bold"
            >
              إعادة تحميل الصفحة
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
