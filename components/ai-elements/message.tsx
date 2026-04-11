import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type MessageResponseProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
  parseIncompleteMarkdown?: boolean;
};

function MessageResponse({
  children,
  className,
  parseIncompleteMarkdown,
  ...props
}: MessageResponseProps) {
  void parseIncompleteMarkdown;

  return (
    <div
      data-slot="message-response"
      className={cn(
        "whitespace-pre-wrap break-words text-[13px] leading-relaxed text-zinc-700",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { MessageResponse };
