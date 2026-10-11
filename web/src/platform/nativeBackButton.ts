/**
 * Platform Layer - Native Back Button Manager
 * Conforms to GR-3 (SoC) & GR-7 (DIP)
 * Manages modal / bottom sheet back-stack for Android hardware back button.
 */
type DismissHandler = () => boolean;

class NativeBackButtonManager {
  private handlers: DismissHandler[] = [];

  /**
   * Register a dismiss handler (e.g. from MobileBottomSheet or Modal)
   * Returns an unregister function to call on unmount.
   */
  register(handler: DismissHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /**
   * Executes the topmost registered handler.
   * Returns true if a modal/sheet was closed, false if back-stack is empty.
   */
  handleBack(): boolean {
    if (this.handlers.length > 0) {
      const topmost = this.handlers[this.handlers.length - 1];
      return topmost();
    }
    return false;
  }
}

export const nativeBackButton = new NativeBackButtonManager();
