# LLM Registry Hardware-Routed Provider Specification

**Module**: PMOVES-ToKenism-Multi → pmoves_registry
**Target Hardware**: DGX Spark (GB10 Grace-Blackwell, 128 GB unified) + 8×A100 80GB NVLink
**Status**: Draft — Implementation Reference
**Date**: 2026-05-19
**Gap Reference**: AGNOTE4482 M4 (Unsloth SPARK-local deployment)

---

## 1. Overview & Scope

### 1.1 What This Spec Covers

Addition of three hardware-routed LLM providers to `pmoves/config/provider_catalog.yaml`:

| Provider | Integration Type | Transport | Auto-Discovery |
|----------|-----------------|-----------|----------------|
| vLLM | `openai_compatible` | HTTP (OpenAI API) | `/v1/models` endpoint |
| Llama.cpp | `openai_compatible` | HTTP (OpenAI API) | `/v1/models` endpoint |
| Unsloth | `local_inference` | Python import | Filesystem scan |

Plus:
- Docker Compose service fragments for vLLM and Llama.cpp
- Hardware profile updates for `dgx-spark-grace-blackwell.yaml`
- Cascade integration rules for `provider_cascade.py`

### 1.2 Relationship to Existing System

The current provider catalog already contains hardware-routed precedents:

- **`nvidia_nim`** — localhost:8000, OpenAI-compatible, NVIDIA NIM container
- **`llamacpp_rocm`** — remote host:8080, OpenAI-compatible, AMD RDNA4 via llama.cpp HIP
- **`ollama_spark`** — localhost:11434, OpenAI-compatible, Ollama on GB10

This spec extends the same pattern. vLLM and Llama.cpp follow the proven `openai_compatible` path. Unsloth requires a new `local_inference` integration type because it is a Python library for fine-tuning and inference, not an HTTP server.

### 1.3 The Unsloth Gap (AGNOTE4482 M4)

Current state: Unsloth recipes in PMOVES target the Fireworks API for hosted fine-tuning. There is no SPARK-local deployment path. Unsloth cannot be shoehorned into the `openai_compatible` pattern because:

1. It exposes no HTTP server — it's a Python library (`from unsloth import FastLanguageModel`)
2. It consumes GPU memory for training, competing with serving backends
3. Its output is a LoRA adapter or merged GGUF file, not a running model
4. The value is in the *pipeline* (fine-tune → export → serve), not in serving itself

**Resolution**: Unsloth is modeled as a `local_inference` provider with a bridge pattern — fine-tune locally, export GGUF, hand off to Llama.cpp for serving via the standard OpenAI-compatible path.

---

## 2. Provider Registry Entries

### 2.1 New Schema Fields

The following fields extend the existing `provider_catalog.yaml` schema. They are **additive** — all existing fields remain unchanged.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `integration_type` | `enum` | Yes (new) | `openai_compatible` \| `local_inference` \| `native_tz` |
| `model_discovery_method` | `enum` | Yes (new) | `openai_models_endpoint` \| `python_import` \| `static` \| `none` |
| `hardware_requirements` | `object` | No | GPU/arch constraints for activation |
| `profile_activation_rules` | `list` | No | Which profiles auto-enable this provider |
| `unsloth_config` | `object` | No | Unsloth-specific settings (only for `local_inference`) |

### 2.2 vLLM Provider Entry

