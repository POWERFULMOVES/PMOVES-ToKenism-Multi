# PMOVES-DoX Analysis & Integration Strategy

**Analysis Date:** 2025-11-06
**Repository:** https://github.com/POWERFULMOVES/PMOVES-DoX
**Status:** ⭐⭐⭐⭐⭐ EXCELLENT - Highly Sophisticated Document Intelligence Platform

---

## 🎯 Executive Summary

**PMOVES-DoX is a state-of-the-art document intelligence and analysis platform** - far more sophisticated than anticipated. It's not just a data analysis tool; it's a comprehensive AI-powered document processing, extraction, and visualization system with advanced capabilities that are **perfect** for integrating with PMOVEStokensim and Firefly-iii.

**Key Insight:** DoX is the "missing piece" for creating a complete cooperative economics validation and analysis ecosystem.

---

## 📋 What is PMOVES-DoX?

### Official Description
> "The ultimate document structured data extraction and analysis tool. Extract, analyze, transform, and visualize data from PDFs, XML logs, CSV/XLSX, and OpenAPI/Postman collections. Local-first with Hugging Face + Ollama; ships as standalone, Docker, and MS Teams Copilot/MCP-friendly."

### Core Mission
Build a **documentation + troubleshooting workbench** focused on:
- LMS documentation (PDF)
- XML logs
- API collections (OpenAPI/Postman)
- Financial documents
- Structured data analysis

---

## 🔬 Technical Capabilities

### 1. **Advanced Document Processing**

#### **PDF Processing (IBM Granite Docling)**
- **State-of-the-art extraction:** Uses IBM's Docling 2.x (Granite model)
- **Multi-page tables:** Automatic merging across pages
- **Chart/figure extraction:** Saves to `artifacts/charts/` with OCR
- **Formula detection:** Block equations + inline expressions with LaTeX
- **Named Entity Recognition:** Via spaCy (`en_core_web_sm`)
- **Hierarchical structure:** Heading-based document structure mapping
- **Contextual metrics:** Regex-driven business metric extraction
- **Financial statement detection:** Income statements, balance sheets, cash flow
- **Vision/VLM extensions:** Optional image captions via Granite VLM

**Key Feature:** PDF page awareness with exact page numbers for citations

#### **CSV/XLSX Processing**
- **Pandas-based:** Full data manipulation capabilities
- **Automatic fact extraction:** Revenue, spend, conversions, CPA, ROAS, CTR
- **Complex table handling:** Merged headers, multi-level columns
- **Data transformation:** Built-in pipeline for data cleaning

#### **XML Log Processing**
- **XPath mapping:** Configurable log structure extraction
- **Time/level/code filtering:** Structured log analysis
- **Component tracking:** Multi-dimensional log organization
- **CSV export:** Filtered log data for analysis

#### **OpenAPI/Postman Collections**
- **API catalog:** Complete endpoint documentation
- **Parameter merging:** Path-level + operation-level parameters
- **Security normalization:** Standardized security scheme extraction
- **cURL generation:** Copy-to-clipboard for testing
- **Response examples:** Full request/response documentation

### 2. **AI/ML Capabilities**

#### **Vector Search**
- **FAISS index:** Fast similarity search (CPU/GPU)
- **Sentence Transformers:** State-of-the-art embeddings
- **NumPy fallback:** Works without FAISS
- **Global search bar:** Type filters (PDF, API, LOG, TAG)
- **Deep linking:** Results link to specific panels/pages

#### **LangExtract (Tag Extraction)**
- **Google LangExtract:** Entity and tag extraction
- **LMS presets:** Pre-configured prompts for common use cases
- **Dry-run mode:** Preview before applying
- **Governance:** Save/history/restore/merge/rename tags
- **Few-shot learning:** Supports examples for better extraction

#### **Q&A with Citations**
- **Natural language questions:** "What is the total revenue?"
- **Source attribution:** Exact page numbers and locations
- **HRM reasoning:** Optional experimental reasoning model
- **Context-aware:** Uses document structure for better answers

#### **Local LLM Integration (Ollama)**
- **Gemma 3:** Local LLM for offline extraction
- **Gemma Embedding:** Local embeddings
- **Qwen models:** Support for Qwen 2.5
- **Internal Ollama:** No port conflicts, compose-network only
- **Custom models:** Extensible to other Ollama models

