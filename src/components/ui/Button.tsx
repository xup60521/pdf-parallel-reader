import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

/*
  The reader's own controls are `.sideb`s in the rail, per the design. This is
  what is left: the library screen and the two error states. It follows the same
  rules — alpha tints for state, no shadow, flat radii.
*/
const button = cva(
	"inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,color,border-color] duration-150 disabled:pointer-events-none disabled:opacity-45",
	{
		variants: {
			variant: {
				primary: "bg-ink text-paper hover:opacity-90",
				neutral: "border border-rule-strong bg-paper text-ink hover:bg-tint",
				ghost: "text-ink-2 hover:bg-tint hover:text-ink",
				danger: "text-ink-2 hover:bg-danger-soft hover:text-danger",
			},
			size: {
				sm: "h-7 rounded-control px-2 text-tiny",
				md: "h-8 rounded-control px-3 text-ui",
				icon: "size-7 rounded-control",
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