```yaml
  # ---------------------------------------------------------------------------
  # vllm_spark — High-throughput inference on DGX Spark (GB10 or 8×A100 NVLink)
  # ---------------------------------------------------------------------------
  # OpenAI-compatible server. Auto-discovers loaded models via /v1/models.
  # On GB10: uses ARM64 image (vllm/vllm-openai:latest-arm64 if available,
  #   otherwise build from source — see Risk R1).
  # On 8×A100: standard x86_64 image with tensor-parallel=8.
  # Compose fragment: docker-compose.vllm-spark.yml
  vllm_spark:
    env_var: VLLM_SPARK_URL          # Override URL; no API key needed
    key_pattern: ".*"                # No key validation for local
    api_base: "http://vllm-spark:8000/v1"
    tz_type: openai
    tier: llm
    integration_type: openai_compatible
    model_discovery_method: openai_models_endpoint
    hardware_requirements:
      min_vram_gb: 48
      preferred_gpu_count: 8
      compute_capability: "8.0+"       # Ampere+ for efficient attention
      architectures: [arm64, x86_64]
      notes: "GB10 SM_110 works; 8×A100 SM_80 optimal for tensor-parallel"
    profile_activation_rules:
      - dgx-spark-grace-blackwell
      - dgx-spark-a100-80gb            # Future profile
    models:
      vllm_spark_qwen3_coder_32b:
        model_name: "Qwen/Qwen2.5-Coder-32B-Instruct"
        tz_model_key: vllm_spark_qwen3_coder_32b
        status: planned
        serves:
          - function: coding
            variant_name: vllm_spark_qwen3_coder_32b
            role: secondary
            weight: 0.0
          - function: agent_zero
            variant_name: vllm_spark_qwen3_coder_32b
            role: secondary
            weight: 0.0
        strength_ref: null
        vram_mb: 20000                 # BF16 at ~20GB; FP8 ~10GB
      vllm_spark_llama3_70b:
        model_name: "meta-llama/Llama-3.3-70B-Instruct"
        tz_model_key: vllm_spark_llama3_70b
        status: planned
        serves:
          - function: orchestrator
            variant_name: vllm_spark_llama3_70b
            role: secondary
            weight: 0.0
          - function: agent_zero
            variant_name: vllm_spark_llama3_70b
            role: secondary
            weight: 0.0
          - function: pmoves_research_coordinator
            variant_name: vllm_spark_llama3_70b
            role: secondary
            weight: 0.0
        strength_ref: null
        vram_mb: 14000                 # FP8 on 8×A100; BF16 ~140GB (needs TP8)
      vllm_spark_gemma4_31b:
        model_name: "google/gemma-4-31b-it"
        tz_model_key: vllm_spark_gemma4_31b
        status: planned
        serves:
          - function: multimodal_large
            variant_name: vllm_spark_gemma4_31b
            role: secondary
            weight: 0.0
        strength_ref: null
        vram_mb: 62000                 # FP16 — fits GB10 128GB unified
        multimodal: true
        input_modalities: ["text", "image"]
```

### 2.3 Llama.cpp Provider Entry (SPARK-local)

```yaml
  # ---------------------------------------------------------------------------
  # llamacpp_spark — GGUF inference on DGX Spark via llama.cpp
  # ---------------------------------------------------------------------------
  # OpenAI-compatible server (llama-server). Primary consumer of Unsloth
  # exported GGUF files. Runs on ARM64 natively (no ROCm needed on GB10).
  # Compose fragment: docker-compose.llamacpp-spark.yml
  llamacpp_spark:
    env_var: LLAMACPP_SPARK_URL       # Override URL; no API key needed
    key_pattern: ".*"
    api_base: "http://llamacpp-spark:8080/v1"
    tz_type: openai
    tier: llm
    integration_type: openai_compatible
    model_discovery_method: openai_models_endpoint
    hardware_requirements:
      min_vram_gb: 16
      architectures: [arm64, x86_64]
      notes: "Pure CPU+GPU inference; no CUDA kernel compilation needed for basic GGUF"
    profile_activation_rules:
      - dgx-spark-grace-blackwell
      - dgx-spark-a100-80gb
      - laptop-4090                   # Can run smaller models locally
    models:
      llamacpp_spark_qwen3_coder_32b_q4:
        model_name: "qwen2.5-coder-32b-instruct-Q4_K_M.gguf"
        tz_model_key: llamacpp_spark_qwen3_coder_32b_q4
        status: planned
        serves:
          - function: coding
            variant_name: llamacpp_spark_qwen3_coder_32b_q4
            role: secondary
            weight: 0.0
        strength_ref: null
        vram_mb: 19000                 # Q4_K_M quantization
        source: unsloth_export          # Produced by Unsloth fine-tune pipeline
      llamacpp_spark_gemma4_31b_q4:
        model_name: "gemma-4-31b-it-Q4_K_M.gguf"
        tz_model_key: llamacpp_spark_gemma4_31b_q4
        status: planned
        serves:
          - function: multimodal_large
            variant_name: llamacpp_spark_gemma4_31b_q4
            role: secondary
            weight: 0.0
          - function: agent_zero
            variant_name: llamacpp_spark_gemma4_31b_q4
            role: secondary
            weight: 0.0
        strength_ref: null
        vram_mb: 18000                 # Q4_K_M quantization
        multimodal: true
        input_modalities: ["text", "image"]
      llamacpp_spark_unsloth_custom:
        model_name: "unsloth-finetuned-Q4_K_M.gguf"
        tz_model_key: llamacpp_spark_unsloth_custom
        status: planned
        serves:
          - function: coding
            variant_name: llamacpp_spark_unsloth_custom
            role: secondary
            weight: 0.0
        strength_ref: null
        vram_mb: 0                     # Dynamic — depends on base model + LoRA merge
        source: unsloth_export
        notes: "Placeholder entry — actual model_name populated after Unsloth export"
```

