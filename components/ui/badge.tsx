import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-emerald-200 bg-emerald-50 text-emerald-700",
      secondary: "border-slate-200 bg-slate-100/80 text-slate-700",
      destructive: "border-red-200 bg-red-50 text-red-700",
      warning: "border-amber-200 bg-amber-50 text-amber-700",
      outline: "border-slate-200 bg-white/50 text-slate-600",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
