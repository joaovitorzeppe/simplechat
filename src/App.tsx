import { useEffect, useState } from "react";
import { IncomingCall } from "./components/IncomingCall";
import { Toast } from "./components/Toast";
import { loadIdentity } from "./lib/identity";
import { session } from "./lib/session";
import { unlockAudio } from "./lib/sounds";
import { showToast } from "./lib/toast";
import { useSession } from "./lib/use-session";
import { Call } from "./screens/Call";
import { Home } from "./screens/Home";
import { Onboarding } from "./screens/Onboarding";

const App = () => {
  const { state } = useSession();
  const [storedIdentity] = useState(loadIdentity);

  useEffect(() => {
    // getUserMedia e crypto.randomUUID exigem contexto seguro, então acessar
    // pelo IP da rede local em HTTP quebra o app sem mensagem nenhuma.
    if (!window.isSecureContext) showToast("error.insecureContext");
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

  let screen = null;
  if (!state.identity && !storedIdentity) {
    screen = (
      <Onboarding
        onDone={(identity) => {
          void session.start(identity);
        }}
      />
    );
  } else if (state.identity && state.view === "call") {
    screen = <Call />;
  } else if (state.identity) {
    screen = <Home />;
  }

  return (
    <>
      {screen}
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
