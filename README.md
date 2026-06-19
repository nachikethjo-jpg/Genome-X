# Genome Sequence & Genetic Variant Analyzer 🧬🔬

An advanced, full-stack genomic workstation designed for clinical bioinformaticians and researchers to perform needle-in-a-haystack molecular diagnostics. This platform supports pairwise sequence alignment, dynamic codon translation, genetic variant detection (SNVs, insertions, deletions), interactive visualization, and CRISPR-Cas9 sgRNA engineering simulations—coupled with a Gemini-powered clinical genomic copilot.

---

## 🚀 Key Features

### 1. Dynamic Pairwise Alignments (`SequenceVisualizer`)
*   **Optimal Sequence Pairing**: Aligns reference vs. sample DNA sequences dynamically.
*   **Visual Mappings**: Color-coded visualization highlights matching bases (A=A), mismatches (substitutions), frame-disrupting insertions/deletions (`-`), and a custom wavy underline pattern denoting **low-confidence base calls (<65% instrument quality)**.
*   **Detailed Tooltips**: Hovering over any aligned base displays the base coordinate, relative variant status, translation codon details, and simulated sequence confidence index.

### 2. D3-Powered Interactive Mapping (`VariantScatterPlot`)
*   **Pathogenicity Mapping**: Renders genetic variants on an interactive scatter plot plotting sequence position (X-axis) against clinical pathogenicity score / ACMG category (Y-axis).
*   **Intuitive Color Grading**: Vertices are colored by severity (Red for Pathogenic, Yellow for VUS, Green for Benign).
*   **Interactive Synergy**: Selecting any circle highlights the respective mutation in the sequence editor and loads the in-depth molecular interpretation.

### 3. Gemini-Powered Molecular Interpretations
*   **Full-Stack Engine**: Performs server-side queries to cross-reference identified variants.
*   **ACMG Standard Classification**: Provides structured molecular reviews including functional consequence (nonsense mutations, frameshifts, missense substitutions, silent events), clinical syndromes, and ACMG-guided diagnostic recommendations.
*   **Graceful API Quota Failbacks**: If API quota triggers a `429 RESOURCE_EXHAUSTED` limit, the server automatically degrades into an elegant offline diagnostics reporter with visible notifications on the UI.

### 4. CRISPR-Cas9 sgRNA Selection & Simulation
*   **sgRNA Explorer**: Scans sequences to identify valid sgRNA candidates near discovered mutations.
*   **Clinical Safety & Quality Scores**: Rates candidates with PAM verification, GC ratio analysis, simulated off-target toxicity risk indices, and cleavage efficiency percentages.
*   **Experimental Simulation**: Predicts CRISPR bind scores, DNA cleavage locus, homologous repair template recommendations (HDR), and outlines clinical experimental workflows.

### 5. Curated Clinical Presets
Includes highly validated disease and evolutionary biomarkers:
*   `BRCA1`: The Ashkenazi Jewish founder mutation (**185delAG**) leading to structural frameshifts and premature translation termination.
*   `HBB (Beta-Globin)`: Standard molecular culprit behind **Sickle Cell Anemia**, swapping codon 6 GAG (Glutamic Acid) to GTG (Valine).
*   `CFTR`: The severe **p.Phe508del** deletion deleting functional Phenylalanine in Cystic Fibrosis.
*   `SARS-CoV-2 Spike`: Receptor-binding domain adjustments showing viral adaptability.
*   `FAM178B (Bajau Diving)`: Evolutionary variant associated with spleen physiological size expansions and deep-water hypoxia tolerance.
*   `EPAS1 (Tibetan Altitude)`: Introgression from archaic Denisovans permitting survival in extreme high-altitude atmospheres.

---

## 🛠️ Stack Configuration

*   **Frontend**: React (Vite, TS), Tailwind CSS, Lucide Icons, Recharts & D3.js.
*   **Backend**: Express Server with bundled TypeScript rendering (`tsx` & `esbuild`).
*   **AI Integration**: Google GenAI SDK (`@google/genai` with `gemini-3.5-flash`).
*   **Persistence**: Firebase (Firestore & Auth) for tracking patient cohorts and historically simulated genome alignment variants.
