"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
export function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) { return <TabsPrimitive.Root className={cn("flex flex-col gap-4", className)} {...props} />; }
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) { return <TabsPrimitive.List className={cn("inline-flex h-11 w-fit items-center rounded-xl bg-slate-100/80 p-1", className)} {...props} />; }
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) { return <TabsPrimitive.Trigger className={cn("inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium text-slate-500 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm", className)} {...props} />; }
export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) { return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />; }
