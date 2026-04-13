"use client";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { useEffect, useState } from "react";

const reasoningSteps = [
  "Let me think about this problem step by step.",
  "\n\nFirst, I need to understand what the user is asking for.",
  "\n\nThey want a reasoning component that opens automatically when streaming begins and closes when streaming finishes. The component should be composable and follow existing patterns in the codebase.",
  "\n\nThis seems like a collapsible component with state management would be the right approach.",
].join("");

function chunkIntoTokens(text: string): string[] {
  const chunkPattern = [3, 4];
  const chunks: string[] = [];
  let i = 0;
  let patternIndex = 0;

  while (i < text.length) {
    const chunkSize = chunkPattern[patternIndex % chunkPattern.length];
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize;
    patternIndex += 1;
  }

  return chunks;
}

const Example = () => {
  const [content, setContent] = useState("");
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const [tokens] = useState<string[]>(() => chunkIntoTokens(reasoningSteps));
  const isStreaming = currentTokenIndex < tokens.length;

  useEffect(() => {
    if (currentTokenIndex >= tokens.length) {
      return;
    }

    const timer = setTimeout(() => {
      setContent((prev) => prev + tokens[currentTokenIndex]);
      setCurrentTokenIndex((prev) => prev + 1);
    }, 25);

    return () => clearTimeout(timer);
  }, [currentTokenIndex, tokens]);

  return (
    <div className="w-full p-4" style={{ height: "300px" }}>
      <Reasoning className="w-full" isStreaming={isStreaming}>
        <ReasoningTrigger />
        <ReasoningContent>{content}</ReasoningContent>
      </Reasoning>
    </div>
  );
};

export default Example;
