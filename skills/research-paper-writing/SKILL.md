---
name: research-paper-writing
description: Structured pipeline for writing ML and AI research papers — from literature review to LaTeX submission
category: research
version: 1.0.0
origin: aiden
tags: research, paper, writing, latex, ml, ai, academic, arxiv, publication, citation
---

# Research Paper Writing Pipeline

A structured, step-by-step pipeline for writing ML/AI research papers: from problem framing through literature review, experiment design, writing, and LaTeX formatting for arXiv submission.

## When to Use

- User wants to write or structure an academic research paper
- User wants help organizing experiments and results for a paper
- User wants to format a paper in LaTeX for arXiv or a conference
- User wants to do a literature review on a topic
- User wants to write an abstract, introduction, or related work section

## How to Use

### Phase 1: Frame the contribution

Define the paper's core claim before writing anything else.

```
1. One-sentence contribution: "We show that X outperforms Y on Z by doing W"
2. Key insight: what is non-obvious about your approach?
3. Research question: what question does the paper answer?
4. Limitations scope: what is explicitly out of scope?
```

### Phase 2: Literature review

Use the arXiv skill to find related work, then organize findings:

```
Search strategy:
- Start with 2-3 "seed" papers you know are relevant
- Find papers that cite them (via Semantic Scholar API)
- Search arXiv for your core keywords + recent date filter
- Organize into: direct predecessors, concurrent work, tangential work

For each related paper, note:
- Core method
- Dataset/benchmark used
- Key result number
- How your work differs
```

```python
# Semantic Scholar API — find papers citing a known paper
import requests
paper_id = "arXiv:2305.17333"
resp = requests.get(f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}/citations?fields=title,year,authors,externalIds&limit=20")
for c in resp.json()["data"]:
  print(c["citingPaper"]["title"])
```

### Phase 3: Structure the paper

Standard ML/AI paper structure:

```
Abstract   (150-250 words) — problem, method, key result, significance
1. Introduction — motivation, gap, contribution, paper overview
2. Related Work — organize by theme, not chronologically
3. Method — notation, architecture/algorithm, key design choices
4. Experiments — datasets, baselines, metrics, implementation details
5. Results — main table, ablation study, qualitative examples
6. Discussion — limitations, failure modes, future work
7. Conclusion — restate contribution, broader impact
References
Appendix (optional) — proofs, additional experiments, hyperparameters
```

### Phase 4: Write in LaTeX

Basic arXiv-ready template:

```latex
\documentclass[10pt,twocolumn]{article}
\usepackage{arxiv}       % from https://github.com/kourgeorge/arxiv-style
\usepackage{amsmath,amssymb,graphicx,booktabs,hyperref}

\title{Your Paper Title}
\author{Author One \and Author Two}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
Your abstract here. State the problem, method, key result, and significance in 150--250 words.
\end{abstract}

\section{Introduction}
...

\bibliography{refs}
\bibliographystyle{plain}
\end{document}
```

### Phase 5: Tables and figures

```latex
% Results table with booktabs
\begin{table}[t]
\centering
\caption{Comparison on benchmark dataset.}
\begin{tabular}{lcc}
\toprule
Method & Accuracy & F1 \\
\midrule
Baseline   & 72.3 & 71.1 \\
Prior SOTA & 78.6 & 77.9 \\
\textbf{Ours} & \textbf{83.2} & \textbf{82.7} \\
\bottomrule
\end{tabular}
\label{tab:results}
\end{table}
```

### Phase 6: Compile and check

```powershell
# Compile LaTeX (requires MiKTeX or TeX Live)
pdflatex paper.tex
bibtex paper
pdflatex paper.tex
pdflatex paper.tex   # run twice to resolve references

# Check word count
texcount paper.tex
```

## Examples

**"Help me write the abstract for my paper on efficient transformers"**
→ Use Phase 1 to extract the core claim, then write 4 sentences: problem → gap → method → key result.

**"I need to find related papers on sparse attention before writing the related work section"**
→ Use Phase 2: search arXiv (`cs.LG` + `sparse attention`), use Semantic Scholar to find citing papers.

**"Format my experiment results as a LaTeX table"**
→ Use Phase 5 with the booktabs template.

## Cautions

- Write the related work section after the method section — you need to know your contribution to characterize prior work accurately
- Ablation studies are required at top venues (NeurIPS, ICML, ICLR) — plan them during experiment design, not after
- arXiv LaTeX compilation is strict — avoid non-standard packages; test with `pdflatex` before submitting
- Never include fabricated citations — use only papers you have actually read
- Check target venue formatting guidelines — ICML, NeurIPS, and ICLR each have distinct style files
