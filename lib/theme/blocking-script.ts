/**
 * Blocking theme script aligned with next-themes 0.4.6 ThemeScript args.
 * Injected via ThemeHeadScript (SSR-only client boundary) in the root layout.
 */
export function getThemeBlockingScriptHtml(): string {
  const scriptArgs = JSON.stringify([
    "class",
    "theme",
    "system",
    null,
    ["light", "dark"],
    null,
    true,
    false,
  ]).slice(1, -1);

  // Body copied from next-themes dist/index.mjs (ThemeScript IIFE).
  return `((attribute,storageKey,defaultTheme,forcedTheme,themes,value,enableSystem,enableColorScheme)=>{let documentElement=document.documentElement,colorSchemes=["light","dark"];function setTheme(theme){(Array.isArray(attribute)?attribute:[attribute]).forEach((attr)=>{let isClass=attr==="class",names=isClass&&value?themes.map((entry)=>value[entry]||entry):themes;isClass?(documentElement.classList.remove(...names),documentElement.classList.add(value&&value[theme]?value[theme]:theme)):documentElement.setAttribute(attr,value&&value[theme]?value[theme]:theme)}),setColorScheme(theme)}function setColorScheme(theme){enableColorScheme&&colorSchemes.includes(theme)&&(documentElement.style.colorScheme=theme)}function getSystemTheme(){return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(forcedTheme)setTheme(forcedTheme);else try{let storedTheme=localStorage.getItem(storageKey)||defaultTheme,resolvedTheme=enableSystem&&storedTheme==="system"?getSystemTheme():storedTheme;setTheme(resolvedTheme)}catch(error){}})(${scriptArgs})`;
}
