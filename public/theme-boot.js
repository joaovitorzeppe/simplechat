try {
  const s = localStorage.getItem("simplechat.theme");
  const light =
    s === "light" ||
    (s !== "dark" && matchMedia("(prefers-color-scheme: light)").matches);
  if (light) {
    document.documentElement.classList.add("light");
  }
} catch {
  // localStorage bloqueado: fica o tema padrão
}
