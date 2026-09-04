import { lazy, Suspense, useEffect, useState } from "react";
import { Toast } from "@components/Toast";
import { t } from "@i18n/i18n";
import { loadIdentity } from "@libs/identity";
import { unlockAudio } from "@libs/sounds";
import { showToast } from "@libs/toast";
import { parseLegalPath } from "@libs/spa-path";
import { Onboarding } from "@screens/Onboarding";

const MainApp = lazy(() =>
  import("./MainApp").then((mod) => ({ default: mod.MainApp })),
);

const Legal = lazy(() =>
  import("@screens/Legal").then((mod) => ({ default: mod.Legal })),
);

const Boot = () => (
  <main
    className="min-h-dvh grid place-items-center px-4"
    aria-busy="true"
    aria-label={t("common.loading")}
  >
    <p className="text-sm text-zinc-500">{t("common.loading")}</p>
  </main>
);

const App = () => {
  const [identity, setIdentity] = useState(loadIdentity);

  useEffect(() => {
    // getUserMedia e crypto.randomUUID exigem contexto seguro, então acessar
    // pelo IP da rede local em HTTP quebra o app sem mensagem nenhuma.
    if (!window.isSecureContext) showToast("error.insecureContext");
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

  const legal = parseLegalPath(window.location.pathname);
  if (legal) {
    return (
      <Suspense fallback={<Boot />}>
        <Legal kind={legal} />
        <Toast />
      </Suspense>
    );
  }

  if (!identity) {
    return (
      <>
        <Onboarding onDone={setIdentity} />
        <Toast />
      </>
    );
  }

  return (
    <Suspense fallback={<Boot />}>
      <MainApp identity={identity} />
    </Suspense>
  );
};

export default App;