#### **HRM (Hybrid Reasoning Model) - Experimental**
- **L-Module refinement:** Iterative improvement loop
- **Q-Head halting:** Early stopping when confident
- **Configurable steps:** `HRM_MMAX=6`, `HRM_MMIN=2`
- **Metrics tracking:** Totals and rolling averages
- **Use cases:** Tag extraction, Q&A refinement

### 3. **Data Analysis & Visualization**

#### **CHR (Constellation Harvest Regularization)**
- **Purpose:** Structure data for visualization
- **Parameters:** K-means clustering, iteration counts, PCA bins
- **Outputs:** MHEP, Hg, Hs metrics + CSV/JSON/plots
- **Integration:** Feeds into datavzrd dashboards

#### **datavzrd Dashboards**
- **Rust-based visualization:** Fast, static dashboards
- **Auto-generation:** From CHR output
- **Spells support:** Pre-built enhancements from datavzrd-spells
- **Port 5173:** Standalone dashboard server
- **Table wrapping:** Optional cell wrapping for readability

#### **schemavzrd (Database Schema Docs)**
- **Purpose:** Visualize database schemas
- **PostgreSQL support:** Full schema documentation
- **Port 5174:** Standalone schema viewer
- **Output artifacts:** Generated in `backend/artifacts/out/schema`

#### **Financial Statement Analysis**
- **Auto-detection:** Income statements, balance sheets, cash flow
- **Merged-header normalization:** Handle complex table structures
- **Confidence scoring:** Reliability indicators
- **Metric highlighting:** Key financial metrics extracted
- **API endpoint:** `GET /analysis/financials` for dashboard integration

### 4. **Technology Stack**

#### **Backend (FastAPI + Python 3.11+)**
```python
Key Libraries:
- FastAPI 0.109.0           # Modern async web framework
- Docling >=2.50.0          # IBM Granite PDF processing
- Pandas 2.2.0              # Data analysis
- FAISS-CPU >=1.8.0         # Vector search
- sentence-transformers     # Embeddings
- LangExtract >=0.1.0       # Entity extraction
- scikit-learn >=1.4.0      # ML algorithms
- SQLModel >=0.0.16         # ORM
- Supabase >=2.4.0          # Optional backend
- Alembic >=1.13.1          # Database migrations
- Transformers >=4.42.0     # Hugging Face models
- spaCy (optional)          # NER
- matplotlib >=3.8.0        # Plotting
```

#### **Frontend (Next.js 14 + TypeScript)**
```typescript
Key Technologies:
- Next.js 14                # React framework
- TypeScript                # Type safety
- Tailwind CSS              # Styling
- Sticky header             # Product name, global search
- Settings modal            # API config, VLM badge
- POML export               # Microsoft Copilot Studio
- Faceted views             # Workspace/logs/APIs/tags/artifacts
- Toast notifications       # UX feedback
```

#### **Infrastructure**
- **Docker Compose:** Multi-profile (CPU, GPU, Jetson)
- **Supabase:** Optional PostgreSQL backend
- **Ollama:** Optional local LLM server
- **Watch folder:** Auto-ingest on file drop
- **Hugging Face:** Model downloads (optional auth)
- **Pandoc:** High-fidelity DOCX conversion

### 5. **GPU & Hardware Support**

#### **NVIDIA GPU**
- **CUDA 12.1 runtime:** PyTorch 2.3.1
- **Container Toolkit:** Native GPU access
- **Docling acceleration:** `DOCLING_DEVICE` env var
- **SentenceTransformers:** `SEARCH_DEVICE` auto-detect
- **VLM models:** Granite Docling 258M

#### **Jetson Support**
- **JetPack 4.x (Nano):** L4T r32.7.1 base
- **JetPack 5/6 (Orin):** L4T r36.3.0 base
- **ARM64 optimized:** Native architecture
- **L4T ML base:** Includes CUDA/cuDNN
- **Resource-aware:** Small model recommendations

