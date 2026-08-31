import { useEffect } from "react";
import { IncomingCall } from "./components/IncomingCall";
import { Toast } from "./components/Toast";
import { loadIdentity } from "./lib/identity";
import { session } from "./lib/session";
import { unlockAudio } from "./lib/sounds";
import { useSession } from "./lib/use-session";
import { Call } from "./screens/Call";
import { History } from "./screens/History";
import { Home } from "./screens/Home";
import { Onboarding } from "./screens/Onboarding";

const App = () => {
  const { state } = useSession();

  useEffect(() => {
    const identity = loadIdentity();
    if (identity) void session.start(identity);
  }, []);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  if (!state.identity && !loadIdentity()) {
    return (
      <>
        <Onboarding
          onDone={(identity) => {
            void session.start(identity);
          }}
        />
        <Toast />
      </>
    );
  }

  if (!state.identity) {
    return <Toast />;
  }

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
      <Toast />
    </>
  );
};

export default App;
