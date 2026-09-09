export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ppr.theme";

/** Browser chrome tint, kept in step with `--desk`. */
export const BROWSER_CHROME_COLOR: Record<ResolvedTheme, string> = {
	light: "#e8e8ef",
	dark: "#101117",
};

/**
 * Runs before hydration so the first paint already carries the right skin.
 * Kept as a string because it has to be inlined in the document head.
 */
export const themeBootstrapScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
	THEME_STORAGE_KEY,
)});var d=p==="dark"||((!p||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?${JSON.stringify(
	BROWSER_CHROME_COLOR.dark,
)}:${JSON.stringify(BROWSER_CHROME_COLOR.light)});}catch(e){}})();`;

export function readThemePreference(): ThemePreference {
	if (typeof localStorage === "undefined") return "system";
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return stored === "light" || stored === "dark" || stored === "system"
		? stored
		: "system";
}

export function systemTheme(): ResolvedTheme {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
	return preference === "system" ? systemTheme() : preference;
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
	const resolved = resolveTheme(preference);
	document.documentElement.classList.toggle("dark", resolved === "dark");
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", BROWSER_CHROME_COLOR[resolved]);
	return resolved;
}

export function storeThemePreference(preference: ThemePreference): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch {
		// Private-mode storage denial is not worth surfacing; the class still applied.
	}
}
