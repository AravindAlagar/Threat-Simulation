import React from "react";
import { cn } from "../utils/cn";

interface CardProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}

export function Card({ title, icon, children, className, right }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 md:p-5",
        "shadow-sm transition hover:border-slate-300 hover:shadow-md",
        className
      )}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
            {icon && <span className="text-[#00d9ff]">{icon}</span>}
            {title}
          </h2>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
