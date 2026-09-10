import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
  tailwind-merge only knows Tailwind's stock scale, so it read this design's own
  sizes — `text-ui`, `text-lede` — as text *colours*, and dropped the real colour
  that came before them. That is why a primary button was ink on ink. Naming the
  scale here puts each utility back in its own group.
*/
const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			"font-size": [
				{ text: ["micro", "tiny", "ui", "note", "lede", "display"] },
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