#### **CPU Fallback**
- **No GPU required:** Full functionality on CPU
- **NumPy search:** Fallback when FAISS unavailable
- **CPU compose:** `docker-compose.cpu.yml`
- **Windows/WSL2:** Fully supported

---

## 🎯 Perfect Fit for PMOVEStokensim Integration

### Why PMOVES-DoX is Ideal

1. **Statistical Analysis Capabilities**
   - Pandas for data manipulation
   - scikit-learn for ML algorithms
   - FAISS for pattern detection
   - Correlation analysis built-in

2. **Advanced Visualization**
   - datavzrd for interactive dashboards
   - matplotlib for custom plots
   - CHR for data structuring
   - Chart extraction from PDFs

3. **Financial Document Processing**
   - Financial statement detection
   - Table extraction and merging
   - Metric extraction (revenue, costs, etc.)
   - **Perfect for processing Firefly-iii financial reports**

4. **CSV/Data Analysis**
   - **Can process PMOVEStokensim CSV exports directly**
   - Automatic metric calculation
   - Fact extraction with citations
   - Data transformation pipelines

5. **Q&A and Insights**
   - Natural language queries on simulation data
   - "What was the average Gini coefficient in year 3?"
   - Citations show exact week/data point
   - HRM reasoning for complex questions

6. **Local-First & Privacy-Preserving**
   - No cloud dependencies required
   - Offline Hugging Face models
   - Optional Ollama for local LLMs
   - Perfect for cooperative member data privacy

---

## 🔗 Integration Opportunities with PMOVEStokensim

### Use Case 1: **Simulation Results Analysis**

**Flow:**
```
PMOVEStokensim → Export CSV
                    ↓
                PMOVES-DoX
                    ↓
        Ingest via /upload endpoint
                    ↓
        Extract facts: Gini trends, wealth changes
                    ↓
        Generate datavzrd dashboard
                    ↓
        Enable Q&A: "Show me weeks with high inequality"
                    ↓
        CHR analysis: Cluster similar weeks
```

**Benefits:**
- Interactive dashboards for simulation results
- Natural language exploration of data
- Pattern detection across multiple runs
- Automated insight generation

### Use Case 2: **Firefly-iii Financial Report Processing**

**Flow:**
```
Firefly-iii → Export financial report (PDF/CSV)
                    ↓
                PMOVES-DoX
                    ↓
        Process with Docling (PDF) or Pandas (CSV)
                    ↓
        Extract: Spending patterns, savings rates
                    ↓
        Calculate: Internal vs external spending %
                    ↓
        Compare with simulation predictions
                    ↓
        Generate validation report
```

**Benefits:**
- Automated extraction of actual spending data
- Compare with simulated spending patterns
- Validate 15% and 25% savings assumptions
- Track real cooperative member outcomes

### Use Case 3: **Multi-Scenario Comparison**

**Flow:**
```
Multiple PMOVEStokensim runs → CSV exports
                    ↓
                PMOVES-DoX
                    ↓
        Batch ingest all scenarios
                    ↓
        CHR clustering: Group similar outcomes
                    ↓
        Vector search: Find scenarios with specific properties
                    ↓
        datavzrd dashboard: Side-by-side comparison
                    ↓
        Q&A: "Which scenario had lowest poverty in year 2?"
```

**Benefits:**
- Compare 10+ scenarios simultaneously
- Find optimal parameter combinations
- Automated pattern recognition
- Interactive exploration

### Use Case 4: **Validation Report Generation**

**Flow:**
```
Simulated data + Real data (Firefly-iii)
                    ↓
                PMOVES-DoX
                    ↓
        Calculate validation metrics (MAE, RMSE, R²)
                    ↓
        Generate financial statement comparison
                    ↓
        Extract key insights with LangExtract
                    ↓
        Create POML report for Copilot Studio
                    ↓
        Export to PDF/DOCX with Pandoc
```

**Benefits:**
- Professional validation reports
- Automated metric calculation
- Natural language summaries
- Microsoft Copilot integration for insights

### Use Case 5: **Advanced Statistical Analysis**

