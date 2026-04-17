"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

let _counter = 0;

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string>(`mermaid-${++_counter}`);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    function fitSvgToFrame() {
      const host = canvasRef.current;
      const svgEl = host?.querySelector("svg");
      if (!host || !svgEl) return;

      const viewBox = svgEl.viewBox.baseVal;
      const sourceWidth =
        viewBox?.width ||
        Number.parseFloat(svgEl.getAttribute("width") ?? "") ||
        svgEl.getBBox().width;
      const sourceHeight =
        viewBox?.height ||
        Number.parseFloat(svgEl.getAttribute("height") ?? "") ||
        svgEl.getBBox().height;

      if (!sourceWidth || !sourceHeight) return;

      const frameWidth = Math.max(host.clientWidth - 8, 0);
      const frameHeight = 260;
      const scale = Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);

      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svgEl.style.display = "block";
      svgEl.style.width = `${Math.floor(sourceWidth * scale)}px`;
      svgEl.style.height = `${Math.floor(sourceHeight * scale)}px`;
      svgEl.style.maxWidth = "none";
      svgEl.style.overflow = "visible";
    }

    async function render() {
      const mermaid = (await import("mermaid")).default;

      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          primaryColor: "#f0fdfa",
          primaryTextColor: "#0f766e",
          primaryBorderColor: "#2dd4bf",
          lineColor: "#94a3b8",
          background: "#ffffff",
          mainBkg: "#f0fdfa",
          nodeBorder: "#2dd4bf",
          clusterBkg: "#f8fafc",
          edgeLabelBackground: "#f8fafc",
          fontFamily:
            "'GeistSans', 'Geist Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
          fontSize: "16px",
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
          padding: 14,
          nodeSpacing: 24,
          rankSpacing: 28,
          useMaxWidth: true,
        },
      });

      try {
        const { svg } = await mermaid.render(idRef.current, chart);
        if (!cancelled && canvasRef.current) {
          canvasRef.current.innerHTML = svg;
          fitSvgToFrame();
          resizeObserver = new ResizeObserver(() => {
            fitSvgToFrame();
          });
          resizeObserver.observe(canvasRef.current);
        }
      } catch (e) {
        console.error("Mermaid render error:", e);
      }
    }

    render();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [chart]);

  return (
    <div className={cn("rounded-[30px] border border-border/70 bg-card", className)}>
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
        <div>
          <p className="text-[12px] font-medium text-foreground">Static loop overview</p>
          <p className="text-[12px] text-muted-foreground">
            Compact view of how rep behavior becomes the next checkpoint.
          </p>
        </div>
      </div>

      <div className="overflow-hidden px-4 py-4 sm:px-5">
        <div
          ref={canvasRef}
          className="mx-auto flex h-[300px] max-w-[860px] items-center justify-center"
        />
      </div>
    </div>
  );
}
