import { useEffect } from "react";
import { IncomingCall } from "./components/IncomingCall";
import { useI18n } from "./i18n/use-i18n";
import { loadIdentity } from "./lib/identity";
import { session } from "./lib/session";
import { useSession } from "./lib/use-session";
import { Call } from "./screens/Call";
import { History } from "./screens/History";
import { Home } from "./screens/Home";
import { Onboarding } from "./screens/Onboarding";

export default function App() {
  const { state } = useSession();
  const { t } = useI18n();

  useEffect(() => {
    const identity = loadIdentity();
    if (identity) void session.start(identity);
  }, []);

  if (!state.identity && !loadIdentity()) {
    return (
      <Onboarding
        onDone={(identity) => {
          void session.start(identity);
        }}
      />
    );
  }

  if (!state.identity) return null;

  return (
    <>
      {state.view === "history" ? (
        <History />
      ) : state.view === "call" ? (
        <Call />
      ) : (
        <Home />
      )}
      {state.incoming && state.callStatus === "idle" && (
        <IncomingCall
          name={state.incoming.displayName}
          onAccept={() => void session.acceptIncoming()}
          onReject={() => session.rejectIncoming()}
        />
      )}
      {state.toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-sm shadow-xl">
          {t(state.toast)}
        </div>
      )}
    </>
  );
}