**Flow:**
```
PMOVEStokensim historical data
                    ↓
                PMOVES-DoX
                    ↓
        scikit-learn: Regression models
                    ↓
        Predict future wealth trajectories
                    ↓
        Identify outlier weeks/members
                    ↓
        Correlation analysis: parameters vs outcomes
                    ↓
        Generate insights: "Group buying saves 18% ± 3%"
```

**Benefits:**
- Machine learning on simulation results
- Predictive analytics
- Outlier detection
- Statistical validation with confidence intervals

---

## 📊 Specific Integration Points

### API Endpoints for Integration

| DoX Endpoint | Purpose | PMOVEStokensim Use |
|--------------|---------|---------------------|
| **POST /upload** | Upload CSV/PDF/XLSX | Simulation results, Firefly exports |
| **GET /facts** | Get extracted facts | Retrieve simulation insights |
| **POST /ask** | Q&A with citations | Query simulation results |
| **POST /structure/chr** | Run CHR clustering | Group similar simulation weeks |
| **POST /viz/datavzrd** | Generate dashboard | Visualize simulation results |
| **GET /analysis/financials** | Financial statements | Process Firefly-iii reports |
| **GET /analysis/metrics** | Business metrics | Extract simulation KPIs |
| **POST /search** | Vector search | Find similar scenarios |
| **POST /extract/tags** | LangExtract tags | Categorize simulation outcomes |
| **POST /export/poml** | POML export | Copilot Studio integration |
| **POST /convert** | Convert to TXT/DOCX | Report generation |

### Data Flow Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    PMOVES Ecosystem                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ PMOVESToken │      │ Firefly-iii  │      │ PMOVES-DoX   │ │
│  │ Simulator   │      │ (Real Data)  │      │ (Analysis)   │ │
│  └─────────────┘      └──────────────┘      └──────────────┘ │
│        │                      │                      │         │
│        │ CSV Export           │ Financial Reports    │         │
│        └──────────────────────┴──────────────────────┘         │
│                              │                                  │
│                         Upload to DoX                          │
│                              │                                  │
│                              ▼                                  │
│                    ┌──────────────────┐                        │
│                    │  PMOVES-DoX      │                        │
│                    │  Processing      │                        │
│                    ├──────────────────┤                        │
│                    │ • Docling (PDF)  │                        │
│                    │ • Pandas (CSV)   │                        │
│                    │ • FAISS search   │                        │
│                    │ • CHR clustering │                        │
│                    │ • LangExtract    │                        │
│                    │ • Q&A engine     │                        │
│                    └──────────────────┘                        │
│                              │                                  │
│                              ▼                                  │
│              ┌───────────────┴───────────────┐                 │
│              │                               │                 │
│       datavzrd Dashboard            Validation Report          │
│       (Port 5173)                   (PDF/DOCX/POML)           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Integration Implementation Plan

### Phase 1: Basic Integration (Week 1)

**Goal:** Connect PMOVEStokensim exports to DoX for analysis

**Tasks:**
1. Export simulation results to CSV (✅ Already done!)
2. Create DoX upload script/API client
3. Test basic ingestion and fact extraction
4. Verify data can be queried via Q&A

**Deliverable:** Script that uploads PMOVEStokensim CSV to DoX and retrieves insights

### Phase 2: Dashboard Generation (Week 2)

**Goal:** Auto-generate datavzrd dashboards for simulation results

**Tasks:**
1. Format CSV exports for optimal DoX processing
2. Run CHR pipeline on simulation data
3. Generate datavzrd project
4. Access dashboards at localhost:5173

**Deliverable:** Automated dashboard generation from simulation runs

### Phase 3: Firefly-iii Integration (Weeks 3-4)

**Goal:** Process real financial data and compare with simulations

**Tasks:**
1. Export Firefly-iii data (CSV/PDF)
2. Upload to DoX for processing
3. Extract actual spending patterns
4. Compare with simulation predictions
5. Generate validation metrics (MAE, RMSE, R²)

**Deliverable:** Validation pipeline with automated comparison

### Phase 4: Advanced Analytics (Weeks 5-6)

**Goal:** ML-based insights and predictions

**Tasks:**
1. Build regression models with scikit-learn
2. Implement outlier detection
3. Run correlation analysis (parameters → outcomes)
4. Generate statistical confidence intervals

**Deliverable:** Predictive models and statistical validation

