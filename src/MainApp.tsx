import { lazy, Suspense, useEffect } from "react";
import { IncomingCall } from "@components/IncomingCall";
import { Toast } from "@components/Toast";
import { session } from "@libs/session";
import type { Identity } from "@libs/types";
import { useSession } from "@libs/use-session";
import { Home } from "@screens/Home";

const Call = lazy(() =>
  import("@screens/Call").then((mod) => ({ default: mod.Call })),
);

export const MainApp = ({ identity }: { identity: Identity }) => {
  const { state } = useSession();

  useEffect(() => {
    void session.start(identity);
  }, [identity]);

  return (
    <>
      {state.view === "call" ? (
        <Suspense fallback={null}>
          <Call />
        </Suspense>
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
