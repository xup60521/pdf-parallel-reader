import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
	applyTheme,
	type ResolvedTheme,
	readThemePreference,
	resolveTheme,
	storeThemePreference,
} from "../../lib/theme";
import { Button } from "./Button";

/**
 * Two states, not three. A "system" option is honoured on first load (see
 * themeBootstrapScript) but choosing manually is a definite choice, and a
 * three-way control costs more attention than it returns here.
 */
export function ThemeToggle({ className }: { className?: string }) {
	const [theme, setTheme] = useState<ResolvedTheme | null>(null);

	useEffect(() => {
		setTheme(resolveTheme(readThemePreference()));
	}, []);

	function toggle() {
		const next: ResolvedTheme = theme === "dark" ? "light" : "dark";
		storeThemePreference(next);
		applyTheme(next);
		setTheme(next);
	}

	// Render nothing until the client knows the resolved theme, so the icon never
	// flips after hydration.
	if (!theme) return <span className={className} aria-hidden />;

	return (
		<Button
			variant="ghost"
			size="icon-lg"
			onClick={toggle}
			className={className}
			title={theme === "dark" ? "Switch to light" : "Switch to dark"}
			aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
		>
			{theme === "dark" ? (
				<Sun className="size-4" />
			) : (
				<Moon className="size-4" />
			)}
		</Button>
	);
}