### Phase 5: Report Generation (Week 7)

**Goal:** Professional reports with insights

**Tasks:**
1. Use LangExtract to generate summaries
2. Create POML exports for Copilot Studio
3. Convert to PDF/DOCX with Pandoc
4. Add visualizations from datavzrd

**Deliverable:** Automated report generation system

---

## 💡 Key Insights & Recommendations

### What Makes DoX Special

1. **IBM Granite Docling:** State-of-the-art PDF extraction (better than PyPDF2, pdfplumber)
2. **Local-First:** No cloud dependencies, perfect for privacy
3. **Financial Focus:** Built-in financial statement detection
4. **Comprehensive:** PDF + CSV + XML + OpenAPI in one tool
5. **AI-Powered:** LangExtract, vector search, Q&A with citations
6. **Visualization:** datavzrd + CHR for interactive dashboards
7. **Extensible:** MCP/POML for Microsoft Copilot integration

### Recommended Approach

**Short-term (Immediate):**
1. Deploy DoX locally (Docker Compose CPU mode)
2. Test with sample PMOVEStokensim CSV exports
3. Explore Q&A capabilities
4. Generate first datavzrd dashboard

**Medium-term (Next Month):**
1. Build automated integration pipeline
2. Process Firefly-iii financial data
3. Create validation dashboards
4. Implement ML-based analysis

**Long-term (Next Quarter):**
1. Real-time monitoring with watch folder
2. Automated report generation
3. Microsoft Copilot integration
4. Custom DoX extensions for cooperative economics

---

## 🔧 Technical Requirements

### Deployment Options

**Option A: Docker Compose (Recommended)**
```bash
cd PMOVES-DoX
cp .env.example .env
docker compose -f docker-compose.cpu.yml up --build -d
```
- Backend: http://localhost:8001
- Frontend: http://localhost:3000
- datavzrd: http://localhost:5173

**Option B: Local Development**
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

**Option C: GPU Acceleration (Optional)**
```bash
docker compose --compatibility --profile ollama --profile tools up --build -d
```
- Requires NVIDIA GPU + Container Toolkit
- Faster processing for large PDFs
- Local Ollama for LLM extraction

### Environment Variables

```bash
# Optional but recommended
HUGGINGFACE_HUB_TOKEN=your_token_here  # For model downloads
DOCLING_VLM_REPO=ibm-granite/granite-docling-258M  # For image captions
LANGEXTRACT_PROVIDER=ollama  # Use local LLM
OLLAMA_BASE_URL=http://ollama:11434

# For watch folder auto-ingestion
WATCH_ENABLED=true
WATCH_DIR=/app/watch
```

### Resource Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8GB
- Disk: 10GB (for models and artifacts)

**Recommended:**
- CPU: 8 cores
- RAM: 16GB
- Disk: 20GB
- GPU: Optional (NVIDIA for acceleration)

---

## 📈 Expected Benefits

### For PMOVEStokensim

| Benefit | Impact | How DoX Enables It |
|---------|--------|---------------------|
| **Advanced Visualizations** | ⭐⭐⭐⭐⭐ | datavzrd dashboards, CHR clustering |
| **Statistical Validation** | ⭐⭐⭐⭐⭐ | scikit-learn, pandas, correlation analysis |
| **Natural Language Insights** | ⭐⭐⭐⭐ | Q&A engine, LangExtract summaries |
| **Multi-Scenario Analysis** | ⭐⭐⭐⭐⭐ | Vector search, CHR clustering |
| **Professional Reports** | ⭐⭐⭐⭐ | POML export, Pandoc conversion, DOCX/PDF |

### For Firefly-iii Integration

| Benefit | Impact | How DoX Enables It |
|---------|--------|---------------------|
| **Financial Document Processing** | ⭐⭐⭐⭐⭐ | Docling financial statement detection |
| **Actual Data Extraction** | ⭐⭐⭐⭐⭐ | PDF/CSV processing, fact extraction |
| **Validation Automation** | ⭐⭐⭐⭐ | Compare simulated vs actual, metrics calc |
| **Privacy Preservation** | ⭐⭐⭐⭐⭐ | Local-first, no cloud dependencies |

### For Overall Ecosystem

