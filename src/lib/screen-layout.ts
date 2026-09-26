/**
 * Como o palco da chamada organiza telas compartilhadas vs câmeras.
 * `hasPin` = usuário fixou uma tela que ainda existe.
 */
export const screenStageKind = (
  screenCount: number,
  hasPin: boolean,
  showCameras: boolean,
) => {
  if (screenCount <= 0) {
    return "cameras" as const;
  }
  if (hasPin && !showCameras) {
    return "pinned-solo" as const;
  }
  if (hasPin) {
    return "pinned-strip" as const;
  }
  return "split" as const;
};
