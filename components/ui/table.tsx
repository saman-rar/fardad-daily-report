import * as React from "react";
import { cn } from "@/lib/utils";
export function Table({ className, ...props }: React.ComponentProps<"table">) { return <div className="relative w-full overflow-x-auto soft-scrollbar"><table className={cn("w-full caption-bottom text-sm", className)} {...props} /></div>; }
export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) { return <thead className={cn("[&_tr]:border-b [&_tr]:border-slate-200/70", className)} {...props} />; }
export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) { return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />; }
export function TableRow({ className, ...props }: React.ComponentProps<"tr">) { return <tr className={cn("border-b border-slate-100 transition-colors hover:bg-white/55", className)} {...props} />; }
export function TableHead({ className, ...props }: React.ComponentProps<"th">) { return <th className={cn("h-11 px-3 text-right align-middle text-xs font-medium text-slate-500", className)} {...props} />; }
export function TableCell({ className, ...props }: React.ComponentProps<"td">) { return <td className={cn("p-3 align-middle text-slate-700", className)} {...props} />; }
