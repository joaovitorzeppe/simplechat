try {
  var s = localStorage.getItem("simplechat.theme");
  var light =
    s === "light" ||
    (s !== "dark" && matchMedia("(prefers-color-scheme: light)").matches);
  if (light) document.documentElement.classList.add("light");
} catch (e) {}
