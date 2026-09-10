import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { cn } from "../../../lib/utils";
import type { SlashCommandItem } from "./items";

export type SlashCommandListHandle = {
	onKeyDown: (event: KeyboardEvent) => boolean;
};

export type SlashCommandListProps = {
	items: SlashCommandItem[];
	command: (item: SlashCommandItem) => void;
};

export const SlashCommandList = forwardRef<
	SlashCommandListHandle,
	SlashCommandListProps
>(function SlashCommandList({ items, command }, ref) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the filtered list identity changes.
	useEffect(() => {
		setSelectedIndex(0);
	}, [items]);

	useLayoutEffect(() => {
		containerRef.current
			?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	function selectItem(index: number) {
		const item = items[index];
		if (item) command(item);
	}

	useImperativeHandle(ref, () => ({
		onKeyDown: (event) => {
			if (items.length === 0) return false;

			if (event.key === "ArrowUp") {
				setSelectedIndex((i) => (i + items.length - 1) % items.length);
				return true;
			}
			if (event.key === "ArrowDown") {
				setSelectedIndex((i) => (i + 1) % items.length);
				return true;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				selectItem(selectedIndex);
				return true;
			}
			return false;
		},
	}));

	if (items.length === 0) {
		return (
			<div className="w-64 rounded-control border border-rule-strong bg-surface px-3 py-2.5 text-ui text-ink-2 shadow-float">
				Nothing matches that
			</div>
		);
	}

	let lastGroup = "";

	return (
		<div
			ref={containerRef}
			className="max-h-[19rem] w-64 overflow-y-auto overscroll-contain rounded-control border border-rule-strong bg-surface p-1 shadow-float"
		>
			{items.map((item, index) => {
				const Icon = item.icon;
				const isActive = index === selectedIndex;
				const showGroup = item.group !== lastGroup;
				lastGroup = item.group;

				return (
					<div key={item.title}>
						{showGroup && (
							<div className="px-2 pt-2 pb-1 text-micro font-semibold text-ink-2">
								{item.group}
							</div>
						)}
						<button
							type="button"
							data-index={index}
							onClick={() => selectItem(index)}
							onMouseEnter={() => setSelectedIndex(index)}
							className={cn(
								"flex w-full items-center gap-2.5 rounded-chip px-2 py-1.5 text-left transition-colors",
								isActive ? "bg-tint-strong" : "bg-transparent",
							)}
						>
							<span
								className={cn(
									"flex size-6 shrink-0 items-center justify-center rounded-chip border",
									isActive
										? "border-transparent bg-ink text-paper"
										: "border-rule-strong bg-tint text-ink-2",
								)}
							>
								<Icon className="size-3.5" />
							</span>
							<span className="min-w-0 leading-tight">
								<span className="block truncate text-ui font-medium text-ink">
									{item.title}
								</span>
								<span className="block truncate text-micro text-ink-2">
									{item.subtitle}
								</span>
							</span>
						</button>
					</div>
				);
			})}
		</div>
	);
});
