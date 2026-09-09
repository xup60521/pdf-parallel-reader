import { type RefObject, useEffect, useState } from "react";

/**
 * Reports whether an element is inside (or near) a scroll container.
 *
 * `root` matters more than it looks: `rootMargin` only grows the root itself,
 * while an intermediate scrolling ancestor still clips the element. Observing
 * against the window while the rows live in an `overflow-y-auto` pane therefore
 * reports every off-screen row as hidden no matter how large the margin, and
 * the prefetch window silently does nothing. Pass the pane.
 *
 * `initial` seeds the answer before the first observation lands, so content
 * known to start on screen paints immediately instead of flashing a placeholder.
 * `once` keeps an element visible after its first appearance — used for
 * thumbnails, which are cheap to keep and costly to redraw.
 */
export function useInViewport(
	ref: RefObject<Element | null>,
	options: {
		root?: RefObject<Element | null>;
		rootMargin?: string;
		once?: boolean;
		initial?: boolean;
	} = {},
): boolean {
	const { root, rootMargin = "0px", once = false, initial = false } = options;
	const [isVisible, setIsVisible] = useState(initial);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;

		if (typeof IntersectionObserver === "undefined") {
			setIsVisible(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry) return;
				if (entry.isIntersecting) {
					setIsVisible(true);
					if (once) observer.disconnect();
				} else if (!once) {
					setIsVisible(false);
				}
			},
			{ root: root?.current ?? null, rootMargin },
		);

		observer.observe(element);
		return () => observer.disconnect();
	}, [ref, root, rootMargin, once]);

	return isVisible;
}
