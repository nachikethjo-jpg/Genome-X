import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

export interface ScatterVariant {
  index: number;
  position: number;
  pathogenicity: string;
  type: string;
  id: string; // e.g. #VAR-1
}

interface Props {
  variants: ScatterVariant[];
  onVariantClick?: (index: number) => void;
  selectedVariantIdx: number | null;
}

export const VariantScatterPlot: React.FC<Props> = ({ variants, onVariantClick, selectedVariantIdx }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || variants.length === 0) {
       if (containerRef.current && variants.length === 0) {
         d3.select(containerRef.current).selectAll("*").remove();
       }
       return;
    }

    const width = containerRef.current.clientWidth;
    const height = 240;
    const margin = { top: 20, right: 30, bottom: 40, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    d3.select(containerRef.current).selectAll("*").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const getScore = (patho: string) => {
      if (patho.includes("Likely Pathogenic")) return 4;
      if (patho.includes("Pathogenic")) return 5;
      if (patho.includes("VUS")) return 3;
      if (patho.includes("Likely Benign")) return 2;
      if (patho.includes("Benign")) return 1;
      return 0;
    };

    const positions: number[] = variants.map(d => d.position);
    const maxPos = d3.max(positions) || 100;
    const xScale = d3.scaleLinear()
      .domain([0, maxPos])
      .range([0, innerWidth])
      .nice();

    const yScale = d3.scaleLinear()
      .domain([0, 6])
      .range([innerHeight, 0]);

    // X Axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .attr("color", "#64748b")
      .attr("font-family", "monospace")
      .attr("font-size", "10px")
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 35)
      .attr("fill", "#64748b")
      .text("Genome Position (bp)");

    // Y Axis
    const yAxisTicks = [1, 2, 3, 4, 5];
    const yTickLabels = ["Benign", "Likely Benign", "VUS", "Likely Pathogenic", "Pathogenic"];
    g.append("g")
      .call(d3.axisLeft(yScale).tickValues(yAxisTicks).tickFormat((d, i) => yTickLabels[i]))
      .attr("color", "#64748b")
      .attr("font-family", "monospace")
      .attr("font-size", "10px");
      
    // Tooltip
    // Container must be relative
    const tooltip = d3.select(containerRef.current)
      .append("div")
      .style("opacity", 0)
      .attr("class", "absolute bg-slate-900 border border-slate-700 text-slate-300 text-[10px] p-2 rounded shadow-lg pointer-events-none font-mono z-10");
      
    // Gridlines for Y
    g.append("g")
      .attr("class", "grid")
      .attr("color", "#1e293b")
      .attr("stroke-dasharray", "3,3")
      .call(d3.axisLeft(yScale)
          .tickValues(yAxisTicks)
          .tickSize(-innerWidth)
          .tickFormat(() => "")
      )
      .select(".domain").remove();

    // Circles
    g.selectAll<SVGCircleElement, ScatterVariant>(".variant-circle")
      .data(variants)
      .enter()
      .append("circle")
      .attr("class", "variant-circle")
      .attr("cx", (d: ScatterVariant) => xScale(d.position))
      .attr("cy", (d: ScatterVariant) => yScale(getScore(d.pathogenicity)))
      .attr("r", (d: ScatterVariant) => d.index === selectedVariantIdx ? 8 : 5)
      .attr("fill", (d: ScatterVariant) => {
        const score = getScore(d.pathogenicity);
        if (score >= 4) return "#ef4444";
        if (score === 3) return "#f59e0b";
        return "#10b981";
      })
      .attr("opacity", (d: ScatterVariant) => d.index === selectedVariantIdx ? 1 : 0.7)
      .attr("stroke", (d: ScatterVariant) => d.index === selectedVariantIdx ? "#fff" : "transparent")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d: ScatterVariant) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 8)
          .attr("opacity", 1);
          
        tooltip.transition()
          .duration(200)
          .style("opacity", .9);
          
        const [x, y] = d3.pointer(event, containerRef.current);
          
        tooltip.html(`
          <div class="font-bold text-teal-400 mb-1">${d.id}</div>
          <div>Pos: ${d.position} bp</div>
          <div>Type: ${d.type}</div>
          <div>Patho: ${d.pathogenicity}</div>
        `)
          .style("left", (x + 10) + "px")
          .style("top", (y - 28) + "px");
      })
      .on("mouseout", function(event, d: ScatterVariant) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d.index === selectedVariantIdx ? 8 : 5)
          .attr("opacity", d.index === selectedVariantIdx ? 1 : 0.7);
          
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      })
      .on("click", function(event, d: ScatterVariant) {
         if (onVariantClick) {
            onVariantClick(d.index);
         }
      });
      
  }, [variants, selectedVariantIdx, onVariantClick]);

  if (variants.length === 0) {
    return (
      <div className="w-full h-[240px] flex items-center justify-center border border-slate-800 rounded-xl bg-[#121216]">
        <span className="text-sm font-mono text-slate-500">No variants available to plot</span>
      </div>
    );
  }

  return (
    <div className="relative w-full border border-slate-850 rounded-xl bg-[#121216] p-2">
      <div ref={containerRef} className="w-full h-[240px]" />
    </div>
  );
};
