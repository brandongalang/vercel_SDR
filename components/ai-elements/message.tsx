import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type MessageProps = ComponentPropsWithoutRef<"div"> & {
  from: "user" | "assistant" | string;
};

type MessageResponseProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
  parseIncompleteMarkdown?: boolean;
};

function Message({ from, className, ...props }: MessageProps) {
  const isUser = from === "user";

  return (
    <div
      data-from={from}
      data-slot="message"
      className={cn("group flex w-full", isUser ? "justify-end" : "justify-start", className)}
      {...props}
    />
  );
}

function MessageContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full max-w-full flex-col gap-2",
        "group-data-[from=user]:max-w-[min(560px,92%)] group-data-[from=user]:rounded-2xl group-data-[from=user]:border group-data-[from=user]:border-zinc-200 group-data-[from=user]:bg-zinc-100/80 group-data-[from=user]:px-4 group-data-[from=user]:py-3",
        className,
      )}
      {...props}
    />
  );
}

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

export { Message, MessageContent, MessageResponse };