### 2.4 Unsloth Provider Entry

```yaml
  # ---------------------------------------------------------------------------
  # unsloth_spark — Local fine-tuning and inference via Python import
  # ---------------------------------------------------------------------------
  # NOT an HTTP server. Integration type: local_inference.
  # Primary use: fine-tune models → export GGUF → hand off to llamacpp_spark.
  # Secondary use (Phase D): direct inference via thin FastAPI wrapper.
  # No api_base, no env_var for API key — uses model_path on local filesystem.
  # See Section 4 for architecture details.
  unsloth_spark:
    env_var: UNSLOTH_SPARK_MODEL_DIR  # Directory containing exported models
    key_pattern: null                   # No API key
    api_base: null                      # No HTTP endpoint (Phase C)
    tz_type: null                       # Not a TZ provider directly
    tier: llm
    integration_type: local_inference
    model_discovery_method: python_import
    hardware_requirements:
      min_vram_gb: 32                   # Training needs more than inference
      preferred_gpu_count: 1            # Unsloth is single-GPU optimized
      architectures: [arm64, x86_64]
      notes: "Triton kernel support on ARM64 limited — may fall back to PyTorch eager"
    profile_activation_rules:
      - dgx-spark-grace-blackwell
      - dgx-spark-a100-80gb
    unsloth_config:
      export_format: gguf              # Always export to GGUF for Llama.cpp consumption
      export_quantization: Q4_K_M      # Default quantization for exported GGUF
      lora_r: 16                        # Default LoRA rank
      lora_alpha: 16
      max_seq_length: 4096              # Default context window for training
      model_cache_dir: "/models/unsloth_cache"
      export_dir: "/models/unsloth_exports"
      auto_register_in_llamacpp: true   # After export, notify llamacpp_spark to reload
    models:
      unsloth_spark_qwen3_coder_lora:
        model_name: "unsloth/Qwen2.5-Coder-32B-Instruct-bf16"
        tz_model_key: null               # Not directly routable through TZ
        status: planned
        serves: []                        # Unsloth does NOT serve — it exports
        strength_ref: null
        vram_mb: 65000                 # BF16 base model in memory during training
        unsloth_config:
          base_model: "unsloth/Qwen2.5-Coder-32B-Instruct-bf16"
          task: finetune
          export_target: llamacpp_spark_qwen3_coder_32b_q4
      unsloth_spark_gemma4_31b_lora:
        model_name: "unsloth/gemma-4-31b-it-bf16"
        tz_model_key: null
        status: planned
        serves: []
        strength_ref: null
        vram_mb: 62000                 # FP16 base model
        unsloth_config:
          base_model: "unsloth/gemma-4-31b-it-bf16"
          task: finetune
          export_target: llamacpp_spark_gemma4_31b_q4
```

---

## 3. Model Auto-Discovery

### 3.1 Discovery Flow (OpenAI-Compatible Providers)

For `vllm_spark` and `llamacpp_spark`, model discovery uses the standard `/v1/models` endpoint:

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│ Health Check │────▶│ GET /v1/models│────▶│ Match Catalog │────▶│ Register in TZ│
│ (circuit brk) │     │ (list models) │     │ (basename)    │     │ (variants)   │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
     │ FAIL                │ FAIL               │ NO MATCH            │
     ▼                    ▼                    ▼                    ▼
  Skip provider      Skip provider       Log unknown model     Activate variant
  (circuit open)     (circuit open)      (no action)           (weight > 0.0)
