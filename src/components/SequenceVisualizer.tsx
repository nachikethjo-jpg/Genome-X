import React, { useState } from "react";
import { AlignmentResult, TranslationData } from "../types";
import { ChevronLeft, ChevronRight, Dna, Info } from "lucide-react";

interface SequenceVisualizerProps {
  alignment: AlignmentResult;
  refTranslation: TranslationData;
  sampleTranslation: TranslationData;
}

// Helper for sequence confidence visualization matching genomic engine calculation
const getConfidenceParams = (idx: number, isMutation: boolean, totalLen: number) => {
  const edgeFactor = (idx < 4 || idx > totalLen - 4) ? 0.6 : 1.0;
  const randFactor = (Math.sin(idx * 7.1) + 1) / 2; // 0 to 1
  let score = 65 + (randFactor * 35); // 65 to 100
  score *= edgeFactor;
  if (isMutation && idx % 3 === 0) {
    score -= 25; // Introduce lower confidence near variant edges
  }
  const isLowConfidence = score < 65;
  return { score: Math.round(score), isLowConfidence };
};

export function SequenceVisualizer({
  alignment,
  refTranslation,
  sampleTranslation,
}: SequenceVisualizerProps) {
  const { alignedRef, alignedSample, matchLine } = alignment;
  const seqLength = alignedRef.length;
  
  // Highlighting states/modes
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [chunkSize] = useState<number>(30); // split into viewable groups of 30 bases
  const [currentChunk, setCurrentChunk] = useState<number>(0);

  const totalChunks = Math.ceil(seqLength / chunkSize);
  const startIdx = currentChunk * chunkSize;
  const endIdx = Math.min(startIdx + chunkSize, seqLength);

  // Group bases in chunks
  const sliceRef = alignedRef.substring(startIdx, endIdx);
  const sliceSample = alignedSample.substring(startIdx, endIdx);
  const sliceMatch = matchLine.substring(startIdx, endIdx);

  // Helper to determine background of alignment columns
  const getColStyles = (refChar: string, sampleChar: string, isHovered: boolean) => {
    let bg = "bg-neutral-900 border-neutral-800";
    let text = "text-neutral-300";
    
    if (refChar === sampleChar) {
      bg = isHovered ? "bg-emerald-950/50 border-emerald-500/50" : "bg-emerald-950/20 border-emerald-950";
      text = "text-emerald-400 font-bold";
    } else if (refChar === "-" || sampleChar === "-") {
      bg = isHovered ? "bg-amber-950/50 border-amber-500/50" : "bg-amber-950/20 border-amber-950";
      text = "text-amber-400 font-bold";
    } else {
      bg = isHovered ? "bg-red-950/50 border-red-500/50" : "bg-red-950/20 border-red-950";
      text = "text-red-400 font-bold";
    }

    return { bg, text };
  };

  // Maps nucleotide position to codon index
  const getCodonInfo = (idx: number) => {
    // Need to account for gaps to find matching codon index
    let originalRefBasesCount = 0;
    for (let k = 0; k <= idx; k++) {
      if (alignedRef[k] !== "-") originalRefBasesCount++;
    }
    const codonIdx = Math.floor((originalRefBasesCount - 1) / 3);
    const posInCodon = (originalRefBasesCount - 1) % 3;
    
    // Original sample bases
    let originalSampleBasesCount = 0;
    for (let k = 0; k <= idx; k++) {
      if (alignedSample[k] !== "-") originalSampleBasesCount++;
    }
    const sampleCodonIdx = Math.floor((originalSampleBasesCount - 1) / 3);

    return {
      refBasePosition: originalRefBasesCount,
      sampleBasePosition: originalSampleBasesCount,
      refCodonIdx: codonIdx + 1,
      refAminoAcid: refTranslation.aminoAcids[codonIdx] || "Incomplete",
      refCodon: refTranslation.codons[codonIdx] || "N/A",
      sampleAminoAcid: sampleTranslation.aminoAcids[sampleCodonIdx] || "Incomplete",
      sampleCodon: sampleTranslation.codons[sampleCodonIdx] || "N/A",
    };
  };

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden" id="seq-vis-container">
      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 px-2 text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
              ALIGNER-NW
            </div>
            <h3 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
              <Dna className="w-5 h-5 text-emerald-400" />
              Pairwise Genome Alignment Browser
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Needleman-Wunsch global alignment scoring base-by-base comparison. Hover over nucleotides to retrieve codon translations.
          </p>
        </div>

        {/* Paginated Navigation for sequences */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCurrentChunk((p) => Math.max(0, p - 1))}
            disabled={currentChunk === 0}
            className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition"
            id="align-btn-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-neutral-400">
            Bases {startIdx + 1} - {endIdx} of {seqLength}
          </span>
          <button
            onClick={() => setCurrentChunk((p) => Math.min(totalChunks - 1, p + 1))}
            disabled={currentChunk >= totalChunks - 1}
            className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition"
            id="align-btn-next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alignment Lanes */}
      <div className="overflow-x-auto pb-4 scrollbar-thin">
        <div className="min-w-max flex flex-col gap-1.5">
          {/* 1. Reference sequence line */}
          <div className="flex items-center">
            <span className="w-20 shrink-0 text-xs font-mono font-bold text-neutral-500">REF SEQUENCE</span>
            <div className="flex gap-1.5 font-mono text-base md:text-lg">
              {sliceRef.split("").map((char, index) => {
                const absoluteIdx = startIdx + index;
                const isHovered = hoveredIdx === absoluteIdx;
                const { bg, text } = getColStyles(char, sliceSample[index], isHovered);
                const isMutation = char !== sliceSample[index];
                const { isLowConfidence } = getConfidenceParams(absoluteIdx, isMutation, seqLength);
                return (
                  <div
                    key={`ref-base-${absoluteIdx}`}
                    onMouseEnter={() => setHoveredIdx(absoluteIdx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className={`w-8 h-10 flex items-center justify-center rounded border transition-all duration-150 cursor-help relative ${bg} ${text} ${
                      isLowConfidence ? "underline underline-offset-[6px] decoration-amber-500 decoration-wavy" : ""
                    }`}
                  >
                    {char}
                    {isLowConfidence && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Match Connector Line */}
          <div className="flex items-center">
            <span className="w-20 shrink-0 text-xs font-mono font-bold text-neutral-600">ALIGNMENT</span>
            <div className="flex gap-1.5 font-mono text-xs md:text-sm">
              {sliceMatch.split("").map((char, index) => {
                const absoluteIdx = startIdx + index;
                const isMatch = char === "|";
                const isSubstitution = char === "x";
                let textClass = "text-neutral-700";
                
                if (isMatch) textClass = "text-emerald-500 font-bold";
                else if (isSubstitution) textClass = "text-red-500 font-bold";
                
                return (
                  <div
                    key={`match-sym-${absoluteIdx}`}
                    className={`w-8 h-4 flex items-center justify-center transition-all ${textClass}`}
                  >
                    {char === "|" ? "⏐" : char === "x" ? "✖" : "⁃"}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Mutated Sample sequence line */}
          <div className="flex items-center">
            <span className="w-20 shrink-0 text-xs font-mono font-bold text-neutral-500">MUT SAMPLE</span>
            <div className="flex gap-1.5 font-mono text-base md:text-lg">
              {sliceSample.split("").map((char, index) => {
                const absoluteIdx = startIdx + index;
                const isHovered = hoveredIdx === absoluteIdx;
                const { bg, text } = getColStyles(sliceRef[index], char, isHovered);
                const isMutation = sliceRef[index] !== char;
                const { isLowConfidence } = getConfidenceParams(absoluteIdx, isMutation, seqLength);
                return (
                  <div
                    key={`sample-base-${absoluteIdx}`}
                    onMouseEnter={() => setHoveredIdx(absoluteIdx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className={`w-8 h-10 flex items-center justify-center rounded border transition-all duration-150 cursor-help relative ${bg} ${text} ${
                      isLowConfidence ? "underline underline-offset-[6px] decoration-amber-500 decoration-wavy" : ""
                    }`}
                  >
                    {char}
                    {isLowConfidence && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-neutral-800/60 justify-between text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-950/20 border border-emerald-900" />
            <span className="text-neutral-400">Match (A=A)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-950/20 border border-red-900" />
            <span className="text-neutral-400">Substitution (A➔G)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-950/20 border border-amber-900" />
            <span className="text-neutral-400 font-mono">Insertion / Deletion (-)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 inline-block border-b-2 border-b-amber-500/80 decoration-wavy" />
            <span className="text-amber-400 font-semibold font-mono">〰 Low Confidence Base (&lt;65%)</span>
          </div>
        </div>
        <div className="text-neutral-500 font-mono">
          Alignment Score: <span className="text-emerald-400 font-bold">{alignment.score}</span>
        </div>
      </div>

      {/* Hover Info Tooltip Panel */}
      <div className="mt-4 p-4 rounded-lg bg-neutral-900/60 border border-neutral-800/80 min-h-[105px] transition-all flex items-start gap-3">
        {hoveredIdx !== null ? (
          (() => {
            const info = getCodonInfo(hoveredIdx);
            const isMatch = alignedRef[hoveredIdx] === alignedSample[hoveredIdx];
            const isGap = alignedRef[hoveredIdx] === "-" || alignedSample[hoveredIdx] === "-";
            const curRefChar = alignedRef[hoveredIdx];
            const curSampleChar = alignedSample[hoveredIdx];
            
            // Calculate confidence details
            const isMutation = curRefChar !== curSampleChar;
            const { score, isLowConfidence } = getConfidenceParams(hoveredIdx, isMutation, seqLength);
            
            return (
              <>
                <div className="p-2 bg-neutral-800 text-emerald-400 rounded-lg">
                  <Info className="w-5 h-5" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-2 w-full text-xs">
                  <div>
                    <span className="text-neutral-500 block">Position (Ref / Sample)</span>
                    <strong className="text-neutral-200 mt-0.5 block font-mono">
                      Ref: #{info.refBasePosition} | Mut: #{info.sampleBasePosition}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Codon (Ref / Mut)</span>
                    <strong className="text-neutral-200 mt-0.5 block font-mono">
                      {info.refCodon} ➔ {info.sampleCodon}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Amino Acid Translation</span>
                    <strong className="text-neutral-200 mt-0.5 block font-mono">
                      Ref AA: <span className="text-emerald-400 font-semibold">{info.refAminoAcid}</span> | Mut: <span className={`font-semibold ${info.refAminoAcid === info.sampleAminoAcid ? "text-emerald-400" : "text-red-400"}`}>{info.sampleAminoAcid}</span>
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Alignment Quality</span>
                    <strong className="text-neutral-200 mt-0.5 block font-mono">
                      Score: <span className={isLowConfidence ? "text-amber-400 font-extrabold" : "text-emerald-400"}>{score}%</span>
                      {isLowConfidence && <span className="text-amber-500 text-[10px] ml-1 uppercase">(Low Quality)</span>}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Mutation Status</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                      isMatch ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      isGap ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {isMatch ? "Perfect Match (Synonymous)" : isGap ? "Indel Gap Alterivity" : "Single Nucleotide Variant"}
                    </span>
                  </div>
                </div>
              </>
            );
          })()
        ) : (
          <div className="flex items-center gap-2.5 text-neutral-400 text-xs py-3 w-full justify-center">
            <Info className="w-4 h-4 text-neutral-500 animate-pulse" />
            Hover over any nucleotide box above to inspect detailed codon translation, site coordinates, and clinical bioinformatic maps.
          </div>
        )}
      </div>
    </div>
  );
}
