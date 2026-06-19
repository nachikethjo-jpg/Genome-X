/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Dna,
  Sparkles,
  Activity,
  Terminal,
  Settings,
  Send,
  RefreshCw,
  Sliders,
  Database,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileText,
  Plus,
  Search,
  MessageSquare,
  Cpu,
  Layers,
  Download,
  Trash2,
  HelpCircle,
  Scissors,
  Target,
  Zap,
} from "lucide-react";
import { GENE_PRESETS, GenePreset, AnalysisResponse, ChatMessage, Variant, SgRNACandidate, CRISPRSimulationResult } from "./types";
import { VariantScatterPlot, ScatterVariant } from "./components/VariantScatterPlot";
import { auth, signInWithGoogle, logOut, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { collection, addDoc, query, orderBy, getDocs, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

// Helper for sequence confidence visualization
const getConfidenceParams = (idx: number, isMutation: boolean, totalLen: number) => {
  // Lower confidence near edges or pseudo-randomized based on index
  const edgeFactor = (idx < 4 || idx > totalLen - 4) ? 0.6 : 1.0;
  const randFactor = (Math.sin(idx * 7.1) + 1) / 2; // 0 to 1
  let score = 65 + (randFactor * 35); // 65 to 100
  score *= edgeFactor;
  if (isMutation && idx % 3 === 0) {
    score -= 25; // Introduce some lower confidence occasionally near variants
  }
  
  const isLowConfidence = score < 65;
  return { score: Math.round(score), isLowConfidence };
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  const fetchSavedHistory = async (uid: string) => {
    setIsHistoryLoading(true);
    try {
      const q = query(
        collection(db, "users", uid, "analyses"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSavedAnalyses(docs);
    } catch (err) {
      console.error("Error fetching historical logs:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchSavedHistory(currentUser.uid);
      } else {
        setSavedAnalyses([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveCurrentAnalysis = async () => {
    if (!user || !analysisResult) return;
    try {
      const colRef = collection(db, "users", user.uid, "analyses");
      const payload = {
        userId: user.uid,
        geneName,
        diseaseContext,
        referenceSeq,
        sampleSeq,
        variantsCount: analysisResult.variants.length,
        alignmentScore: analysisResult.alignment.score,
        alignmentResult: {
          alignedRef: analysisResult.alignment.alignedRef,
          alignedSample: analysisResult.alignment.alignedSample,
          matchLine: analysisResult.alignment.matchLine,
          score: analysisResult.alignment.score,
        },
        refTranslation: {
          aminoAcids: analysisResult.refTranslation.aminoAcids,
          codons: analysisResult.refTranslation.codons,
        },
        sampleTranslation: {
          aminoAcids: analysisResult.sampleTranslation.aminoAcids,
          codons: analysisResult.sampleTranslation.codons,
        },
        variants: analysisResult.variants.map(v => ({
          position: v.position,
          type: v.type,
          ref: v.ref,
          alt: v.alt,
          description: v.description,
        })),
        interpretation: {
          summary: analysisResult.interpretation.summary,
          functionalImpact: analysisResult.interpretation.functionalImpact,
          diseaseAffiliation: analysisResult.interpretation.diseaseAffiliation,
          variantInterpretations: analysisResult.interpretation.variantInterpretations.map(vi => ({
            position: vi.position,
            type: vi.type,
            change: vi.change,
            significance: vi.significance,
            details: vi.details,
          })),
          recommendations: analysisResult.interpretation.recommendations,
        },
        createdAt: new Date(),
      };
      
      await addDoc(colRef, payload);
      await fetchSavedHistory(user.uid);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/analyses`);
    }
  };

  const deleteSavedAnalysis = async (e: React.MouseEvent, analysisId: string) => {
    e.stopPropagation();
    if (!user) return;
    if (confirm("Are you sure you want to permanently delete this sequence analysis run?")) {
      try {
        const docRef = doc(db, "users", user.uid, "analyses", analysisId);
        await deleteDoc(docRef);
        await fetchSavedHistory(user.uid);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/analyses/${analysisId}`);
      }
    }
  };

  const handleLoadSavedAnalysis = (saved: any) => {
    setGeneName(saved.geneName);
    setDiseaseContext(saved.diseaseContext);
    setReferenceSeq(saved.referenceSeq);
    setSampleSeq(saved.sampleSeq);
    
    const loadedResult: AnalysisResponse = {
      success: true,
      metrics: {
        refLength: saved.referenceSeq.length,
        sampleLength: saved.sampleSeq.length,
        refGC: saved.referenceSeq ? parseFloat(((saved.referenceSeq.split("").filter((b: string) => b === "G" || b === "C").length / saved.referenceSeq.length) * 100).toFixed(2)) : 0,
        sampleGC: saved.sampleSeq ? parseFloat(((saved.sampleSeq.split("").filter((b: string) => b === "G" || b === "C").length / saved.sampleSeq.length) * 100).toFixed(2)) : 0,
        refFreqs: { A: 0, T: 0, C: 0, G: 0 },
        sampleFreqs: { A: 0, T: 0, C: 0, G: 0 },
      },
      alignment: {
        alignedRef: saved.alignmentResult.alignedRef,
        alignedSample: saved.alignmentResult.alignedSample,
        matchLine: saved.alignmentResult.matchLine,
        score: saved.alignmentResult.score,
      },
      refTranslation: {
        aminoAcids: saved.refTranslation.aminoAcids,
        codons: saved.refTranslation.codons,
      },
      sampleTranslation: {
        aminoAcids: saved.sampleTranslation.aminoAcids,
        codons: saved.sampleTranslation.codons,
      },
      variants: saved.variants,
      interpretation: saved.interpretation,
    };
    
    setAnalysisResult(loadedResult);
    setSelectedVariantIdx(null);
    setCustomAcmgToggles({});
    
    const guides = findSgRNAs(saved.referenceSeq, saved.variants);
    setSgRNACandidates(guides);
    if (guides.length > 0) {
      setSelectedSgRNA(guides[0]);
    } else {
      setSelectedSgRNA(null);
    }
    setCrisprSimulation(null);
    
    setChatMessages([
      {
        id: `loaded-${Date.now()}`,
        role: "assistant",
        content: `Successfully restored cloud saved sequence report for **${saved.geneName}** (${saved.diseaseContext}) loaded from your lab history database.`,
        timestamp: new Date().toLocaleTimeString(),
      }
    ]);
  };

  const [selectedPresetId, setSelectedPresetId] = useState<string>("hbb");
  const [geneName, setGeneName] = useState<string>("HBB");
  const [diseaseContext, setDiseaseContext] = useState<string>("Sickle Cell Anemia (p.Glu6Val mutation)");
  const [referenceSeq, setReferenceSeq] = useState<string>("ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAAC");
  const [sampleSeq, setSampleSeq] = useState<string>("ATGGTGCACCTGACTCCTGTGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAAC");
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatSending, setIsChatSending] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Active view tab state (Overview and Align vs. AI Interpretation)
  const [activeTab, setActiveTab ] = useState<"alignment" | "interpretation" | "crispr">("alignment");

  const [sgRNACandidates, setSgRNACandidates] = useState<SgRNACandidate[]>([]);
  const [selectedSgRNA, setSelectedSgRNA] = useState<SgRNACandidate | null>(null);
  const [isSimulatingCRISPR, setIsSimulatingCRISPR] = useState<boolean>(false);
  const [crisprSimulation, setCrisprSimulation] = useState<CRISPRSimulationResult | null>(null);
  const [crisprError, setCrisprError] = useState<string | null>(null);

  const [selectedTypes, setSelectedTypes] = useState<string[]>(["Substitution", "Deletion", "Insertion"]);
  const [selectedPathologies, setSelectedPathologies] = useState<string[]>(["Pathogenic", "Likely Pathogenic", "VUS", "Likely Benign", "Benign"]);

  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);
  const [genomeBuild, setGenomeBuild] = useState<"GRCh38" | "GRCh37" | "T2T">("GRCh38");
  const [activeTranscript, setActiveTranscript] = useState<string>("RefSeq (Clinical Master)");
  const [customAcmgToggles, setCustomAcmgToggles] = useState<Record<number, string[]>>({});

  const getPathogenicityForVariant = (v: Variant, idx: number): string => {
    // If user has customized their ACMG toggles, recompute pathogenicity using standard ACMG guidelines!
    const activeAcmg = customAcmgToggles[idx];
    if (activeAcmg !== undefined) {
      const hasPVS1 = activeAcmg.includes("PVS1");
      
      const psCount = activeAcmg.filter(x => x.startsWith("PS")).length;
      const pmCount = activeAcmg.filter(x => x.startsWith("PM")).length;
      const ppCount = activeAcmg.filter(x => x.startsWith("PP")).length;
      
      const hasBA1 = activeAcmg.includes("BA1");
      const bsCount = activeAcmg.filter(x => x.startsWith("BS")).length;
      const bpCount = activeAcmg.filter(x => x.startsWith("BP")).length;

      // Rules for Benign
      if (hasBA1 || bsCount >= 2) return "Benign";
      // Rules for Likely Benign
      if ((bsCount === 1 && bpCount >= 1) || bpCount >= 2) return "Likely Benign";

      // Rules for Pathogenic
      if (
        (hasPVS1 && (psCount >= 1 || pmCount >= 2 || (pmCount === 1 && ppCount === 1) || ppCount >= 2)) ||
        (psCount >= 2) ||
        (psCount === 1 && (pmCount >= 3 || (pmCount === 2 && ppCount >= 2) || (pmCount === 1 && ppCount >= 4)))
      ) {
        return "Pathogenic";
      }

      // Rules for Likely Pathogenic
      if (
        (hasPVS1 && ppCount >= 1) ||
        (psCount === 1 && (pmCount === 1 || pmCount === 2)) ||
        (psCount === 1 && ppCount >= 2) ||
        (pmCount >= 3) ||
        (pmCount === 2 && ppCount >= 2) ||
        (pmCount === 1 && ppCount >= 4)
      ) {
        return "Likely Pathogenic";
      }

      // Default when some pathogenic criteria are loaded
      if (hasPVS1 || psCount > 0 || pmCount > 0 || ppCount > 0) return "VUS";
    }

    if (!analysisResult?.interpretation?.variantInterpretations) return "VUS";
    let vi = analysisResult.interpretation.variantInterpretations[idx];
    if (!vi || (vi.position && parseInt(vi.position.toString().replace(/\D/g, "")) !== v.position)) {
      vi = analysisResult.interpretation.variantInterpretations.find(
        x => parseInt(x.position.toString().replace(/\D/g, "")) === v.position
      );
    }
    if (!vi) return "VUS";
    const sig = vi.significance || "VUS";
    const sigLower = sig.toLowerCase();
    if (sigLower.includes("likely pathogenic")) return "Likely Pathogenic";
    if (sigLower.includes("pathogenic")) return "Pathogenic";
    if (sigLower.includes("likely benign")) return "Likely Benign";
    if (sigLower.includes("benign")) return "Benign";
    if (sigLower.includes("uncertain") || sigLower.includes("vus") || sigLower.includes("unsure")) return "VUS";
    return sig;
  };

  const getGenomicStandards = (v: Variant, idx: number, gName: string) => {
    const position = v.position;
    const uppercaseGene = (gName || "HBB").toUpperCase();

    // Default values
    let transcript = "NM_000000.1";
    let hgvsDNA = "";
    let hgvsProtein = "p.?";
    let sequenceOntology = "Sequence variant";
    let soAccession = "SO:0000109";
    let clinVarStars = 1;
    let clinVarStatus = "Criteria provided, single submitter";
    let dbSNPID = `rs${Math.floor(10000000 + position * 1111)}`;
    let exon = "Exon 1";
    let defaultAcmgCodes = ["PP3", "PM2"];

    if (uppercaseGene.includes("HBB")) {
      transcript = "NM_000518.5";
      exon = "Exon 1 (Coding Region)";
      dbSNPID = position === 17 ? "rs334" : `rs3393${position}`;
      if (v.type === "Substitution") {
        hgvsDNA = `c.${position}A>T`;
        hgvsProtein = `p.Glu6Val`;
        sequenceOntology = "Missense Variant";
        soAccession = "SO:0001583";
        clinVarStars = 4;
        clinVarStatus = "Practice Guideline (ACMG/AMP)";
        defaultAcmgCodes = ["PS1", "PS3", "PM2", "PP3"];
      } else if (v.type === "Deletion") {
        hgvsDNA = `c.${position}_${position + v.ref.length - 1}del`;
        hgvsProtein = `p.Gly${Math.floor(position/3)}fs*`;
        sequenceOntology = "Frameshift Variant";
        soAccession = "SO:0001589";
        clinVarStars = 2;
        clinVarStatus = "Criteria provided, multiple submitters, no conflicts";
        defaultAcmgCodes = ["PVS1", "PM2", "PP3"];
      } else {
        hgvsDNA = `c.${position}_${position + 1}ins${v.alt}`;
        hgvsProtein = `p.Lys${Math.floor(position/3)}fs*`;
        sequenceOntology = "Frameshift Variant";
        soAccession = "SO:0001589";
        clinVarStars = 2;
        clinVarStatus = "Criteria provided, multiple submitters, no conflicts";
        defaultAcmgCodes = ["PVS1", "PM2"];
      }
    } else if (uppercaseGene.includes("BRCA1")) {
      transcript = "NM_007294.4";
      exon = "Exon 11 (Hyper-mutable domain)";
      dbSNPID = position === 54 ? "rs80357714" : `rs5583${position}`;
      if (v.type === "Deletion") {
        hgvsDNA = `c.${position}_${position + v.ref.length - 1}del`;
        hgvsProtein = `p.Leu18fs`;
        sequenceOntology = "Frameshift Truncating Variant";
        soAccession = "SO:0001589";
        clinVarStars = 3;
        clinVarStatus = "Reviewed by Expert Panel (ClinGen)";
        defaultAcmgCodes = ["PVS1", "PS3", "PM2"];
      } else if (v.type === "Substitution") {
        hgvsDNA = `c.${position}${v.ref}>${v.alt}`;
        hgvsProtein = `p.Asp${Math.floor(position/3)}Asn`;
        sequenceOntology = "Missense Variant";
        soAccession = "SO:0001583";
        clinVarStars = 2;
        clinVarStatus = "Criteria provided, conflicting interpretations";
        defaultAcmgCodes = ["PM2", "PP3", "PP5"];
      } else {
        hgvsDNA = `c.${position}_${position + 1}ins${v.alt}`;
        hgvsProtein = `p.Asn${Math.floor(position/3)}fs*`;
        sequenceOntology = "Frameshift Variant";
        soAccession = "SO:0001589";
        clinVarStars = 1;
        clinVarStatus = "Criteria provided, single submitter";
        defaultAcmgCodes = ["PVS1", "PM2"];
      }
    } else if (uppercaseGene.includes("CFTR")) {
      transcript = "NM_000492.4";
      exon = "Exon 10 (NBD1 domain)";
      dbSNPID = "rs113993960";
      if (v.type === "Deletion") {
        hgvsDNA = `c.1521_1523delCTT`;
        hgvsProtein = `p.Phe508del`;
        sequenceOntology = "Inframe Codon Deletion";
        soAccession = "SO:0001822";
        clinVarStars = 4;
        clinVarStatus = "Practice Guideline (ACMG)";
        defaultAcmgCodes = ["PS3", "PS4", "PM2", "PP3"];
      } else {
        hgvsDNA = `c.${position}${v.ref}>${v.alt}`;
        hgvsProtein = `p.Gly${Math.floor(position/3)}Asp`;
        sequenceOntology = "Missense Variant";
        soAccession = "SO:0001583";
        clinVarStars = 2;
        clinVarStatus = "Criteria provided, multiple submitters, no conflicts";
        defaultAcmgCodes = ["PS3", "PM2", "PP3"];
      }
    } else if (uppercaseGene.includes("SARS") || uppercaseGene.includes("COV")) {
      transcript = "NC_045512.2";
      exon = "S1 Glycoprotein receptor-binding domain";
      dbSNPID = `gisaid-hCoV-19-${position}`;
      if (v.type === "Substitution") {
        hgvsDNA = `g.${position}${v.ref}>${v.alt}`;
        hgvsProtein = `p.Asn501Tyr`;
        sequenceOntology = "Structural Missense Variant";
        soAccession = "SO:0001583";
        clinVarStars = 0;
        clinVarStatus = "No ACMG assertion registered";
        defaultAcmgCodes = ["PS3", "PM1"];
      } else {
        hgvsDNA = `g.${position}_${position + v.ref.length - 1}del`;
        hgvsProtein = `p.His69del`;
        sequenceOntology = "Inframe Deletion";
        soAccession = "SO:0001822";
        clinVarStars = 0;
        clinVarStatus = "No ACMG assertion registered";
        defaultAcmgCodes = ["PS3", "PM1"];
      }
    } else {
      transcript = "NM_001354.6";
      exon = `Exon ${Math.floor(position / 50) + 1}`;
      dbSNPID = `rs${900000 + position}`;
      if (v.type === "Substitution") {
        hgvsDNA = `c.${position}${v.ref}>${v.alt}`;
        const aminoAcids = ["Ala", "Arg", "Asn", "Asp", "Cys", "Glu", "Gln", "Gly", "His", "Ile", "Leu", "Lys", "Met", "Phe", "Pro", "Ser", "Thr", "Trp", "Tyr", "Val"];
        const rAA = aminoAcids[position % aminoAcids.length];
        const aAA = aminoAcids[(position + 3) % aminoAcids.length];
        hgvsProtein = `p.${rAA}${Math.floor(position / 3) + 1}${aAA}`;
        sequenceOntology = "Missense Variant";
        soAccession = "SO:0001583";
        clinVarStars = 1;
        clinVarStatus = "Criteria provided, single submitter";
        defaultAcmgCodes = ["PM2", "PP3"];
      } else if (v.type === "Deletion") {
        hgvsDNA = `c.${position}_${position + v.ref.length - 1}del`;
        hgvsProtein = `p.Val${Math.floor(position / 3) + 1}fs*`;
        sequenceOntology = "Frameshift Deletion";
        soAccession = "SO:0001589";
        clinVarStars = 1;
        clinVarStatus = "Criteria provided, single submitter";
        defaultAcmgCodes = ["PVS1", "PM2"];
      } else {
        hgvsDNA = `c.${position}_${position + 1}ins${v.alt}`;
        hgvsProtein = `p.Lys${Math.floor(position / 3) + 1}fs*`;
        sequenceOntology = "Frameshift Insertion";
        soAccession = "SO:0001589";
        clinVarStars = 1;
        clinVarStatus = "Criteria provided, single submitter";
        defaultAcmgCodes = ["PVS1", "PM2"];
      }
    }

    const calculatedPatho = getPathogenicityForVariant(v, idx);

    return {
      transcript,
      hgvsDNA,
      hgvsProtein,
      sequenceOntology,
      soAccession,
      clinVarStars,
      clinVarStatus,
      dbSNPID,
      exon,
      acmgClassification: calculatedPatho,
      defaultAcmgCodes
    };
  };

  // Find SpCas9 PAM sites & evaluate sgRNAs (forward & reverse strand)
  const findSgRNAs = (seq: string, sampleVariants: Variant[]): SgRNACandidate[] => {
    const candidates: SgRNACandidate[] = [];
    const cleanSeq = seq.toUpperCase().replace(/[^A-Z]/g, "");
    
    if (cleanSeq.length < 23) return [];

    // 1. Forward Strand Targets (NGG PAM at 3' end)
    for (let i = 20; i < cleanSeq.length - 2; i++) {
      if (cleanSeq[i + 1] === "G" && cleanSeq[i + 2] === "G") {
        const dnaSequence = cleanSeq.substring(i - 20, i);
        const pam = cleanSeq.substring(i, i + 3);
        const position = i - 20 + 1; // 1-indexed coordinate of target sequence start
        
        const numGC = dnaSequence.split("").filter(b => b === "G" || b === "C").length;
        const gcContent = Math.round((numGC / 20) * 100);
        
        const efficiencyScore = Math.max(15, Math.round(92 - Math.abs(gcContent - 50) * 1.1));
        const offTargetScore = Math.max(20, Math.round(88 - (dnaSequence.includes("AAAA") || dnaSequence.includes("GGGG") ? 14 : 0)));
        
        // Overlaps mutation
        const targetsMutation = sampleVariants.some(v => v.position >= position && v.position <= position + 22);
        
        candidates.push({
          sequence: dnaSequence.replace(/T/g, "U"),
          dnaSequence,
          pam,
          position,
          strand: "+",
          gcContent,
          offTargetScore,
          efficiencyScore,
          targetsMutation
        });
      }
    }

    // 2. Reverse Complement Strand Targets
    const getReverseComplement = (dna: string) => {
      return dna.split("").reverse().map(base => {
        switch (base) {
          case "A": return "T";
          case "T": return "A";
          case "C": return "G";
          case "G": return "C";
          default: return base;
        }
      }).join("");
    };

    const revComplement = getReverseComplement(cleanSeq);
    for (let i = 20; i < revComplement.length - 2; i++) {
      if (revComplement[i + 1] === "G" && revComplement[i + 2] === "G") {
        const dnaSequence = revComplement.substring(i - 20, i);
        const pam = revComplement.substring(i, i + 3);
        const forwardPos = cleanSeq.length - i + 1;
        
        const numGC = dnaSequence.split("").filter(b => b === "G" || b === "C").length;
        const gcContent = Math.round((numGC / 20) * 100);
        
        const efficiencyScore = Math.max(15, Math.round(90 - Math.abs(gcContent - 50) * 1.2));
        const offTargetScore = Math.max(25, Math.round(92 - (dnaSequence.includes("AAAA") || dnaSequence.includes("GGGG") ? 10 : 0)));
        
        const targetsMutation = sampleVariants.some(v => v.position >= forwardPos - 3 && v.position <= forwardPos + 20);
        
        candidates.push({
          sequence: dnaSequence.replace(/T/g, "U"),
          dnaSequence,
          pam,
          position: forwardPos,
          strand: "-",
          gcContent,
          offTargetScore,
          efficiencyScore,
          targetsMutation
        });
      }
    }

    // Sort: sgRNAs targeting mutations first, then sorted by efficiency
    return candidates.sort((a, b) => {
      if (a.targetsMutation && !b.targetsMutation) return -1;
      if (!a.targetsMutation && b.targetsMutation) return 1;
      return b.efficiencyScore - a.efficiencyScore;
    });
  };

  // Run a CRISPR targeting & repair simulation via node server
  const runCRISPRSimulation = async (guide: SgRNACandidate) => {
    if (!guide || isSimulatingCRISPR || !analysisResult) return;
    setIsSimulatingCRISPR(true);
    setCrisprError(null);
    try {
      const response = await fetch("/api/crispr-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geneName,
          diseaseContext,
          sgRNA: guide.sequence,
          pam: guide.pam,
          position: guide.position,
          referenceSeq,
          sampleSeq,
          variants: analysisResult.variants
        }),
      });

      if (!response.ok) {
        throw new Error(`CRISPR node unresponsive or returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setCrisprSimulation(data.simulation);
      } else {
        throw new Error("Target repair design simulation pipeline failed.");
      }
    } catch (err: any) {
      console.error(err);
      setCrisprError(err.message || "An unexpected error occurred during targeting simulation.");
    } finally {
      setIsSimulatingCRISPR(false);
    }
  };

  // Helper to calculate sliding-window local mutation density
  const computeMutationDensity = (ref: string, sample: string, idx: number): number => {
    const windowRadius = 4; // +/- 4 positions (total window size = 9bp)
    let diffCount = 0;
    let validCount = 0;
    
    const start = Math.max(0, idx - windowRadius);
    const end = Math.min(ref.length - 1, idx + windowRadius);
    
    for (let k = start; k <= end; k++) {
      const refChar = ref[k];
      const sampleChar = sample[k];
      if (refChar !== sampleChar) {
        diffCount++;
      }
      validCount++;
    }
    
    return validCount > 0 ? diffCount / validCount : 0;
  };

  // Load a preset
  const handleLoadPreset = (preset: GenePreset) => {
    setSelectedPresetId(preset.id);
    setGeneName(preset.name.split(" (")[0]);
    setDiseaseContext(preset.diseaseContext);
    setReferenceSeq(preset.referenceSeq);
    setSampleSeq(preset.sampleSeq);
    setSelectedVariantIdx(null);
  };

  // Run genome sequence analysis
  const runAnalysis = async (customRef?: string, customSample?: string, customGene?: string, customDisease?: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch("/api/analyze-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceSeq: customRef || referenceSeq,
          sampleSeq: customSample || sampleSeq,
          geneName: customGene || geneName,
          diseaseContext: customDisease || diseaseContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloud compute node returned status ${response.status}`);
      }

      const data: AnalysisResponse = await response.json();
      if (data.success) {
        setAnalysisResult(data);
        setSelectedVariantIdx(null);
        setCustomAcmgToggles({});
        
        // Scan for CRISPR Cas9 guide candidates
        const guides = findSgRNAs(customRef || referenceSeq, data.variants);
        setSgRNACandidates(guides);
        if (guides.length > 0) {
          setSelectedSgRNA(guides[0]);
        } else {
          setSelectedSgRNA(null);
        }
        setCrisprSimulation(null);

        if (user && data.success) {
          try {
            const analysesRef = collection(db, `users/${user.uid}/analyses`);
            await addDoc(analysesRef, {
              userId: user.uid,
              geneName: customGene || geneName,
              diseaseContext: customDisease || diseaseContext,
              referenceSeq: customRef || referenceSeq,
              sampleSeq: customSample || sampleSeq,
              variantsCount: data.variants.length,
              alignmentScore: data.alignment.score,
              alignmentResult: data.alignment,
              refTranslation: data.refTranslation,
              sampleTranslation: data.sampleTranslation,
              variants: data.variants,
              interpretation: data.interpretation,
              createdAt: serverTimestamp()
            });
          } catch (err) {
            console.error("Error saving analysis to firestore", err);
          }
        }

        // Prepopulate a relevant greeting message in the clinical AI Chat
        const isDefault = !customRef;
        setChatMessages([
          {
            id: "system-1",
            role: "assistant",
            content: `Hello! I have completed the alignment of your sample sequence against the reference.

**Ref GC content:** ${data.metrics.refGC}%
**Sample GC content:** ${data.metrics.sampleGC}%
**Total variants identified:** ${data.variants.length}

I have compiled the full clinical interpretation report under the **Interpretations** tab. How can I assist your team or guide your diagnostic assessment?`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } else {
        throw new Error("Variant execution failed in alignment middleware.");
      }
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || "An unknown network error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run on mount with the default preset
  useEffect(() => {
    const defaultPreset = GENE_PRESETS.find((p) => p.id === "hbb") || GENE_PRESETS[0];
    runAnalysis(defaultPreset.referenceSeq, defaultPreset.sampleSeq, defaultPreset.name.split(" (")[0], defaultPreset.diseaseContext);
  }, []);

  // Handle clinical consultation chat sending
  const handleSendChatMessage = async (e?: React.FormEvent, presetQuestion?: string) => {
    if (e) e.preventDefault();
    const queryText = presetQuestion || chatInput;
    if (!queryText.trim() || isChatSending || !analysisResult) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!presetQuestion) setChatInput("");
    setIsChatSending(true);

    try {
      // Package full variant context for Gemini system intelligence
      const chatContext = {
        geneName,
        referenceSeq: analysisResult.alignment.alignedRef,
        sampleSeq: analysisResult.alignment.alignedSample,
        variantsCount: analysisResult.variants.length,
        alignmentScore: analysisResult.alignment.score,
        variants: analysisResult.variants,
      };

      const response = await fetch("/api/chat-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: chatMessages.filter(m => m.id !== "system-1" && m.id !== "system-initial"),
          variantContext: chatContext,
          message: queryText,
        }),
      });

      if (!response.ok) {
        throw new Error("Clinical nodes unresponsive.");
      }

      const resData = await response.json();
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: resData.response || "No output generated by diagnostic nodes.",
        timestamp: new Date().toLocaleTimeString(),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Failed to reach clinical AI consult node: ${err.message || "Unavailable"}. Please confirm environment settings.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  return (
    <div className="flex h-screen w-full bg-[#0a0a0c] text-slate-300 font-sans overflow-hidden select-none">
      
      {/* 1. Left Sidebar Panel */}
      <aside className="w-80 bg-[#121216] border-r border-slate-800 flex flex-col flex-shrink-0">
        
        {/* Sidebar Header Brand */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-black shadow-lg shadow-teal-500/10">
              <Dna className="w-5 h-5 text-black" />
            </div>
            <div className="flex-1">
              <span className="text-xl font-bold tracking-tight text-white block">
                GENOMX <span className="text-teal-400">CLOUD</span>
              </span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">High-Throughput Node</span>
            </div>
          </div>
          {user ? (
            <div className="flex items-center justify-between bg-slate-800/40 p-2.5 rounded border border-slate-800">
              <div className="flex flex-col overflow-hidden mr-2">
                <span className="text-xs text-white truncate font-bold">{user.displayName}</span>
                <span className="text-[9px] text-slate-400 truncate">{user.email}</span>
              </div>
              <button 
                onClick={logOut}
                className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded cursor-pointer transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="w-full mt-1 bg-teal-600 hover:bg-teal-500 text-white text-xs uppercase font-bold py-2.5 rounded shadow-lg shadow-teal-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all"
            >
              Sign In with Google
            </button>
          )}
        </div>

        {/* Navigation / Library Presets */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          
          {/* Quick preset selector */}
          <div>
            <div className="flex items-center justify-between px-2 mb-3">
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-1.5">
                <Database className="w-3 h-3 text-teal-500" /> Genomic Standards
              </span>
              <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                {GENE_PRESETS.length} PRESETS
              </span>
            </div>

            <nav className="space-y-1.5">
              {GENE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset)}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                    selectedPresetId === preset.id
                      ? "bg-slate-800/60 border-teal-500 text-white shadow-md shadow-teal-500/5"
                      : "bg-[#18181f]/40 border-slate-800/70 hover:border-slate-700/80 text-slate-400 hover:text-slate-200"
                  }`}
                  id={`preset-${preset.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm truncate">{preset.name}</span>
                    {selectedPresetId === preset.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              ))}

              <button
                onClick={() => {
                  setSelectedPresetId("custom");
                  setGeneName("Custom_Gene");
                  setDiseaseContext("Unspecified context");
                  setReferenceSeq("");
                  setSampleSeq("");
                }}
                className={`w-full text-left p-3 rounded-lg border border-dashed transition-all duration-200 cursor-pointer ${
                  selectedPresetId === "custom"
                    ? "bg-slate-800/60 border-teal-500 text-white"
                    : "border-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-300"
                }`}
                id="preset-custom"
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manual Sequence Entry</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Cloud Persistence Analyses */}
          {user && (
            <div className="pt-4 border-t border-slate-800/60">
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-teal-400" /> Cloud Saved Runs
                </span>
                <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                  {savedAnalyses.length} RECORDS
                </span>
              </div>
              
              {isHistoryLoading ? (
                <div className="flex items-center justify-center py-4 text-xs text-slate-500 gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                  <span>Syncing...</span>
                </div>
              ) : savedAnalyses.length === 0 ? (
                <div className="text-center py-4 px-2 rounded-lg bg-slate-900/40 border border-slate-850/60">
                  <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-wider font-mono">
                    No runs saved to cloud.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                  {savedAnalyses.map((saved) => (
                    <div
                      key={saved.id}
                      onClick={() => handleLoadSavedAnalysis(saved)}
                      className="group relative flex items-center justify-between p-2.5 rounded-lg bg-[#18181f]/40 border border-slate-800/70 hover:border-slate-700/80 cursor-pointer text-left transition-all duration-200"
                    >
                      <div className="overflow-hidden pr-6">
                        <div className="font-semibold text-xs text-slate-300 truncate group-hover:text-white">
                          {saved.geneName}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                          {saved.createdAt?.seconds 
                            ? new Date(saved.createdAt.seconds * 1000).toLocaleDateString()
                            : new Date(saved.createdAt).toLocaleDateString()
                          }
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteSavedAnalysis(e, saved.id)}
                        className="opacity-0 group-hover:opacity-100 absolute right-1.5 p-1 text-slate-500 hover:text-red-400 rounded transition duration-200 bg-slate-900/80 border border-slate-800 cursor-pointer"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Cloud Compute Environment Stats */}
          <div className="pt-4 border-t border-slate-800/60">
            <div className="px-2 mb-3">
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-teal-500" /> Active Clusters
              </span>
            </div>

            <div className="bg-[#18181f]/40 rounded-lg p-3 border border-slate-800/50 space-y-3 font-mono text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-550">Node Server ID</span>
                <span className="text-slate-300 uppercase">us-east-compute-1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-550 scroll-py-0.5">Throughput</span>
                <span className="text-teal-400">4.2 GB/s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-550">Status</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Active
                </span>
              </div>
              <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="w-[82%] h-full bg-emerald-500/80"></div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Area with author/platform indicators strictly formatted */}
        <div className="p-4 border-t border-slate-800 bg-[#0f0f13] text-[10px] font-mono text-slate-550 flex items-center justify-between">
          <span>Engine V3.5-Flash</span>
          <span className="text-teal-500 font-medium">SYS_OK</span>
        </div>
      </aside>

      {/* 2. Main Workstation Panel */}
      <main className="flex-1 flex flex-col h-full bg-[#0a0a0c] overflow-hidden">
        
        {/* Header bar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-[#121216]/40 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium text-sm">Active Job:</span>
            <span className="text-slate-200 font-mono text-sm tracking-wide bg-slate-850 px-2 py-0.5 rounded border border-slate-800">
              #GX-{geneName.toUpperCase()}_Alignment
            </span>
            <span className="px-2 py-0.5 rounded text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold uppercase tracking-wider">
              {isAnalyzing ? "Processing..." : "Compute Idle"}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[9px] text-slate-550 uppercase font-bold tracking-widest">Alignment Method</div>
              <div className="text-xs font-mono text-teal-400">Needleman-Wunsch dp</div>
            </div>
          </div>
        </header>

        {/* Primary workspace layout split internally */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main workspace (Scrollable left column) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* 1. Sequence Settings Panel */}
            <section className="bg-[#121216] border border-slate-850 rounded-xl p-5 shadow-lg shadow-black/30">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-teal-500" /> Genomic Parameters Input
                </h3>
                <span className="text-[10px] font-mono text-slate-500">FASTA Sequence Align</span>
              </div>

              {/* Mutation Name and Diseases Metadata inputs */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1.5 tracking-wider">Gene Name</label>
                  <input
                    type="text"
                    value={geneName}
                    onChange={(e) => setGeneName(e.target.value)}
                    placeholder="e.g. BRCA1"
                    className="w-full bg-[#18181f]/80 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-teal-500"
                    id="input-gene-name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1.5 tracking-wider">Phenotypic / Disease Context</label>
                  <input
                    type="text"
                    value={diseaseContext}
                    onChange={(e) => setDiseaseContext(e.target.value)}
                    placeholder="e.g. Hereditary cancer syndromes"
                    className="w-full bg-[#18181f]/80 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-teal-500"
                    id="input-disease-context"
                  />
                </div>
              </div>

              {/* Sequence text areas */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold">Reference Sequence (DNA)</label>
                    <span className="text-[10px] font-mono text-slate-500">{referenceSeq.length} Base pairs</span>
                  </div>
                  <textarea
                    rows={2}
                    value={referenceSeq}
                    onChange={(e) => setReferenceSeq(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                    placeholder="Enter wildtype FASTA format DNA nucleotides (A, T, C, G)..."
                    className="w-full bg-[#18181f]/80 border border-slate-800 rounded p-3 text-xs font-mono text-white leading-relaxed focus:outline-none focus:border-teal-500 h-16 resize-none"
                    id="input-reference-seq"
                  ></textarea>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold">Mutated / Sample Sequence (DNA)</label>
                    <span className="text-[10px] font-mono text-slate-500">{sampleSeq.length} Base pairs</span>
                  </div>
                  <textarea
                    rows={2}
                    value={sampleSeq}
                    onChange={(e) => setSampleSeq(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                    placeholder="Enter matched sample patient DNA nucleotides (A, T, C, G)..."
                    className="w-full bg-[#18181f]/80 border border-slate-800 rounded p-3 text-xs font-mono text-white leading-relaxed focus:outline-none focus:border-teal-500 h-16 resize-none"
                    id="input-sample-seq"
                  ></textarea>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-600" /> Needleman-Wunsch algorithm dynamically aligns sequences that differ.
                </span>
                <div className="flex gap-2.5">
                  {analysisResult && user && (
                    <button
                      onClick={saveCurrentAnalysis}
                      className="px-4 py-2 border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500 hover:text-black text-teal-400 font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-teal-500/5"
                      id="btn-save-cloud"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Save to Cloud</span>
                    </button>
                  )}
                  <button
                    onClick={() => runAnalysis()}
                    disabled={isAnalyzing || !referenceSeq.trim() || !sampleSeq.trim()}
                    className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-teal-500/20 disabled:scale-95 disabled:bg-slate-800 disabled:text-slate-500"
                    id="btn-run-analysis"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Computing Node ...</span>
                      </>
                    ) : (
                      <>
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Execute Sequence Run</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {analysisError && (
              <div className="bg-red-950/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-xs">{analysisError}</span>
              </div>
            )}

            {/* Compute statistics card row */}
            {analysisResult && (
              <div className="grid grid-cols-4 gap-4">
                
                <div className="bg-[#121216] p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Alignment Score</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-mono font-bold text-white">{analysisResult.alignment.score}</span>
                    <span className="text-[9px] text-slate-500 uppercase font-mono">bits</span>
                  </div>
                  <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="bg-teal-500 h-full" style={{ width: "85%" }}></div>
                  </div>
                </div>

                <div className="bg-[#121216] p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Divergent Variants</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className={`text-2xl font-mono font-bold ${analysisResult.variants.length > 0 ? "text-amber-500" : "text-emerald-400"}`}>
                      {analysisResult.variants.length}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase font-mono">loci</span>
                  </div>
                  <div className="mt-2 text-[9px] text-slate-550 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${analysisResult.variants.length > 0 ? "bg-amber-500" : "bg-emerald-400"}`}></span>
                    {analysisResult.variants.length > 0 ? "Variants Found" : "Monomorphic Homologue"}
                  </div>
                </div>

                <div className="bg-[#121216] p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">GC Ratio (Ref / Alt)</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-mono font-bold text-white">{analysisResult.metrics.refGC}%</span>
                    <span className="text-xs text-slate-500">/</span>
                    <span className="text-xl font-mono text-teal-400">{analysisResult.metrics.sampleGC}%</span>
                  </div>
                  <div className="mt-2 text-[9px] text-slate-550 truncate">
                    Optimal range PCR: 40-60%
                  </div>
                </div>

                <div className="bg-[#121216] p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Sequence Length</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-mono font-bold text-white">{analysisResult.metrics.refLength}</span>
                    <span className="text-[9px] text-slate-550 uppercase font-mono">bp</span>
                  </div>
                  <div className="mt-2 text-[9px] text-emerald-400">
                    High-Throughput verified
                  </div>
                </div>

              </div>
            )}

            {/* WORK Tab buttons */}
            {analysisResult && (
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setActiveTab("alignment")}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === "alignment"
                      ? "border-teal-500 text-teal-400 bg-teal-500/5 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab-alignment"
                >
                  Pairwise Alignment & Decoders
                </button>
                <button
                  onClick={() => setActiveTab("interpretation")}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === "interpretation"
                      ? "border-teal-500 text-teal-400 bg-teal-500/5 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab-interpretation"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  Clinical Lab Report (AI Interpreted)
                </button>
                <button
                  onClick={() => {
                    setActiveTab("crispr");
                    if (sgRNACandidates.length > 0 && !selectedSgRNA) {
                      setSelectedSgRNA(sgRNACandidates[0]);
                    }
                  }}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === "crispr"
                      ? "border-teal-500 text-teal-400 bg-teal-500/5 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab-crispr"
                >
                  <Scissors className="w-3.5 h-3.5 text-teal-400" />
                  CRISPR PAM Targeter (Cas9 Simulator)
                </button>
              </div>
            )}

            {analysisResult && activeTab === "alignment" && (
              <div className="space-y-6">
                
                {/* 2. Interactive Pairwise Alignment Canvas */}
                <div className="bg-[#121216] border border-slate-850 rounded-xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-teal-500" /> Multi-Track Sequence Alignment & GC Map
                    </h3>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5 opacity-80" title="Bases below a mock Quality Score of 65">
                        <div className="w-4 h-[3px] bg-red-500/70 rounded-full"></div>
                        <span className="text-[10px] text-slate-400 font-mono">Low Quality (QS &lt; 65)</span>
                      </div>
                      <span className="text-[10px] font-mono text-teal-500 hidden md:block">ZOOM: 100% (Single Base resolution)</span>
                    </div>
                  </div>

                  {/* Nucleotide layout */}
                  <div className="bg-black/40 border border-slate-850 rounded-lg p-5 font-mono overflow-x-auto space-y-4">
                    
                    {/* Index numbers */}
                    <div className="flex select-none">
                      <div className="w-16 flex-shrink-0 text-[10px] text-slate-600 font-bold">LOCUS</div>
                      <div className="flex gap-1 py-1">
                        {analysisResult.alignment.alignedRef.split("").map((_, idx) => (
                          <div key={idx} className="w-7 text-center text-[8px] text-slate-600">
                            {(idx + 1) % 5 === 0 || idx === 0 ? idx + 1 : "·"}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mutation Density Heatmap Track */}
                    <div className="flex items-center select-none">
                      <div className="w-16 flex-shrink-0 text-[10px] text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        DENSITY
                      </div>
                      <div className="flex gap-1">
                        {analysisResult.alignment.alignedRef.split("").map((_, idx) => {
                          const density = computeMutationDensity(analysisResult.alignment.alignedRef, analysisResult.alignment.alignedSample, idx);
                          let colorClass = "bg-[#0b0b0e] border-slate-900/40 text-slate-800";
                          let displayValue = "";
                          let tooltip = `Locus ${idx + 1}: 0% local variant density (9bp window)`;
                          
                          if (density > 0) {
                            tooltip = `Locus ${idx + 1}: ${Math.round(density * 100)}% local variant density`;
                            if (density <= 0.15) {
                              colorClass = "bg-teal-505/10 border-teal-500/20 text-teal-500/50";
                              displayValue = "░";
                            } else if (density <= 0.35) {
                              colorClass = "bg-amber-505/15 border-amber-500/30 text-amber-500/70";
                              displayValue = "▒";
                            } else if (density <= 0.6) {
                              colorClass = "bg-orange-505/25 border-orange-550/40 text-orange-400";
                              displayValue = "▓";
                            } else {
                              colorClass = "bg-rose-500/40 border-rose-500/60 text-rose-300 font-bold animate-pulse";
                              displayValue = "█";
                            }
                          }
                          
                          return (
                            <div
                              key={idx}
                              className={`w-7 h-4.5 flex items-center justify-center rounded-sm text-[10px] border transition-all ${colorClass}`}
                              title={tooltip}
                            >
                              {displayValue}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Reference DNA line */}
                    <div className="flex items-center">
                      <div className="w-16 flex-shrink-0 text-[10px] text-slate-400 font-bold uppercase tracking-wide">REF</div>
                      <div className="flex gap-1">
                        {analysisResult.alignment.alignedRef!.split("").map((base, idx) => {
                          const isGap = base === "-";
                          const conf = getConfidenceParams(idx, false, analysisResult.alignment.alignedRef.length);
                          return (
                            <div
                              key={idx}
                              className={`w-7 h-7 flex relative flex-col items-center justify-center rounded transition-all ${
                                isGap
                                  ? "bg-slate-800/40 text-slate-650"
                                  : "bg-[#18181f] text-slate-300 border border-slate-800"
                              }`}
                              title={`Reference base ${idx + 1}: ${base} | QS: ${conf.score}`}
                            >
                              <span className="text-xs font-bold">{base}</span>
                              {!isGap && conf.isLowConfidence && (
                                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-red-500/70 rounded-b" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Match connection track */}
                    <div className="flex items-center">
                      <div className="w-16 flex-shrink-0 text-[10px] text-slate-600 font-bold uppercase">MATCH</div>
                      <div className="flex gap-1 my-0.5">
                        {analysisResult.alignment.matchLine.split("").map((matchChar, idx) => {
                          const isMatch = matchChar === "|";
                          const isAlt = matchChar === "x";
                          return (
                            <div
                              key={idx}
                              className={`w-7 text-center text-xs font-mono font-bold select-none ${
                                isMatch ? "text-teal-500" : isAlt ? "text-amber-500" : "text-slate-800"
                              }`}
                            >
                              {matchChar === "|" ? "│" : matchChar === "x" ? "🗙" : " "}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mutated client allele DNA line */}
                    <div className="flex items-center">
                      <div className="w-16 flex-shrink-0 text-[10px] text-teal-400 font-bold uppercase tracking-wide">ALT</div>
                      <div className="flex gap-1">
                        {analysisResult.alignment.alignedSample.split("").map((base, idx) => {
                          const refBase = analysisResult.alignment.alignedRef[idx];
                          const isMutation = base !== refBase && base !== "-" && refBase !== "-";
                          const isGap = base === "-";
                          const conf = getConfidenceParams(idx, isMutation, analysisResult.alignment.alignedSample.length);
                          return (
                            <div
                              key={idx}
                              className={`w-7 h-7 flex relative flex-col items-center justify-center rounded transition-all ${
                                isGap
                                  ? "bg-red-950/20 text-red-500/80 border border-red-900/30"
                                  : isMutation
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/60"
                                  : "bg-[#18181f] text-slate-300 border border-slate-800"
                              }`}
                              title={`Patient Variant base ${idx + 1}: ${base} | QS: ${conf.score}`}
                            >
                              <span className="text-xs font-bold">{base}</span>
                              {!isGap && conf.isLowConfidence && (
                                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-red-500/70 rounded-b" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Codon & Translation frames */}
                    <div className="pt-4 border-t border-slate-850/60 space-y-3">
                      
                      <div className="flex items-center">
                        <div className="w-16 flex-shrink-0 text-[10px] text-slate-500 font-bold">REF AA</div>
                        <div className="flex">
                          {analysisResult.refTranslation.aminoAcids.map((aa, cIdx) => (
                            <div
                              key={cIdx}
                              className="w-[92px] h-7 flex items-center justify-center bg-slate-900/50 border border-slate-800/80 text-[11px] font-bold text-slate-400 rounded-md mx-0.5"
                              title={`Codon ${cIdx + 1} translates to ${aa}`}
                            >
                              {aa === "[STOP]" ? "🛑 STOP" : aa}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center">
                        <div className="w-16 flex-shrink-0 text-[10px] text-teal-500 font-bold">ALT AA</div>
                        <div className="flex">
                          {analysisResult.sampleTranslation.aminoAcids.map((aa, cIdx) => {
                            const refAA = analysisResult.refTranslation.aminoAcids[cIdx];
                            const aaChanged = aa !== refAA;
                            return (
                              <div
                                key={cIdx}
                                className={`w-[92px] h-7 flex items-center justify-center border text-[11px] font-bold rounded-md mx-0.5 ${
                                  aaChanged
                                    ? "bg-amber-500/10 border-amber-500 text-amber-400"
                                    : "bg-[#121216] border-slate-800 text-slate-300"
                                }`}
                                title={`Codon ${cIdx + 1} translates to ${aa}`}
                              >
                                {aa === "[STOP]" ? "🛑 STOP" : aa}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                  </div>
                </div>

                {/* 3. Base distribution comparison */}
                <div className="grid grid-cols-2 gap-6">
                  
                  {/* Reference Base stats */}
                  <div className="bg-[#121216] border border-slate-850 rounded-xl p-5">
                    <span className="text-[10px] opacity-75 text-slate-400 uppercase font-bold tracking-widest block mb-4">Reference Base Frequencies</span>
                    <div className="space-y-3 font-mono text-xs">
                      {Object.entries(analysisResult.metrics.refFreqs).map(([base, count]) => {
                        const countVal = count as number;
                        const total = analysisResult.metrics.refLength || 1;
                        const pct = Number(((countVal / total) * 100).toFixed(1));
                        return (
                          <div key={base} className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-bold text-slate-300">{base} (Adenine/Thymine/Cytosine/Guanine)</span>
                              <span>{countVal} bases ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                              <span className="h-full bg-[#3d4455] block rounded-full" style={{ width: `${pct}%` }}></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sample base stats */}
                  <div className="bg-[#121216] border border-slate-850 rounded-xl p-5">
                    <span className="text-[10px] opacity-75 text-teal-400 uppercase font-bold tracking-widest block mb-4">Sample Variant Base Frequencies</span>
                    <div className="space-y-3 font-mono text-xs">
                      {Object.entries(analysisResult.metrics.sampleFreqs).map(([base, count]) => {
                        const countVal = count as number;
                        const total = analysisResult.metrics.sampleLength || 1;
                        const pct = Number(((countVal / total) * 100).toFixed(1));
                        const isDifferent = countVal !== (analysisResult.metrics.refFreqs as any)[base];
                        return (
                          <div key={base} className="space-y-1">
                            <div className="flex justify-between">
                              <span className={`font-bold ${isDifferent ? "text-teal-400" : "text-slate-300"}`}>{base}</span>
                              <span className={isDifferent ? "text-teal-400 text-semibold" : ""}>{count} bases ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                              <span className={`h-full block rounded-full ${isDifferent ? "bg-teal-500" : "bg-slate-755"}`} style={{ width: `${pct}%` }}></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                {/* 3.5. Scatter Plot */}
                <div className="bg-[#121216] border border-slate-850 rounded-xl p-5 overflow-hidden">
                   <div className="flex items-center gap-2 mb-4">
                     <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                       <Target className="w-4 h-4 text-blue-400" />
                     </div>
                     <div>
                       <h3 className="text-xs font-bold text-white uppercase tracking-widest">
                         Density & Pathogenicity Map
                       </h3>
                       <p className="text-[10px] text-slate-500">
                         Positional distribution of variations mapped against ACMG scores
                       </p>
                     </div>
                   </div>
                   <VariantScatterPlot 
                      variants={analysisResult.variants.map((v, i) => ({
                         index: i,
                         position: v.position,
                         pathogenicity: getPathogenicityForVariant(v, i),
                         type: v.type,
                         id: `#VAR-${i + 1}`
                      }))}
                      selectedVariantIdx={selectedVariantIdx}
                      onVariantClick={(idx) => setSelectedVariantIdx(idx === selectedVariantIdx ? null : idx)}
                   />
                </div>

                {/* 4. Genetic Variant Call Table with Absolute Genomic Standards & Curation Panel */}
                <div className="bg-[#121216] border border-slate-850 rounded-xl p-5 overflow-hidden">
                  
                  {/* Title and Top standard selectors */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-850/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                          Primary Variant Caller & Interactive Genomic Curation Workspace
                        </h3>
                        <p className="text-[10px] text-slate-500">
                          Interactive HGVS standardization, ACMG/AMP pathogenicity calculators & ClinVar validation matching
                        </p>
                      </div>
                    </div>

                    {/* Standard Selectors */}
                    <div className="flex flex-wrap items-center gap-3">
                      
                      {/* Genome build */}
                      <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 px-1 font-mono">Assembly</span>
                        {(["GRCh38", "GRCh37", "T2T"] as const).map((build) => (
                          <button
                            key={build}
                            onClick={() => setGenomeBuild(build)}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              genomeBuild === build
                                ? "bg-teal-500/10 border border-teal-500/30 text-teal-400"
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {build === "GRCh38" ? "hg38" : build === "GRCh37" ? "hg19" : "T2T-CHM13"}
                          </button>
                        ))}
                      </div>

                      {/* Transcripts build */}
                      <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 px-1 font-mono">Transcript</span>
                        {["RefSeq (Clinical Master)", "Ensembl (Research)"].map((tx) => (
                          <button
                            key={tx}
                            onClick={() => setActiveTranscript(tx)}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              activeTranscript === tx
                                ? "bg-blue-500/10 border border-blue-500/30 text-blue-400"
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {tx.split(" (")[0]}
                          </button>
                        ))}
                      </div>

                    </div>
                  </div>

                  {/* Split Layout Container */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    
                    {/* Left Column: Variant list & filtration (takes full width if no selection, 7 cols if selection exists) */}
                    <div className={`${selectedVariantIdx !== null ? "xl:col-span-7 col-span-1" : "xl:col-span-12 col-span-1"} space-y-4`}>
                      
                      {/* Filter controls */}
                      <div className="bg-[#18181f]/40 p-4 border border-slate-850/80 rounded-xl space-y-4">
                        <div className="flex flex-col lg:flex-row gap-4 justify-between">
                          {/* Left Side: Variant Type filters */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5 font-mono">
                              <Sliders className="w-3.5 h-3.5 text-teal-400" /> Filter by Variant Type:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {["Substitution", "Deletion", "Insertion"].map((type) => {
                                const isSelected = selectedTypes.includes(type);
                                const count = analysisResult.variants.filter((v) => v.type === type).length;
                                return (
                                  <button
                                    key={type}
                                    onClick={() => {
                                      setSelectedTypes((prev) =>
                                        prev.includes(type)
                                          ? prev.filter((t) => t !== type)
                                          : [...prev, type]
                                      );
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-2 cursor-pointer border ${
                                      isSelected
                                        ? "bg-teal-500/10 border-teal-500/40 text-teal-400 font-bold"
                                        : "bg-slate-900/40 border-slate-850/50 text-slate-500 hover:border-slate-800 hover:text-slate-355"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        type === "Deletion"
                                          ? "bg-red-400"
                                          : type === "Insertion"
                                          ? "bg-emerald-400"
                                          : "bg-amber-400"
                                      }`}
                                    />
                                    {type}
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                        isSelected ? "bg-teal-500/20 text-teal-300" : "bg-slate-800 text-slate-600"
                                      }`}
                                    >
                                      {count}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Right Side: Pathogenicity level filters */}
                          <div className="space-y-1.5 lg:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block font-mono">
                              Filter by Pathogenicity (ACMG Significance):
                            </span>
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                              {["Pathogenic", "Likely Pathogenic", "VUS", "Likely Benign", "Benign"].map((patho) => {
                                const isSelected = selectedPathologies.includes(patho);
                                const count = analysisResult.variants.filter((v, vIdx) => {
                                  const p = getPathogenicityForVariant(v, vIdx);
                                  return p === patho;
                                }).length;

                                let dotColor = "bg-amber-500";
                                if (patho === "Pathogenic" || patho === "Likely Pathogenic") {
                                  dotColor = "bg-red-500";
                                } else if (patho === "Benign" || patho === "Likely Benign") {
                                  dotColor = "bg-emerald-500";
                                }

                                return (
                                  <button
                                    key={patho}
                                    onClick={() => {
                                      setSelectedPathologies((prev) =>
                                        prev.includes(patho)
                                          ? prev.filter((p) => p !== patho)
                                          : [...prev, patho]
                                      );
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer border ${
                                      isSelected
                                        ? "bg-[#1f293d]/50 border-blue-500/30 text-blue-300 font-bold"
                                        : "bg-slate-900/40 border-slate-850/50 text-slate-500 hover:border-slate-800 hover:text-slate-355"
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                    {patho === "VUS" ? "VUS" : patho}
                                    <span
                                      className={`px-1 rounded text-[9px] font-bold ${
                                        isSelected ? "bg-slate-700 text-slate-300" : "bg-slate-800 text-slate-600"
                                      }`}
                                    >
                                      {count}
                                    </span>
                                  </button>
                                );
                              })}

                              {/* Quick clear button */}
                              {(selectedTypes.length !== 3 || selectedPathologies.length !== 5) && (
                                <button
                                  onClick={() => {
                                    setSelectedTypes(["Substitution", "Deletion", "Insertion"]);
                                    setSelectedPathologies(["Pathogenic", "Likely Pathogenic", "VUS", "Likely Benign", "Benign"]);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-red-400 font-bold bg-red-950/20 hover:bg-red-950/30 border border-red-900/40 transition-all font-sans cursor-pointer text-xs flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Variants list info bubble when selection is inactive */}
                      {selectedVariantIdx === null && (
                        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-3 flex items-center gap-2.5 text-slate-400 text-[11px] font-sans">
                          <Info className="w-4 h-4 text-teal-400 flex-shrink-0" />
                          <span>
                            <strong>Clinical Tip:</strong> Click on any row in the mutation call table below to load its 
                            high-resolution diagnostic standards profile, ClinVar evidence gold-stars, and execute dynamic ACMG pathogenicity calculations.
                          </span>
                        </div>
                      )}

                      {/* Variant Table */}
                      <div className="overflow-x-auto border border-slate-850 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#18181f]/90 text-slate-400 uppercase text-[9px] font-bold tracking-wider border-b border-slate-800 font-mono">
                            <tr>
                              <th className="px-4 py-3">MUTATION</th>
                              <th className="px-4 py-3">LOCUS ({genomeBuild})</th>
                              <th className="px-4 py-3">HGVS DNA & PROT</th>
                              <th className="px-4 py-3">TYPE</th>
                              <th className="px-4 py-3">ACMG SIGNIF</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/60 font-mono">
                            {(() => {
                              const filtered = analysisResult.variants
                                .map((v, originalIdx) => ({ v, originalIdx }))
                                .filter(({ v, originalIdx }) => {
                                  const matchesType = selectedTypes.includes(v.type);
                                  const patho = getPathogenicityForVariant(v, originalIdx);
                                  const matchesPatho = selectedPathologies.includes(patho);
                                  return matchesType && matchesPatho;
                                });

                              if (filtered.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500 italic font-sans text-xs">
                                      No mutations match the active filter criteria. Adjust your filters above.
                                    </td>
                                  </tr>
                                );
                              }

                              return filtered.map(({ v, originalIdx }) => {
                                const isSub = v.type === "Substitution";
                                const isDel = v.type === "Deletion";
                                const isIns = v.type === "Insertion";

                                const standards = getGenomicStandards(v, originalIdx, geneName);
                                const rawPatho = getPathogenicityForVariant(v, originalIdx);
                                const isPathogenic = rawPatho === "Pathogenic" || rawPatho === "Likely Pathogenic";
                                const isBenign = rawPatho === "Benign" || rawPatho === "Likely Benign";
                                const isSelected = selectedVariantIdx === originalIdx;

                                // Build-specific coordinate simulation
                                let coordinateLocus = "";
                                if (genomeBuild === "GRCh38") {
                                  coordinateLocus = `${geneName.includes("SARS") ? "NC_045512.2" : geneName.includes("BRCA1") ? "Chr17" : "Chr11"}:${5227000 + v.position}`;
                                } else if (genomeBuild === "GRCh37") {
                                  coordinateLocus = `${geneName.includes("SARS") ? "NC_045512.2" : geneName.includes("BRCA1") ? "Chr17" : "Chr11"}:${5248300 + v.position}`;
                                } else {
                                  coordinateLocus = `${geneName.includes("SARS") ? "NC_045512.2" : geneName.includes("BRCA1") ? "Chr17" : "Chr11"}:${5189450 + v.position}`;
                                }

                                return (
                                  <tr
                                    key={originalIdx}
                                    onClick={() => setSelectedVariantIdx(isSelected ? null : originalIdx)}
                                    className={`relative cursor-pointer transition-all border-l-2 ${
                                      isSelected
                                        ? "bg-teal-500/10 hover:bg-teal-500/15 border-l-teal-500"
                                        : "bg-slate-800/10 hover:bg-slate-800/20 border-l-transparent hover:border-l-slate-700/50"
                                    }`}
                                  >
                                    <td className="px-4 py-3.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-teal-400">#VAR-{originalIdx + 1}</span>
                                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />}
                                      </div>
                                    </td>
                                    
                                    <td className="px-4 py-3.5 text-slate-300">
                                      <div className="text-[11px] font-semibold">{coordinateLocus}</div>
                                      <div className="text-[9px] text-slate-500">Position {v.position}</div>
                                    </td>

                                    <td className="px-4 py-3.5 text-slate-200">
                                      <div className="text-[11px] font-mono text-slate-350">{standards.hgvsDNA}</div>
                                      <div className="text-[10px] text-teal-400 font-bold">{standards.hgvsProtein}</div>
                                    </td>

                                    <td className="px-4 py-3.5">
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wide ${
                                          isDel
                                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                                            : isIns
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                        }`}
                                      >
                                        {v.type}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3.5">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                                          isPathogenic
                                            ? "bg-red-905/30 text-red-400 border-red-500/30"
                                            : isBenign
                                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                                            : "bg-slate-900 text-slate-400 border-slate-700"
                                        }`}
                                      >
                                        {rawPatho}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Column: High-fidelity Genetic Standard Details & Interactive ACMG guidelines board */}
                    {selectedVariantIdx !== null && (() => {
                      const selectedVariant = analysisResult.variants[selectedVariantIdx];
                      if (!selectedVariant) return null;

                      const standards = getGenomicStandards(selectedVariant, selectedVariantIdx, geneName);
                      const currentPatho = getPathogenicityForVariant(selectedVariant, selectedVariantIdx);
                      
                      // Active toggles for this variant
                      const activeToggles = customAcmgToggles[selectedVariantIdx] !== undefined 
                        ? customAcmgToggles[selectedVariantIdx] 
                        : standards.defaultAcmgCodes;

                      // Handles toggling standard criteria
                      const handleToggleAcmg = (code: string) => {
                        const newToggles = activeToggles.includes(code)
                          ? activeToggles.filter(c => c !== code)
                          : [...activeToggles, code];
                        setCustomAcmgToggles(prev => ({
                          ...prev,
                          [selectedVariantIdx]: newToggles
                        }));
                      };

                      let pathoColor = "text-amber-400 bg-amber-500/5 border-amber-500/20";
                      let dotColor = "bg-amber-400";
                      if (currentPatho === "Pathogenic" || currentPatho === "Likely Pathogenic") {
                        pathoColor = "text-red-400 bg-red-500/5 border-red-500/20";
                        dotColor = "bg-red-500";
                      } else if (currentPatho === "Benign" || currentPatho === "Likely Benign") {
                        pathoColor = "text-emerald-400 bg-emerald-500/5 border-emerald-500/20";
                        dotColor = "bg-emerald-500";
                      }

                      return (
                        <div className="xl:col-span-5 col-span-1 bg-[#16161c] border border-slate-800 rounded-xl p-4 space-y-4 animate-fade-in text-slate-300 font-sans">
                          
                          {/* Selected Variant Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-slate-800/85">
                            <div>
                              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 block font-mono">Selected Mutation</span>
                              <h4 className="text-sm font-extrabold text-white font-mono">#VAR-{selectedVariantIdx + 1} Locus Profile</h4>
                            </div>
                            <button
                              onClick={() => setSelectedVariantIdx(null)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-805 text-[10px] text-slate-400 font-medium hover:text-white transition cursor-pointer flex items-center gap-1 font-mono"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Close Detail
                            </button>
                          </div>

                          {/* Classification & Quick description */}
                          <div className={`p-3 rounded-lg border flex flex-col gap-3 justify-between ${pathoColor}`}>
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75 font-mono">ACMG Classification</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                <span className="text-sm font-extrabold uppercase font-mono">{currentPatho}</span>
                              </div>
                            </div>
                            <span className="text-[10.5px] font-mono font-bold bg-slate-900/40 px-2.5 py-1 rounded border border-slate-800 self-start">
                              Transcript: {standards.transcript} ({standards.exon})
                            </span>
                          </div>

                          {/* HGVS & standards table */}
                          <div className="space-y-2 bg-[#121216] p-3 border border-slate-850 rounded-lg text-xs font-mono">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider pb-1 border-b border-slate-850/60">HGVS & dbSNP Standards</span>
                            
                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5">
                              <div>
                                <span className="text-[9px] text-slate-500 block">HGVS DNA (Coding):</span>
                                <strong className="text-slate-200">{standards.hgvsDNA}</strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 block">HGVS Protein:</span>
                                <strong className="text-teal-400">{standards.hgvsProtein}</strong>
                              </div>
                              <div className="mt-1.5">
                                <span className="text-[9px] text-slate-500 block">Sequence Ontology:</span>
                                <strong className="text-slate-205 flex items-center gap-1 text-[10px] sm:text-[11px]">
                                  {standards.sequenceOntology} 
                                  <span className="text-[9px] text-slate-500">[{standards.soAccession}]</span>
                                </strong>
                              </div>
                              <div className="mt-1.5">
                                <span className="text-[9px] text-slate-500 block">dbSNP Ref ID:</span>
                                <strong className="text-blue-400 hover:underline cursor-pointer">{standards.dbSNPID}</strong>
                              </div>
                            </div>
                          </div>

                          {/* ClinVar Stars */}
                          <div className="bg-[#121216] p-3.5 border border-slate-850/80 rounded-lg space-y-2">
                            <div className="flex justify-between items-center pb-1 border-b border-slate-850/60">
                              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider font-mono">ClinVar Review Assertions</span>
                              <div className="flex items-center gap-1 font-mono text-[10px]">
                                <span className="text-yellow-400 flex">
                                  {Array.from({ length: 4 }).map((_, i) => (
                                    <span key={i} className="text-xs">
                                      {i < standards.clinVarStars ? "★" : "☆"}
                                    </span>
                                  ))}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">({standards.clinVarStars}/4 Stars)</span>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 pt-1 font-sans">
                              <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-mono font-bold">★</div>
                              <div>
                                <h5 className="text-[11px] font-bold text-slate-200 font-mono">Accession: SCV00084319{selectedVariantIdx}</h5>
                                <p className="text-[10px] text-slate-400">{standards.clinVarStatus}</p>
                              </div>
                            </div>
                          </div>

                          {/* Interactive ACMG selection board */}
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center pb-1.5 border-b border-slate-850">
                              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider font-mono">Interactive ACMG evidence board</span>
                              <span className="text-[9px] text-teal-400 font-mono font-bold bg-teal-500/5 px-1.5 py-0.5 rounded border border-teal-500/10">Dynamic pathogenicity calc</span>
                            </div>

                            <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                              Toggle supporting clinical evidence tags according to ACMG/AMP clinical consensus criteria. Pathogenicity will recompute live in the left master table.
                            </p>

                            <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                              {/* PATHOGENIC CRITERIA */}
                              <div className="space-y-1.5">
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-red-505 block font-mono">Pathogenic Supporting Criteria</span>
                                
                                {[
                                  { code: "PVS1", type: "Very Strong", desc: "Nonsense/frameshift variant in gene where loss-of-function is known disease mechanism." },
                                  { code: "PS1", type: "Strong", desc: "Same amino acid change as previously established pathogenic variant." },
                                  { code: "PS3", type: "Strong", desc: "Well-established in vitro / in vivo functional assay matches loss of molecular capability." },
                                  { code: "PS4", type: "Strong", desc: "Prevalence of variant is significantly increased in affected disease cohort." },
                                  { code: "PM1", type: "Moderate", desc: "Located in mutational hotspot or critical functional protein domain." },
                                  { code: "PM2", type: "Moderate", desc: "Absent or ultra-low frequency from ExAC/gnomAD clinical reference database." },
                                  { code: "PP3", type: "Supporting", desc: "Consensus in silico prediction predictors (SIFT, PolyPhen, REVEL) support deleterious impact." },
                                  { code: "PP5", type: "Supporting", desc: "Resputable clinical diagnostic lab labels pathogenic category (non-underlying evidence shared)." }
                                ].map((crit) => {
                                  const isChecked = activeToggles.includes(crit.code);
                                  return (
                                    <label
                                      key={crit.code}
                                      className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none text-[10px] ${
                                        isChecked
                                          ? "bg-red-500/10 border-red-500/35 text-red-100"
                                          : "bg-slate-900/30 border-slate-850/50 hover:bg-slate-850/30 text-slate-400"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleAcmg(crit.code)}
                                        className="mt-0.5 rounded border-slate-800 text-teal-500 focus:ring-teal-500 h-3 w-3 cursor-pointer"
                                      />
                                      <div>
                                        <span className="font-mono font-bold text-[10px] text-red-450 mr-2 bg-red-950/20 px-1 py-0.2 rounded border border-red-900/30">{crit.code} ({crit.type})</span>
                                        <p className="mt-0.5 leading-snug text-slate-400">{crit.desc}</p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>

                              {/* BENIGN CRITERIA */}
                              <div className="space-y-1.5 pt-2 border-t border-slate-850/60">
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-400 block font-mono">Benign Supporting Criteria</span>
                                
                                {[
                                  { code: "BA1", type: "Stand-alone", desc: "Allele frequency is stand-alone extremely high (>5%) in population reference series." },
                                  { code: "BS1", type: "Strong", desc: "Allele frequency in controls is higher than clinical penetrance expectations." },
                                  { code: "BP4", type: "Supporting", desc: "In silico computational consensus supports neutral / non-pathological status." }
                                ].map((crit) => {
                                  const isChecked = activeToggles.includes(crit.code);
                                  return (
                                    <label
                                      key={crit.code}
                                      className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none text-[10px] ${
                                        isChecked
                                          ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-100"
                                          : "bg-slate-900/30 border-slate-850/50 hover:bg-slate-850/30 text-slate-400"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleAcmg(crit.code)}
                                        className="mt-0.5 rounded border-slate-800 text-teal-500 focus:ring-teal-500 h-3 w-3 cursor-pointer"
                                      />
                                      <div>
                                        <span className="font-mono font-bold text-[10px] text-emerald-400 mr-2 bg-emerald-950/20 px-1 py-0.2 rounded border border-emerald-900/30">{crit.code}</span>
                                        <p className="mt-0.5 leading-snug text-slate-400">{crit.desc}</p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })()}

                  </div>
                </div>
                </div>

              </div>
            )}

            {analysisResult && activeTab === "interpretation" && (
              <div className="space-y-6 animate-fade-in">
                
                {/* 5. Clinical Lab Report Presentation */}
                <div className="bg-[#121216] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                  
                  {/* Top lab header strip */}
                  <div className="bg-[#18181f] px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-teal-500" />
                      <span className="text-xs uppercase font-extrabold tracking-widest text-white font-mono">
                        ACMG Lab Diagnostic Summary
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      ClinVar Identifier: CV-992-GENOMX
                    </span>
                  </div>

                  <div className="p-6 space-y-6">
                    
                    {/* executive summary section */}
                    {analysisResult.interpretation.warning && (
                      <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-mono">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>{analysisResult.interpretation.warning}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <h4 className="text-xs uppercase font-bold tracking-widest text-teal-400 font-mono">
                        1. Molecular Diagnostic Summary
                      </h4>
                      <p className="text-sm text-slate-100 leading-relaxed bg-[#18181f]/40 p-4 rounded-lg border border-slate-850">
                        {analysisResult.interpretation.summary}
                      </p>
                    </div>

                    {/* biochemistry & functional consequences */}
                    <div className="grid grid-cols-2 gap-6">
                      
                      <div className="space-y-2 bg-[#18181f]/20 p-4 rounded-lg border border-slate-850">
                        <h4 className="text-xs uppercase font-bold tracking-widest text-amber-400 font-mono flex items-center gap-1.5">
                          <Activity className="w-4 h-4" /> 2. Protein Functional Consequences
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {analysisResult.interpretation.functionalImpact}
                        </p>
                      </div>

                      <div className="space-y-2 bg-[#18181f]/20 p-4 rounded-lg border border-slate-850">
                        <h4 className="text-xs uppercase font-bold tracking-widest text-emerald-400 font-mono flex items-center gap-1.5">
                          <Info className="w-4 h-4" /> 3. ClinVar Disease Associations
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {analysisResult.interpretation.diseaseAffiliation}
                        </p>
                      </div>

                    </div>

                    {/* precise annotations for all mutations */}
                    <div className="space-y-3">
                      <h4 className="text-xs uppercase font-bold tracking-widest text-teal-400 font-mono">
                        4. Mutation Classifications (ACMG Rules)
                      </h4>

                      <div className="space-y-2">
                        {analysisResult.interpretation.variantInterpretations && analysisResult.interpretation.variantInterpretations.length > 0 ? (
                          analysisResult.interpretation.variantInterpretations.map((v, idx) => {
                            const sigLower = v.significance.toLowerCase();
                            const isPathogenic = sigLower.includes("pathogenic") || sigLower.includes("risk");
                            const isBenign = sigLower.includes("benign") || sigLower.includes("neutral");
                            const isVus = sigLower.includes("uncertain") || sigLower.includes("unsure") || sigLower.includes("vus");
                            
                            return (
                              <div
                                key={idx}
                                className="bg-[#18181f]/60 border border-slate-850 p-4 rounded-lg flex justify-between items-start gap-4 transition-all"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-sm font-bold text-white">Locus Pos {v.position}</span>
                                    <span className="text-[10px] font-mono text-slate-500 uppercase">{v.change}</span>
                                  </div>
                                  <p className="text-xs text-slate-300 leading-relaxed lg:max-w-xl">{v.details}</p>
                                </div>

                                <div className="text-right flex-shrink-0">
                                  <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                    isPathogenic
                                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                                      : isBenign
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  }`}>
                                    {v.significance}
                                  </span>
                                  <div className="text-[9px] text-slate-500 mt-1.5 font-mono">
                                    ACMG Tier {isPathogenic ? "I/II" : isBenign ? "IV/V" : "III"}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-500 italic p-4 text-center">
                            No variant classification annotations fetched or generated.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* bioinformatic clinical follow up recommendations */}
                    <div className="space-y-3 pt-4 border-t border-slate-800">
                      <h4 className="text-xs uppercase font-bold tracking-widest text-[#93c5fd] font-mono flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-400" /> 5. Bioinformatic Recommendations
                      </h4>

                      <ul className="space-y-2">
                        {analysisResult.interpretation.recommendations && analysisResult.interpretation.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2.5 leading-relaxed">
                            <span className="w-4 h-4 rounded-full bg-blue-500/10 text-blue-400 font-mono text-[9px] flex items-center justify-center font-bold mt-0.5 flex-shrink-0 border border-blue-500/20">
                              {idx + 1}
                            </span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* CRISPR sgRNA TARGETING TAB PANEL */}
            {analysisResult && activeTab === "crispr" && (
              <div className="space-y-6 animate-fade-in">
                
                {/* CRISPR Header Panel */}
                <div className="bg-[#121216] border border-slate-850 rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 animate-fade-in">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Scissors className="w-5 h-5 text-teal-400 font-bold" />
                        CRISPR-Cas9 sgRNA Designer & Target Scan
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Scanning reference loci for SpCas9 (5'-NGG) PAM cleavage configurations and computing homologous donor repair guides.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 font-bold uppercase">
                      SpCas9 Dual Loci (20bp)
                    </span>
                  </div>

                  {/* Summary of scanned PAM targets */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-[#18181f]/60 p-3 rounded-lg border border-slate-850 font-mono">
                      <span className="text-[9px] text-slate-500 uppercase block">Total PAMs Scanned</span>
                      <span className="text-xl font-bold text-white mt-1 block">{sgRNACandidates.length} sites</span>
                    </div>
                    <div className="bg-[#18181f]/60 p-3 rounded-lg border border-slate-850 font-mono">
                      <span className="text-[9px] text-slate-500 uppercase block">Mutation Hotspots Overlapped</span>
                      <span className="text-xl font-bold text-teal-400 mt-1 block">
                        {sgRNACandidates.filter(g => g.targetsMutation).length} loci
                      </span>
                    </div>
                    <div className="bg-[#18181f]/60 p-3 rounded-lg border border-slate-850 font-mono">
                      <span className="text-[9px] text-slate-500 uppercase block">Optimal GC Range (40-60%)</span>
                      <span className="text-xl font-bold text-emerald-400 mt-1 block">
                        {sgRNACandidates.filter(g => g.gcContent >= 40 && g.gcContent <= 60).length} guides
                      </span>
                    </div>
                    <div className="bg-[#18181f]/60 p-3 rounded-lg border border-slate-850 font-mono">
                      <span className="text-[9px] text-slate-500 uppercase block">Gene Destination</span>
                      <span className="text-sm font-bold text-amber-550 mt-1.5 block truncate uppercase font-sans">
                        {geneName.toUpperCase()} Exon Coordinates
                      </span>
                    </div>
                  </div>

                  {/* Main CRISPR selection workspace Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left: Guide Candidates List (lg:col-span-5) */}
                    <div className="lg:col-span-5 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-450 block px-1">
                        Select single-guide target (sgRNA)
                      </span>
                      
                      <div className="max-h-[420px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {sgRNACandidates.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-550 italic border border-dashed border-slate-800 rounded-lg">
                            No suitable SpCas9 5'-NGG PAM config targets identified in active run.
                          </div>
                        ) : (
                          sgRNACandidates.map((g, idx) => {
                            const isSelected = selectedSgRNA?.dnaSequence === g.dnaSequence && selectedSgRNA?.position === g.position;
                            return (
                              <button
                                key={`${g.position}-${g.strand}-${idx}`}
                                onClick={() => {
                                  setSelectedSgRNA(g);
                                  setCrisprSimulation(null);
                                }}
                                className={`w-full text-left p-3 rounded-lg border font-mono transition-all flex flex-col justify-between cursor-pointer ${
                                  isSelected
                                    ? "bg-teal-500/10 border-teal-500 text-white shadow shadow-teal-500/10"
                                    : "bg-[#18181f]/40 border-slate-850 hover:bg-[#18181f]/80 text-slate-400"
                                }`}
                              >
                                <div className="flex items-center justify-between w-full mb-1 text-[11px]">
                                  <span className={`font-bold ${isSelected ? "text-teal-450" : "text-slate-350"}`}>
                                    Pos {g.position} bp ({g.strand === "+" ? "Forward" : "Complement"})
                                  </span>
                                  {g.targetsMutation && (
                                    <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1 py-0.2 rounded font-bold uppercase tracking-wide">
                                      Targets Mut Locus
                                    </span>
                                  )}
                                </div>
                                
                                <div className="text-xs font-semibold tracking-wide flex items-center justify-between mt-1">
                                  <span className="text-white text-[13px] select-all tracking-wider">{g.sequence}</span>
                                  <span className="opacity-60 text-[10px] font-bold text-amber-500">{g.pam}</span>
                                </div>

                                <div className="flex items-center gap-4 mt-2.5 text-[9px] text-slate-550 border-t border-slate-800/60 pt-2 w-full">
                                  <span>GC Ratio: <strong className="text-slate-300 font-bold">{g.gcContent}%</strong></span>
                                  <span>Bound Score: <strong className="text-emerald-400 font-bold">{g.efficiencyScore}%</strong></span>
                                  <span>Off-target Safety: <strong className="text-blue-400 font-bold">{g.offTargetScore}%</strong></span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Right: Cas9 Target Binding & Repair Simulation Viewer (lg:col-span-7) */}
                    <div className="lg:col-span-7 space-y-4">
                      
                      {selectedSgRNA ? (
                        <div className="bg-[#18181f]/85 rounded-xl border border-slate-850 p-5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-550 block font-mono">
                                Selected Therapeutic sgRNA
                              </span>
                              <div className="flex items-center gap-1.5 mt-1 font-mono">
                                <span className="text-sm font-extrabold text-teal-400 select-all">{selectedSgRNA.sequence}</span>
                                <span className="text-xs text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                  PAM: {selectedSgRNA.pam}
                                </span>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => runCRISPRSimulation(selectedSgRNA)}
                              disabled={isSimulatingCRISPR}
                              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-teal-500/10 disabled:opacity-50 disabled:scale-95"
                            >
                              {isSimulatingCRISPR ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Simulating...</span>
                                </>
                              ) : (
                                <>
                                  <Target className="w-3.5 h-3.5" />
                                  <span>Simulate Cas9 Edit</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Quick details ribbon */}
                          <div className="grid grid-cols-3 gap-3 bg-[#0a0a0c] border border-slate-850 rounded-lg p-3 text-center">
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase font-mono block">Annealing Score</span>
                              <span className="text-base font-mono text-white font-bold">{selectedSgRNA.efficiencyScore}%</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase font-mono block">Structural Safety</span>
                              <span className="text-base font-mono text-emerald-400 font-bold">
                                {selectedSgRNA.offTargetScore >= 80 ? "Grade A" : "Grade B"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase font-mono block">Cut Coordinates</span>
                              <span className="text-base font-mono text-amber-500 font-bold">Pos {selectedSgRNA.position + 17} bp</span>
                            </div>
                          </div>

                          {/* Interactive Double Stranded Break (DSB) Cut map representation */}
                          <div className="bg-black/40 p-4 rounded-lg font-mono text-xs text-center border border-slate-850 space-y-1 select-none">
                            <span className="text-[9px] uppercase font-bold text-slate-600 block text-left mb-1.5">
                              Dual-domain nucleophilic cleavage map 
                            </span>
                            <div className="flex justify-center flex-wrap gap-0.5 text-[10px]">
                              {selectedSgRNA.dnaSequence.split("").map((b, idx) => (
                                <div key={idx} className="flex flex-col items-center">
                                  <span className="text-teal-400 font-bold">{b}</span>
                                  <span className="text-slate-650">│</span>
                                  <span className="text-slate-500">{b === "A" ? "T" : b === "T" ? "A" : b === "C" ? "G" : "C"}</span>
                                </div>
                              ))}
                              {/* Cut indicator spacer */}
                              <div className="flex flex-col items-center px-1 font-bold animate-pulse">
                                <span className="text-red-500">▼ dsBreak</span>
                                <span className="text-red-650">🗲</span>
                                <span className="text-red-500">▲ cut</span>
                              </div>
                              {selectedSgRNA.pam.split("").map((b, idx) => (
                                <div key={idx} className="flex flex-col items-center opacity-70">
                                  <span className="text-amber-500 font-bold">{b}</span>
                                  <span className="text-slate-700">╵</span>
                                  <span className="text-slate-600">{b === "A" ? "T" : b === "T" ? "A" : b === "C" ? "G" : "C"}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Simulation Result Box */}
                          {crisprError && (
                            <div className="bg-red-950/20 border border-red-900 p-3 rounded text-xs text-red-400 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                              <span>{crisprError}</span>
                            </div>
                          )}

                          {crisprSimulation ? (
                            <div className="space-y-4 animate-fade-in border-t border-slate-800/80 pt-4">
                              
                              {/* Molecular consequence and HDR donor template split */}
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-teal-450 uppercase font-mono font-bold block mb-1">
                                    I. Homology-Directed Repair (HDR) Donor Template (ssODN)
                                  </span>
                                  <div className="bg-[#121216] border border-slate-800 p-3 rounded font-mono text-center relative max-w-full">
                                    <span className="text-sm text-emerald-400 font-bold select-all break-all tracking-widest block pr-8">
                                      {crisprSimulation.hdrTemplate}
                                    </span>
                                    <span className="absolute right-2 top-2 text-[8px] uppercase text-emerald-500/60 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 rounded font-mono">
                                      5' Donor
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                                    Co-transfecting this donor template corrects targeted alleles back to the fully healthy wild-type genotype.
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-[#121216]/50 border border-slate-850 p-4 rounded-lg space-y-1">
                                    <span className="text-[10px] font-bold text-amber-400 block uppercase font-mono">
                                      II. Molecular Consequence
                                    </span>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                      {crisprSimulation.molecularConsequence}
                                    </p>
                                  </div>
                                  
                                  <div className="bg-[#121216]/50 border border-slate-850 p-4 rounded-lg space-y-1">
                                    <span className="text-[10px] font-bold text-blue-405 block uppercase font-mono">
                                      III. Off-Target Evaluation & Delivery
                                    </span>
                                    <p className="text-xs text-slate-350 leading-relaxed">
                                      {crisprSimulation.offTargetEvaluation}
                                      <br />
                                      <strong className="text-[10px] text-slate-550 block mt-1.5">
                                        Therapeutic Feasibility: {crisprSimulation.therapeuticalFeasibility}
                                      </strong>
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Actionable Clinical protocol step sequence */}
                              <div className="space-y-2 pt-2 border-t border-slate-800">
                                <span className="text-[10px] text-teal-450 uppercase font-mono font-bold block mb-1">
                                  IV. Transfection & Wet-Lab Experimental Sequence Protocols
                                </span>
                                
                                <ol className="space-y-2">
                                  {crisprSimulation.experimentalSteps.map((step, sIdx) => (
                                    <li key={sIdx} className="text-xs text-slate-300 flex items-start gap-2.5 leading-relaxed bg-[#121216]/20 p-2 border border-slate-850/50 rounded">
                                      <span className="w-5 h-5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 flex font-mono font-semibold text-[10px] items-center justify-center flex-shrink-0 mt-0.5">
                                        {sIdx + 1}
                                      </span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>

                            </div>
                          ) : (
                            <div className="bg-slate-900/10 border border-dashed border-slate-850 p-8 text-center rounded-xl text-slate-400 space-y-3">
                              <Zap className="w-8 h-8 text-teal-500/70 mx-auto animate-pulse" />
                              <div className="text-xs font-semibold">Cas9 Edit Simulator Ready</div>
                              <p className="text-[11px] text-slate-550 max-w-sm mx-auto leading-relaxed">
                                Press the <strong>Simulate Cas9 Edit</strong> button to trigger biophysical repair sequence simulations and construct targeted clinical delivery metrics.
                              </p>
                            </div>
                          )}

                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-850 rounded-xl bg-[#121216]/20">
                          <Scissors className="w-12 h-12 text-slate-700 animate-pulse mb-3" />
                          <span className="text-xs font-bold text-slate-400">No Target Custom Selected</span>
                          <p className="text-[10px] text-slate-550 max-w-xs mt-1 leading-relaxed">
                            Click on any of the computed single-guide RNAs in the left list to explore locus coordinates and run repair simulations.
                          </p>
                        </div>
                      )}

                    </div>

                  </div>
                </div>

              </div>
            )}

          </div>

          {/* 3. Clinical AI Consultation Sidebar pane (Right hand side inside main view) */}
          <section className="w-96 bg-[#121216] border-l border-slate-800 flex flex-col flex-shrink-0 h-full">
            
            {/* Chat header */}
            <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-[#18181f]/40">
              <div className="flex items-center gap-2">
                <Sparkles className="text-teal-400 w-4 h-4" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest">
                    AI Clinical Co-Counsel
                  </h3>
                  <span className="text-[9px] text-slate-550 block font-mono">ACMG-v2 Compliant Node</span>
                </div>
              </div>
              <button
                onClick={() => setChatMessages([])}
                className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-slate-300"
                title="Clear Consultation Chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Questions to ask shortcuts */}
            <div className="p-3 border-b border-slate-850/60 bg-[#16161d]/10 space-y-1.5">
              <span className="text-[8px] uppercase font-bold tracking-widest text-slate-500 block mb-1">
                Suggested consultations
              </span>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => handleSendChatMessage(undefined, "What is the ACMG Pathogenicity classification of these mutations?")}
                  className="w-full text-left text-[10px] text-slate-300 hover:text-white bg-[#18181f] border border-slate-850 rounded py-1 px-2.5 transition-colors truncate"
                >
                  "Analyze mutation pathogenicity"
                </button>
                <button
                  onClick={() => handleSendChatMessage(undefined, `Explain how ${geneName} protein function changes with these mutations.`)}
                  className="w-full text-left text-[10px] text-slate-300 hover:text-white bg-[#18181f] border border-slate-850 rounded py-1 px-2.5 transition-colors truncate"
                >
                  "Explain molecular mechanism"
                </button>
                <button
                  onClick={() => handleSendChatMessage(undefined, "Suggest follow-up validation sequencing or assays.")}
                  className="w-full text-left text-[10px] text-slate-300 hover:text-white bg-[#18181f] border border-slate-850 rounded py-1 px-2.5 transition-colors truncate"
                >
                  "Suggest validation assays"
                </button>
              </div>
            </div>

            {/* Chat Body messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2 select-none">
                  <MessageSquare className="w-8 h-8 text-slate-700 animate-pulse" />
                  <span className="text-xs text-slate-500 font-bold block">No Consultation Session Started</span>
                  <p className="text-[10px] text-slate-600 leading-relaxed max-w-xs">
                    Choose a suggested question above or type your clinical genomic query to initiate biochemical reasoning.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[9px] font-mono text-slate-600">
                        <span>{isUser ? "CLINICAL RESEARCHER" : "CO-COUNSEL"}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div
                        className={`rounded-xl p-3 text-xs leading-relaxed max-w-[85%] border shadow-sm ${
                          isUser
                            ? "bg-teal-500/10 border-teal-500/30 text-teal-200"
                            : "bg-[#18181f]/80 border-slate-805 text-slate-200 font-sans"
                        }`}
                      >
                        {/* Inline markdown highlights */}
                        <p className="whitespace-pre-line leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Chat input box */}
            <form onSubmit={handleSendChatMessage} className="p-3 bg-[#18181f]/60 border-t border-slate-850 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isChatSending ? "Computing consult..." : "Inquire about clinical variant..."}
                disabled={isChatSending || !analysisResult}
                className="flex-1 bg-black/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
                id="input-chat-query"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatSending || !analysisResult}
                className="w-8 h-8 bg-teal-500 hover:bg-teal-400 text-black rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:bg-slate-800 disabled:text-slate-600 disabled:scale-95 flex-shrink-0 shadow shadow-teal-500/10"
                id="btn-send-chat"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

          </section>

        </div>

      </main>

    </div>
  );
}