```

### 3.2 Implementation Pseudocode

```python
async def discover_openai_compatible_models(
    provider_slug: str,
    api_base: str,
    catalog_models: dict[str, CatalogModel],
    health_timeout: float = 5.0,
) -> list[DiscoveredModel]:
    """
    Discover models from an OpenAI-compatible provider.
    Applies circuit breaker: if health check fails, skip entirely.
    """
    # Step 1: Health check (circuit breaker)
    if not await check_service_health(provider_slug, timeout=health_timeout):
        logger.info("Provider %s unhealthy, skipping discovery", provider_slug)
        return []

    # Step 2: Fetch model list
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{api_base}/models")
        if resp.status_code != 200:
            return []
        remote_models = resp.json().get("data", [])

    # Step 3: Match against catalog by basename
    discovered = []
    for remote in remote_models:
        remote_basename = os.path.basename(remote["id"])
        for slug, catalog_entry in catalog_models.items():
            catalog_basename = os.path.basename(catalog_entry.model_name)
            if remote_basename == catalog_basename or remote["id"] == catalog_entry.model_name:
                discovered.append(DiscoveredModel(
                    provider_slug=provider_slug,
                    catalog_slug=slug,
                    remote_model_id=remote["id"],
                    tz_model_key=catalog_entry.tz_model_key,
                    serves=catalog_entry.serves,
                ))
                break

    # Step 4: Log unmatched models (informational, no action)
    matched_ids = {d.remote_model_id for d in discovered}
    for remote in remote_models:
        if remote["id"] not in matched_ids:
            logger.info(
                "Unknown model %s on provider %s — not in catalog",
                remote["id"], provider_slug,
            )

    return discovered
```

### 3.3 Unsloth Discovery (Filesystem)

```python
def discover_unsloth_models(export_dir: str) -> list[str]:
    """
    Scan Unsloth export directory for GGUF files.
    Returns list of absolute paths to .gguf files.
    """
    if not os.path.isdir(export_dir):
        return []
    return [
        os.path.join(export_dir, f)
        for f in os.listdir(export_dir)
        if f.endswith(".gguf")
    ]
```

After discovery, Unsloth exported models are matched against `llamacpp_spark` catalog entries by basename. If a match is found, the Llama.cpp server is notified to load the new model (hot-reload or restart).

---

## 4. Unsloth Integration Architecture

### 4.1 Why Unsloth Cannot Follow the HTTP Pattern

| Aspect | vLLM / Llama.cpp | Unsloth |
|--------|-------------------|---------|
| Runtime | Long-running server process | Ephemeral training script |
| Interface | HTTP API (OpenAI-compatible) | Python function calls |
| Memory model | Load once, serve many | Load → train → unload → export |
| Concurrency | Multi-request serving | Single training job |
| Output | Completions in real-time | GGUF file on disk |

### 4.2 Bridge Pattern (Phase C — Primary)

```
┌──────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Training     │     │  Export       │     │  Llama.cpp    │     │  TZ Cascade  │
│  Data (JSONL) │────▶│  GGUF        │────▶│  /v1/chat     │────▶│  Standard    │
│               │     │  (Q4_K_M)    │     │  completions  │     │  routing     │
└──────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
       Unsloth              Unsloth             llamacpp_spark        provider_catalog
```

**Flow**:
1. Operator runs Unsloth training script with dataset and base model
2. Unsloth fine-tunes, merges LoRA into base model, exports to GGUF at configured quantization
3. Exported `.gguf` lands in `/models/unsloth_exports/`
4. Discovery scan detects new GGUF, matches basename to `llamacpp_spark` catalog entry
5. Llama.cpp server loads the new model (hot-reload if supported, else container restart)
6. Model is now available through the standard OpenAI-compatible path — no special handling in TZ

**This means Unsloth never appears in the serving cascade directly.** It is a *build-time* tool, not a *runtime* provider.

### 4.3 Direct Inference Wrapper (Phase D — Conditional)

If direct Unsloth inference is needed (e.g., for single-turn evaluation without GGUF export), a thin FastAPI wrapper can expose an OpenAI-compatible endpoint:

```python
# unsloth_wrapper.py — Phase D only
from fastapi import FastAPI
from unsloth import FastLanguageModel

app = FastAPI()
model, tokenizer = None, None

@app.on_event("startup")
async def load_model():
    global model, tokenizer
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=os.getenv("UNSLOTH_MODEL_PATH"),
        max_seq_length=4096,
        dtype=None,  # Auto-detect
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)

@app.post("/v1/chat/completions")
async def chat_completions(request: dict):
    # Translate OpenAI request format → Unsloth generate()
    # This is a last-resort path — GGUF export is preferred
    ...