| Benefit | Impact | How DoX Enables It |
|---------|--------|---------------------|
| **Unified Analysis Platform** | ⭐⭐⭐⭐⭐ | Single tool for all data sources |
| **AI-Powered Insights** | ⭐⭐⭐⭐ | LangExtract, HRM reasoning |
| **Scalability** | ⭐⭐⭐⭐ | Docker, GPU support, batch processing |
| **Extensibility** | ⭐⭐⭐⭐⭐ | MCP/POML, API-driven, modular architecture |

---

## 🎯 Final Assessment

### Overall Rating: ⭐⭐⭐⭐⭐ (5/5)

**PMOVES-DoX is exactly what the PMOVES ecosystem needs.**

**Strengths:**
- ✅ State-of-the-art document processing (IBM Docling)
- ✅ Comprehensive analysis capabilities (Pandas, scikit-learn)
- ✅ Advanced AI/ML (LangExtract, vector search, HRM)
- ✅ Financial focus (perfect for cooperative economics)
- ✅ Local-first (privacy-preserving)
- ✅ Professional visualizations (datavzrd)
- ✅ Well-documented and actively maintained
- ✅ Docker-ready with GPU support
- ✅ Extensible (MCP, POML, APIs)

**Integration Potential:** ⭐⭐⭐⭐⭐ (Perfect Fit)

**Complexity Level:** ⭐⭐⭐⭐ (Moderate - well-documented, Docker simplifies deployment)

**Time to First Value:** ~2 hours (Docker deployment + first CSV analysis)

---

## 🚦 Next Steps

### Immediate (This Week)

1. **Deploy DoX locally**
   ```bash
   cd /home/user/PMOVES-DoX
   docker compose -f docker-compose.cpu.yml up --build -d
   ```

2. **Test with PMOVEStokensim CSV**
   - Export simulation results (already implemented ✅)
   - Upload to DoX via UI or API
   - Try Q&A: "What was the final Gini coefficient?"

3. **Generate first dashboard**
   - Run CHR pipeline on simulation data
   - Create datavzrd project
   - View at localhost:5173

### Short-term (Next 2 Weeks)

4. **Build integration script**
   - Automated CSV upload to DoX
   - Extract insights via API
   - Return to PMOVEStokensim dashboard

5. **Process Firefly-iii data**
   - Export real financial data
   - Upload to DoX
   - Compare with simulation

### Medium-term (Next Month)

6. **Create validation pipeline**
   - Simulated vs actual comparison
   - Statistical metrics (MAE, RMSE, R²)
   - Automated report generation

7. **Implement ML analysis**
   - Regression models
   - Pattern detection
   - Confidence intervals

---

## 📝 Conclusion

**PMOVES-DoX is a game-changer for the PMOVES ecosystem.**

It transforms the vision from:
- ❌ "We have simulation, real data, and need to manually analyze"

To:
- ✅ "We have an AI-powered platform that automatically analyzes, validates, and generates insights from both simulated and real data"

**This completes the PMOVES trinity:**
1. **PMOVEStokensim** - Simulation and modeling
2. **Firefly-iii** - Real-world data collection
3. **PMOVES-DoX** - Advanced analysis and validation

**Recommendation:** **START INTEGRATION IMMEDIATELY** - The ROI is extremely high.

---

**Analysis Completed:** 2025-11-06
**Status:** Ready for Integration Phase 1
**Estimated Time to Integration:** 1-2 weeks for basic, 4-6 weeks for full integration

---

## 🔗 Quick Reference Links

- **DoX README:** `/home/user/PMOVES-DoX/README.md`
- **Project Structure:** `/home/user/PMOVES-DoX/PROJECT_STRUCTURE.md`
- **Advanced Features:** `/home/user/PMOVES-DoX/ADVANCED_FEATURES_PLAN.md`
- **Agent Guidelines:** `/home/user/PMOVES-DoX/AGENTS.md`
- **Backend Requirements:** `/home/user/PMOVES-DoX/backend/requirements.txt`
- **Docker Compose:** `/home/user/PMOVES-DoX/docker-compose.yml`

**Everything is ready. Let's build the future of cooperative economics analysis!** 🚀
