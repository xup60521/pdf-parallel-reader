import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

const button = cva(
	"inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45",
	{
		variants: {
			variant: {
				primary:
					"bg-quill text-white shadow-rest hover:bg-quill-hover dark:text-[color:var(--primary-foreground)]",
				neutral:
					"border border-rule bg-surface text-ink shadow-rest hover:border-rule-strong hover:bg-surface-2",
				ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
				danger: "text-ink-2 hover:bg-danger-soft hover:text-danger",
			},
			size: {
				sm: "h-7 rounded-chip px-2 text-tiny",
				md: "h-8 rounded-control px-3 text-ui",
				icon: "size-7 rounded-chip",
				"icon-lg": "size-8 rounded-control",
			},
		},
		defaultVariants: { variant: "neutral", size: "md" },
	},
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof button> & { ref?: Ref<HTMLButtonElement> };

export function Button({
	className,
	variant,
	size,
	type = "button",
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={cn(button({ variant, size }), className)}
			{...props}
		/>
	);
}

/**
 * A segmented row of related controls (zoom, split ratio) rendered as one inset
 * object so the header reads as a few groups rather than a dozen loose buttons.
 */
export function ControlGroup({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-0.5 rounded-control border border-rule bg-surface-2 p-0.5",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function SegmentButton({
	active,
	className,
	...props
}: ButtonProps & { active?: boolean }) {
	return (
		<Button
			variant="ghost"
			size="sm"
			aria-pressed={active}
			className={cn(
				"h-6 px-2 font-medium",
				active
					? "bg-surface text-ink shadow-rest hover:bg-surface"
					: "text-ink-3 hover:text-ink",
				className,
			)}
			{...props}
		/>
	);
}