```

**Phase D is explicitly conditional** — only implement if the GGUF bridge proves insufficient for a specific use case (e.g., real-time LoRA switching without re-export).

---

## 5. Docker Compose Fragments

### 5.1 vLLM Service Fragment

```yaml
# docker-compose.vllm-spark.yml
# Include via: docker compose -f docker-compose.yml -f docker-compose.vllm-spark.yml up vllm-spark

services:
  vllm-spark:
    image: vllm/vllm-openai:latest    # Use :latest-arm64 for GB10 if available
    container_name: vllm-spark
    restart: unless-stopped
    ports:
      - "${VLLM_SPARK_PORT:-8000}:8000"
    environment:
      - VLLM_WORKER_MULTIPROC_METHOD=spawn
      - VLLM_ATTENTION_BACKEND=FLASHINFER   # Optimal for Ampere+; fallback: FLASH_ATTN
      - VLLM_TENSOR_PARALLEL_SIZE=${VLLM_TP_SIZE:-1}  # 1 for GB10, 8 for 8×A100
      - VLLM_GPU_MEMORY_UTILIZATION=0.90
      - VLLM_MAX_MODEL_LEN=8192
      - VLLM_PORT=8000
      - CUDA_VISIBLE_DEVICES=${VLLM_CUDA_DEVICES:-0}
    volumes:
      - ${MODEL_CACHE_DIR:-/models}:/models:ro       # Read-only model cache
      - vllm-cache:/root/.cache/huggingface         # HF download cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: ${VLLM_GPU_COUNT:-1}
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s            # Large models take time to load
    networks:
      - pmoves-net
    profiles:
      - spark-inference             # Only start with --profile spark-inference

volumes:
  vllm-cache:
    driver: local
