import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { ReactRenderer } from "@tiptap/react";
import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";
import type { SlashCommandItem } from "./items";
import type {
	SlashCommandListHandle,
	SlashCommandListProps,
} from "./SlashCommandList";
import { SlashCommandList } from "./SlashCommandList";

type SlashSuggestionProps = SuggestionProps<SlashCommandItem, SlashCommandItem>;

/**
 * Floating-UI keeps the menu inside the viewport. The reader stacks many note
 * editors in a scrolling column, so a menu opened near the bottom of the window
 * has to flip above the caret rather than clip.
 */
export function createSlashRenderer() {
	let component: ReactRenderer<
		SlashCommandListHandle,
		SlashCommandListProps
	> | null = null;
	let popup: HTMLDivElement | null = null;

	function reposition(clientRect: SlashSuggestionProps["clientRect"]) {
		if (!popup || !clientRect) return;
		const rect = clientRect();
		if (!rect) return;

		computePosition({ getBoundingClientRect: () => rect }, popup, {
			placement: "bottom-start",
			strategy: "fixed",
			middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 })],
		}).then(({ x, y }) => {
			if (!popup) return;
			popup.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
		});
	}

	function destroy() {
		popup?.remove();
		popup = null;
		component?.destroy();
		component = null;
	}

	return {
		onStart: (props: SlashSuggestionProps) => {
			component = new ReactRenderer(SlashCommandList, {
				props,
				editor: props.editor,
			});
			if (!props.clientRect) return;

			popup = document.createElement("div");
			popup.style.position = "fixed";
			popup.style.top = "0";
			popup.style.left = "0";
			popup.style.zIndex = "80";
			popup.appendChild(component.element);
			document.body.appendChild(popup);
			reposition(props.clientRect);
		},

		onUpdate: (props: SlashSuggestionProps) => {
			component?.updateProps(props);
			reposition(props.clientRect);
		},

		onKeyDown: (props: SuggestionKeyDownProps) => {
			if (props.event.key === "Escape") {
				destroy();
				return true;
			}
			return component?.ref?.onKeyDown(props.event) ?? false;
		},

		onExit: destroy,
	};
}
