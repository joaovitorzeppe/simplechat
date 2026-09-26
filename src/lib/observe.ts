import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";

/** Query e hash do convite não devem ir para a Vercel (`#k=` é o segredo da sala). */
export const publicObserveUrl = (raw: string) => {
  try {
    const url = new URL(raw);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
};

const beforeSend = <T extends { url: string }>(event: T) => {
  return { ...event, url: publicObserveUrl(event.url) };
};

export const startVercelObserve = () => {
  inject({ beforeSend });
  injectSpeedInsights({ beforeSend });
};
