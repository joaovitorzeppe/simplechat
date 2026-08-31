import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n/i18n";
import { Button } from "./Button";

type Props = {
  children: ReactNode;
};

type State = {
  crashed: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SimpleChat crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <main className="min-h-dvh grid place-items-center px-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-3xl border border-line bg-panel p-8 text-center"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-accent">
            SimpleChat
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            {t("error.crashTitle")}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">{t("error.crashBody")}</p>
          <Button
            className="mt-6 w-full"
            onClick={() => window.location.reload()}
          >
            {t("error.crashReload")}
          </Button>
        </div>
      </main>
    );
  }
}
