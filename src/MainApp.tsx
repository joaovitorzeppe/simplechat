import { lazy, Suspense, useEffect } from "react";
import { IncomingCall } from "@components/IncomingCall";
import { Toast } from "@components/Toast";
import { session } from "@libs/session";
import type { Identity } from "@libs/types";
import { useSessionSelector } from "@libs/use-session";
import { Home } from "@screens/Home";

const Call = lazy(() =>
  import("@screens/Call").then((mod) => ({ default: mod.Call })),
);

export const MainApp = ({ identity }: { identity: Identity }) => {
  const view = useSessionSelector((s) => s.view);
  const incoming = useSessionSelector((s) =>
    s.callStatus === "idle" ? s.incoming : null,
  );

  useEffect(() => {
    void session.start(identity);
  }, [identity]);

  return (
    <>
      {view === "call" ? (
        <Suspense fallback={null}>
          <Call />
        </Suspense>
      ) : (
        <Home />
      )}
      {incoming && (
        <IncomingCall
          name={incoming.displayName}
          onAccept={() => void session.acceptIncoming()}
          onReject={() => session.rejectIncoming()}
        />
      )}
      <Toast />
    </>
  );
};