```

**GB10 ARM64 Note**: If `vllm/vllm-openai:latest-arm64` is not available, build from source:

```dockerfile
# Dockerfile.vllm-arm64 (fallback for GB10)
FROM python:3.11-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git cmake
RUN pip install vllm --no-build-isolation
EXPOSE 8000
CMD ["vllm", "serve", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.2 Llama.cpp Service Fragment

```yaml
# docker-compose.llamacpp-spark.yml
# Include via: docker compose -f docker-compose.yml -f docker-compose.llamacpp-spark.yml up llamacpp-spark

services:
  llamacpp-spark:
    image: ghcr.io/ggerganov/llama.cpp:server
    container_name: llamacpp-spark
    restart: unless-stopped
    ports:
      - "${LLAMACPP_SPARK_PORT:-8080}:8080"
    environment:
      - LLAMA_ARG_HOST=0.0.0.0
      - LLAMA_ARG_PORT=8080
      - LLAMA_ARG_CTX_SIZE=4096
      - LLAMA_ARG_N_PARALLEL=${LLAMACPP_PARALLEL:-4}
      - LLAMA_ARG_N_BATCH=512
      - LLAMA_ARG_FLASH_ATTN=true
      - LLAMA_ARG_GPU_LAYERS=${LLAMACPP_GPU_LAYERS:-99}  # 99 = offload all to GPU
      - CUDA_VISIBLE_DEVICES=${LLAMACPP_CUDA_DEVICES:-0}
    volumes:
      - ${MODEL_CACHE_DIR:-/models}:/models:ro
      - ${UNSLOTH_EXPORT_DIR:-/models/unsloth_exports}:/unsloth-exports:ro
    command: >
      -m /models/${LLAMACPP_MODEL:-qwen2.5-coder-32b-instruct-Q4_K_M.gguf}
      --cont-batching
      --metrics
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 60s
    networks:
      - pmoves-net
    profiles:
      - spark-inference
```

**Multi-Model Note**: Llama.cpp serves one model per container instance. For concurrent model availability, run multiple instances on different ports:

```yaml
  llamacpp-spark-coding:
 <<: *llamacpp-base
    ports: ["8080:8080"]
    command: -m /models/qwen2.5-coder-32b-instruct-Q4_K_M.gguf --cont-batching

  llamacpp-spark-multimodal:
 <<: *llamacpp-base
    ports: ["8081:8080"]
    command: -m /models/gemma-4-31b-it-Q4_K_M.gguf --cont-batching --mmproj /models/gemma4-mmproj.gguf
```

---

## 6. Hardware Profile Updates

### 6.1 Changes to `dgx-spark-grace-blackwell.yaml`

```yaml
# === APPEND TO EXISTING profile ===

services:
  - mesh-agent
  - fleet-agent
  - ollama
  - vllm-spark                    # NEW — high-throughput inference
  - llamacpp-spark                 # NEW — GGUF inference + Unsloth export consumer

compose_overrides:
  - docker-compose.arm64.override.yml
  - docker-compose.vllm-spark.yml  # NEW
  - docker-compose.llamacpp-spark.yml  # NEW

# === APPEND TO cross_node.peers ON OTHER NODES ===
# Example: laptop-4090.yaml cross_node.peers.pmoves-spark.services
# Already has:
#   - ollama:11434
#   - nim:8200
# Add:
#   - vllm-spark:8000
#   - llamacpp-spark:8080

notes:
  - "vLLM on GB10 requires ARM64 image or source build (see Risk R1)."
  - "Llama.cpp on GB10 uses CUDA-on-ARM — native ARM64 support in upstream."
  - "Unsloth training jobs should run when no other GPU inference is active (serial, not concurrent)."
  - "Port allocation: Ollama=11434, vLLM=8000, Llama.cpp=8080 — no conflicts."
```

### 6.2 Hypothetical 8×A100 Profile Sketch

```yaml
# pmoves/config/profiles/dgx-spark-a100-80gb.yaml
id: dgx-spark-a100-80gb
name: "NVIDIA DGX Spark (8×A100 80GB NVLink)"
description: >
  8× NVIDIA A100 80GB GPUs connected via NVLink (600 GB/s bidirectional).
  x86_64 architecture. 640 GB total VRAM enables tensor-parallel serving of
  70B+ models at FP16 without quantization. Primary target for vLLM with
  tensor-parallel=8.
hardware:
  cpu:
    vendor: AMD
    model: "EPYC 7763 (64-core)"
    cores: 64
    threads: 128
    arch: x86_64
  gpu:
    type: nvidia-ampere
    models: ["8× A100 80GB"]
    memory_gb: 640               # 8 × 80 GB
    compute_capability: "8.0"
    cuda_version: "12.4"
    nvlink: true
    nvlink_bandwidth_gb: 600
  ram_gb: 512
  storage: "NVMe SSD RAID"
  tags: [workstation, dgx, x86_64, ampere, nvlink, multi-gpu]

compose_overrides:
  - docker-compose.vllm-spark.yml
  - docker-compose.llamacpp-spark.yml

model_bundles:
  - vllm-llama3-70b-fp16-tp8      # Full precision, 140GB, ~100 tok/s
  - vllm-qwen3-coder-32b-bf16       # 32B at full precision
  - llamacpp-gemma4-31b-q4           # GGUF fallback
  - unsloth-finetuning-workspace     # Training environment

services:
  - vllm-spark                      # TP8 for large models
  - llamacpp-spark                   # GGUF for Unsloth exports
  - mesh-agent
  - fleet-agent

tailscale:
  role: gpu-node
  hostname_pattern: "pmoves-a100-spark"

notes:
  - "vLLM tensor-parallel=8 for 70B+ models at FP16 — no quantization needed."
  - "NVLink eliminates PCIe bottleneck — all-reduce at 600 GB/s."
  - "Unsloth training: use single GPU (lock 1×A100), others for serving."
  - "Standard x86_64 images — no ARM64 build issues."
```

---

## 7. Cascade Integration

### 7.1 Priority Ordering

When multiple local providers are available on the same node, the cascade should prefer:

```
vLLM (highest throughput, PagedAttention)
  └─▶ Llama.cpp (GGUF flexibility, Unsloth export consumer)
       └─▶ Ollama (established, lower throughput)
            └─▶ NVIDIA NIM (if present, optimized single-model)
                 └─▶ Cloud providers (fallback, always available)
```

### 7.2 Profile-Aware Routing Logic

```python
def resolve_provider_priority(
    active_profile: str,
    available_providers: list[str],
) -> list[str]:
    """
    Return ordered provider slugs based on active hardware profile.
    Providers not in available_providers are excluded (health check failed).
    """
    PRIORITY_MAP = {
        "dgx-spark-a100-80gb": [
            "vllm_spark",       # TP8 — primary for 70B+
            "llamacpp_spark",   # GGUF / Unsloth exports
            "ollama_spark",     # Established fallback
            "nvidia_nim",       # If NIM container present
        ],
        "dgx-spark-grace-blackwell": [
            "vllm_spark",       # If ARM64 image available
            "llamacpp_spark",   # GGUF — reliable on ARM64
            "ollama_spark",     # Established, proven on GB10
        ],
        "laptop-4090": [
            # vLLM unlikely on 16GB — skip
            "llamacpp_spark",   # Small GGUF models if remote
            # ollama_local is the laptop's own provider
        ],
    }

    preferred = PRIORITY_MAP.get(active_profile, [])
    return [p for p in preferred if p in available_providers]
```

### 7.3 Unsloth Exclusion

`unsloth_spark` is **explicitly excluded** from the serving cascade:

```python
SERVING_EXCLUDED = {"unsloth_spark"}  # Build-time only, never serves

available = [p for p in discovered if p not in SERVING_EXCLUDED]
```

Unsloth's value flows through `llamacpp_spark` after GGUF export. The cascade never routes requests to Unsloth directly.

---

## 8. Implementation Phases

### Phase A: vLLM Container + Catalog Entry (2-3 days)

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| Add `vllm_spark` to `provider_catalog.yaml` | YAML entry (§2.2) | Schema validates, no conflicts |
| Create `docker-compose.vllm-spark.yml` | Compose fragment (§5.1) | `docker compose config` passes |
| Add health check to cascade | `check_service_health("vllm-spark")` | Returns `False` when container stopped, `True` when running |
| Update `dgx-spark-grace-blackwell.yaml` | Profile diff (§6.1) | Services list includes `vllm-spark` |
| Test on GB10 | Container starts, loads model | `/v1/models` returns model list |

**Gate**: vLLM container healthy on GB10 with at least one model loaded. If ARM64 image unavailable, document build-from-source procedure and gate on that.

### Phase B: Llama.cpp Container + Auto-Discovery (3-4 days)

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| Add `llamacpp_spark` to `provider_catalog.yaml` | YAML entry (§2.3) | Schema validates |
| Create `docker-compose.llamacpp-spark.yml` | Compose fragment (§5.2) | `docker compose config` passes |
| Implement `discover_openai_compatible_models()` | Python function (§3.2) | Discovers models from `/v1/models`, matches catalog |
| Add Unsloth export directory mount | Volume in compose | `/unsloth-exports/` readable inside container |
| Test multi-model serving | Two container instances | Different models on :8080 and :8081, both discoverable |

**Gate**: Llama.cpp container healthy, auto-discovery finds loaded models, matches to catalog entries.

### Phase C: Unsloth Fine-Tuning Pipeline (5-7 days)

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| Add `unsloth_spark` to `provider_catalog.yaml` | YAML entry (§2.4) | Schema validates, `integration_type: local_inference` recognized |
| Create Unsloth training script | `unsloth_train.py` | Fine-tunes Qwen2.5-Coder-32B on sample dataset |
| Implement GGUF export | Export function | Produces valid `.gguf` file in export directory |
| Implement filesystem discovery | `discover_unsloth_models()` (§3.3) | Finds exported GGUF files |
| Implement bridge: export → Llama.cpp reload | Notification mechanism | After export, Llama.cpp loads new model within 60s |
| Test end-to-end | Train → export → serve → query | Completion returns sensible output |

**Gate**: Full pipeline works — train on dataset, export GGUF, Llama.cpp serves it, TZ routes to it.

### Phase D: Unsloth Direct Inference Wrapper (4-5 days, conditional)

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| Implement FastAPI wrapper | `unsloth_wrapper.py` (§4.3) | `/v1/chat/completions` returns completions |
| Add as optional compose service | `docker-compose.unsloth-wrapper.yml` | Container starts, loads model, serves |
| Update `unsloth_spark` catalog entry | Add `api_base` conditionally | When wrapper running, discoverable as OpenAI-compatible |

**Gate**: Only start Phase D if Phase C bridge proves insufficient for a documented use case. Default: skip.

---

## 9. Risks & Mitigations

### R1: vLLM ARM64 Image Availability

**Risk**: `vllm/vllm-openai` may not publish ARM64 images for GB10's aarch64-linux platform.

**Mitigation**:
- Check `ghcr.io/vllm-project/vllm-openai` for arm64 tags first
- Fallback: build from source (Dockerfile provided in §5.1)
- Fallback: use Llama.cpp instead of vLLM on GB10 — it has native ARM64 support
- Circuit breaker: if vLLM container fails to start, cascade skips to `llamacpp_spark`

### R2: NVLink vs Unified Memory Differences

**Risk**: The spec covers two different SPARK configurations (GB10 unified vs 8×A100 NVLink) with different memory models. Code that assumes one will break on the other.

**Mitigation**:
- `hardware_requirements` in catalog entries are declarative — cascade reads them, doesn't hardcode
- `VLLM_TENSOR_PARALLEL_SIZE` is env-configurable (1 for GB10, 8 for A100)
- Profile activation rules keep the two configurations separate
- `vram_mb` in catalog entries is per-model, not per-node — cascade sums if needed

### R3: Unsloth Triton on ARM64

**Risk**: Unsloth relies on Triton kernels for speed. Triton has limited ARM64 support.

**Mitigation**:
- Unsloth falls back to PyTorch eager mode without Triton — slower but functional
- Training on GB10 will be slower than on A100 — acceptable for fine-tuning (not latency-critical)
- If Triton is completely unavailable, Phase C still works — just slower
- Monitor `unsloth` ARM64 issue tracker for native support

### R4: Concurrent GPU Memory Contention

**Risk**: Running vLLM + Llama.cpp + Ollama + Unsloth simultaneously on the same GPU will OOM.

**Mitigation**:
- **Never run all simultaneously.** Use Docker Compose profiles to activate selectively
- Unsloth training is a batch job — stop serving containers during training
- vLLM and Llama.cpp serve different models — run one or the other, not both
- GPU orchestrator (existing `gpu-orchestrator` service) manages VRAM allocation
- `CUDA_VISIBLE_DEVICES` per container isolates GPU access when multiple GPUs available

### R5: Port Conflicts

**Risk**: New services may conflict with existing ports.

**Assessment**: No conflicts.

| Service | Port | Existing on SPARK |
|---------|------|-------------------|
| Ollama | 11434 | ✓ (ollama_spark) |
| vLLM | 8000 | ✗ (NIM uses 8200) |
| Llama.cpp | 8080 | ✗ |
| Unsloth wrapper | 8090 (Phase D) | ✗ |

---

## Appendix A: New Schema Field Reference

| Field | Applies To | Values | Default |
|-------|-----------|--------|---------|
| `integration_type` | All providers | `openai_compatible`, `local_inference`, `native_tz` | `openai_compatible` (implicit for existing) |
| `model_discovery_method` | All providers | `openai_models_endpoint`, `python_import`, `static`, `none` | `static` (existing entries have fixed model lists) |
| `hardware_requirements` | Hardware-routed only | `{min_vram_gb, preferred_gpu_count, compute_capability, architectures, notes}` | — |
| `profile_activation_rules` | Hardware-routed only | `list[str]` of profile IDs | — |
| `unsloth_config` | Unsloth only | `{export_format, export_quantization, lora_r, lora_alpha, max_seq_length, model_cache_dir, export_dir, auto_register_in_llamacpp}` | — |
| `source` | Model entries | `unsloth_export` or omitted | Omitted |
| `status` | Model entries | `planned`, `staging`, `soak`, `active`, `deprecated` | Omitted (implicit `active`) |

## Appendix B: Port Allocation

```
8000  vLLM Spark (HTTP + OpenAI API)
8080  Llama.cpp Spark — primary model (coding)
8081  Llama.cpp Spark — secondary model (multimodal)
8090  Unsloth wrapper (Phase D only, conditional)
8200  NVIDIA NIM (existing)
11434 Ollama (existing)
```

## Appendix C: File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `pmoves/config/provider_catalog.yaml` | Add 3 provider entries | A, B, C |
| `docker-compose.vllm-spark.yml` | Create | A |
| `docker-compose.llamacpp-spark.yml` | Create | B |
| `pmoves/config/profiles/dgx-spark-grace-blackwell.yaml` | Add services, compose_overrides, notes | A, B |
| `pmoves/config/profiles/dgx-spark-a100-80gb.yaml` | Create (new profile) | A |
| `pmoves/config/profiles/laptop-4090.yaml` | Add cross_node peer services | B |
| `PMOVES-ToKenism-Multi/pmoves_registry/` | Add discovery functions | B |
| `unsloth_train.py` (new) | Create training script | C |
| `unsloth_bridge.py` (new) | Create export→reload bridge | C |
| `docker-compose.unsloth-wrapper.yml` (new) | Create (conditional) | D |
| `unsloth_wrapper.py` (new) | Create FastAPI wrapper (conditional) | D |
| `pmoves/tensorzero/config/tensorzero.toml` | Add variant blocks for new models | A, B |
