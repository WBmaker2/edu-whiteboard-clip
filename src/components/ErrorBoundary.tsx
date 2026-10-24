import { Component, type ErrorInfo, type ReactNode } from "react";
import { loadDraft } from "../lib/storage";
import { downloadProject } from "../lib/export/project";
import { localizeError, translate } from "../lib/i18n";
import { useStudioStore } from "../store/studioStore";
import { CrashScreen } from "./CrashScreen";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  downloading: boolean;
  draftMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    downloading: false,
    draftMessage: "",
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("판서랩 화면 오류:", error, info.componentStack);
  }

  private t = (key: string, params?: Record<string, string | number>): string =>
    translate(useStudioStore.getState().language, key, params);

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleDownloadDraft = async (): Promise<void> => {
    this.setState({ downloading: true, draftMessage: "" });
    try {
      const draft = await loadDraft();
      if (!draft) {
        this.setState({
          downloading: false,
          draftMessage: this.t("crash.noDraft"),
        });
        return;
      }
      await downloadProject(draft);
      this.setState({
        downloading: false,
        draftMessage: this.t("crash.downloaded"),
      });
    } catch (error) {
      this.setState({
        downloading: false,
        draftMessage:
          error instanceof Error
            ? this.t("crash.downloadFailedReason", { message: localizeError(useStudioStore.getState().language, error.message) })
            : this.t("crash.downloadFailed"),
      });
    }
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <CrashScreen
        error={this.state.error}
        downloading={this.state.downloading}
        draftMessage={this.state.draftMessage}
        onReload={this.handleReload}
        onDownloadDraft={() => void this.handleDownloadDraft()}
      />
    );
  }
}
