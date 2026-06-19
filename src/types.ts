export interface Variant {
  position: number;
  type: string;
  ref: string;
  alt: string;
  description: string;
}

export interface VariantInterpretation {
  position: string;
  type: string;
  change: string;
  significance: string;
  details: string;
}

export interface AIInterpretation {
  summary: string;
  functionalImpact: string;
  diseaseAffiliation: string;
  variantInterpretations: VariantInterpretation[];
  recommendations: string[];
}

export interface AlignmentResult {
  alignedRef: string;
  alignedSample: string;
  matchLine: string;
  score: number;
}

export interface TranslationData {
  aminoAcids: string[];
  codons: string[];
}

export interface GenomicMetrics {
  refLength: number;
  sampleLength: number;
  refGC: number;
  sampleGC: number;
  refFreqs: { A: number; T: number; C: number; G: number };
  sampleFreqs: { A: number; T: number; C: number; G: number };
}

export interface AnalysisResponse {
  success: boolean;
  metrics: GenomicMetrics;
  alignment: AlignmentResult;
  refTranslation: TranslationData;
  sampleTranslation: TranslationData;
  variants: Variant[];
  interpretation: AIInterpretation;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface GenePreset {
  id: string;
  name: string;
  diseaseContext: string;
  description: string;
  referenceSeq: string;
  sampleSeq: string;
}

export interface SgRNACandidate {
  sequence: string;      // 20bp RNA sequence (with U)
  dnaSequence: string;   // 20bp DNA sequence
  pam: string;           // PAM sequence
  position: number;      // 1-indexed sequence coordinate (locus)
  strand: "+" | "-";
  gcContent: number;     // GC %
  offTargetScore: number; // 0-100 index
  efficiencyScore: number; // 0-100 index
  targetsMutation: boolean; // Near an alt variant locus
}

export interface CRISPRSimulationResult {
  bindScore: number;
  cutPosition: number;
  hdrTemplate: string;
  therapeuticalFeasibility: string;
  molecularConsequence: string;
  offTargetEvaluation: string;
  experimentalSteps: string[];
}

export const GENE_PRESETS: GenePreset[] = [
  {
    id: "brca1",
    name: "BRCA1 (Breast Cancer Type 1)",
    diseaseContext: "Hereditary Breast and Ovarian Cancer Syndrome (HBOC)",
    description: "Ashkenazi Jewish founder mutation (185delAG) causing a frameshift and early stop codon.",
    referenceSeq: "ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAATGTCATTAATGCTATGCAGCAGACAG",
    sampleSeq: "ATGGATTTATCTGCTCTTCGCGTTGTGAAGAAGTACAAATGTCATTAATGCTATGCAGCAGACAG"
  },
  {
    id: "hbb",
    name: "HBB (Beta-Globin)",
    diseaseContext: "Sickle Cell Anemia (p.Glu6Val mutation)",
    description: "Pathogenic substitution at position 17 (A ➔ T) which alters the 6th codon GAG (Glutamic Acid) to GTG (Valine).",
    referenceSeq: "ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAAC",
    sampleSeq: "ATGGTGCACCTGACTCCTGTGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAAC"
  },
  {
    id: "cftr",
    name: "CFTR (Cystic Fibrosis)",
    diseaseContext: "Cystic Fibrosis (Severe p.Phe508del deletion)",
    description: "Loss of 3 consecutive base nucleotides (CTT), deleting functional Phenylalanine at amino acid 508.",
    referenceSeq: "ATCATTGGTGTTTCCTATGATGAATATAGACACAGAAGCGTCATCAAAGCAGTGTTA",
    sampleSeq: "ATCATTGGTTCCTATGATGAATATAGACACAGAAGCGTCATCAAAGCAGTGTTA"
  },
  {
    id: "sarscov2",
    name: "SARS-CoV-2 Spike (Adaptation)",
    diseaseContext: "Viral Host Adhesion Adaptability",
    description: "Simulated receptor-binding motif mutations modifying structural binding characteristics.",
    referenceSeq: "ACCCAGGAACTATTGCTAGTGAGTCAAGTATAACAAGGCCAACCGTGAGGTTAAGTGAT",
    sampleSeq: "ACCCCGGAACTATTGCTAGAGAGTCAAGTAGAACAAGGCCAACCGTGAGGTGAAGTGCG"
  },
  {
    id: "fam178b",
    name: "FAM178B (Bajau Diving)",
    diseaseContext: "Hypoxia Tolerance / Deep Water Apnea",
    description: "Adaptation observed in the Bajau people linked to larger spleen size and an enhanced diving reflex for prolonged underwater hypoxia.",
    referenceSeq: "ATGGAACGTGTCGTTGTGGAAAGCCGCTATCACAGAGACTTAGATAAT",
    sampleSeq: "ATGGAACGTGTCGTTGTGGGAAGCCGCTATCACAGAGACTTAGATAAT"
  },
  {
    id: "epas1",
    name: "EPAS1 (Tibetan Altitude)",
    diseaseContext: "High-Altitude Hypoxia Resistance",
    description: "A regulatory variant introgressed from Denisovans, allowing Tibetans to thrive at extreme high altitudes without polycythemia.",
    referenceSeq: "GCTAGCTAGCTGATTACAACCGGTTAGCCCAAGCTAGCTGATGGCCTA",
    sampleSeq: "GCTAGCTAGCTGATTACAACCGGTTAGCCCAAGCTTGCTGATGGCCTA"
  },
  {
    id: "lrp5",
    name: "LRP5 (Unbreakable Bones)",
    diseaseContext: "Osteosclerosis / High Bone Density",
    description: "A gain-of-function missense mutation in the LRP5 gene resulting in exceptionally high bone density and resistance to fractures.",
    referenceSeq: "CGGTGCTGTTCTCCGGAAAAGTCACAGAAGTGGCGGCTGTAACTGGTG",
    sampleSeq: "CGGTGCTGTTCTCCGGAACAGTCACAGAAGTGGCGGCTGTAACTGGTG"
  },
  {
    id: "dec2",
    name: "DEC2 / BHLHE41 (Short Sleepers)",
    diseaseContext: "Familial Natural Short Sleep",
    description: "A specific structural missense mutation (p.Pro384Arg) that allows individuals to feel fully rested with significantly less sleep.",
    referenceSeq: "TCACTGCTGAGACCTACCCCCGGAGCCTCTACCTGCCCATGTGCCACA",
    sampleSeq: "TCACTGCTGAGACCTACCCGCGGAGCCTCTACCTGCCCATGTGCCACA"
  },
  {
    id: "faah",
    name: "FAAH-OUT (Pain-free & Low Anxiety)",
    diseaseContext: "Congenital Analgesia",
    description: "A structural microdeletion in the FAAH-OUT region that downregulates FAAH expression, resulting in virtual pain insensitivity.",
    referenceSeq: "GGCCTGGCCGTCAAAGAAATGATTGGCAGTATAATTCTTACTTCTAAT",
    sampleSeq: "GGCCTGGCCGTCAAAGAAATTGGCAGTATAATTCTTACTTCTAATCTT"
  },
  {
    id: "actn3",
    name: "ACTN3 (Sprint Athletics)",
    diseaseContext: "Elite Fast-Twitch Muscle Fibers",
    description: "The functional allele of the R577X polymorphism; lack of the nonsense mutation favors elite sprinting and power athletic performance.",
    referenceSeq: "CGAGGCGCACCTGCGTCGCACGTTCCGCCAGCTGCGTGAGCGCACCTA",
    sampleSeq: "CGAGGCGCACCTGCGTCGCACGTTCTGCCAGCTGCGTGAGCGCACCTA"
  },
  {
    id: "superhuman",
    name: "SYNTHETIC: Polygenic 'Superhuman' Construct",
    diseaseContext: "Extreme Anthropological Amalgamation",
    description: "A purely synthetic construct permutating multiple advantageous alleles: Bajau (apnea), Tibetan (hypoxia), LRP5 (density), DEC2 (sleep), FAAH (pain), and ACTN3 (speed).",
    referenceSeq: "ATGGAACGTGTCGTTGTGGAAAGCCGCTATCACAGAGACTTAGATAATGCTAGCTAGCTGATTACAACCGGTTAGCCCAAGCTAGCTGATGGCCTACGGTGCTGTTCTCCGGAAAAGTCACAGAAGTGGCGGCTGTAACTGGTGTCACTGCTGAGACCTACCCCCGGAGCCTCTACCTGCCCATGTGCCACAGGCCTGGCCGTCAAAGAAATGATTGGCAGTATAATTCTTACTTCTAATCGAGGCGCACCTGCGTCGCACGTTCCGCCAGCTGCGTGAGCGCACCTA",
    sampleSeq:  "ATGGAACGTGTCGTTGTGGGAAGCCGCTATCACAGAGACTTAGATAATGCTAGCTAGCTGATTACAACCGGTTAGCCCAAGCTTGCTGATGGCCTACGGTGCTGTTCTCCGGAACAGTCACAGAAGTGGCGGCTGTAACTGGTGTCACTGCTGAGACCTACCCGCGGAGCCTCTACCTGCCCATGTGCCACAGGCCTGGCCGTCAAAGAAATTGGCAGTATAATTCTTACTTCTAATCTTCGAGGCGCACCTGCGTCGCACGTTCTGCCAGCTGCGTGAGCGCACCTA"
  }
];
