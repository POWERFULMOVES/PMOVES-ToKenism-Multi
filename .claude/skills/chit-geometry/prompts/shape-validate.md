# Recipe: CHIT Shape Validation

## Overview
Validate Geometry Packets (CGPs) using MACA consensus.

## Workflow

### 1. Normalize Input Geometry
Convert raw data to standardized coordinate system:
- Audio waveforms → Spectral manifold
- 3D meshes → Topological invariants
- Time series → Phase space embedding

### 2. Extract Shape Attributes
Analyze geometry for:
- Symmetry properties
- Genus (holes/handles)
- Spectral density
- Curvature metrics

### 3. Build Composite Constellation
Merge multiple shapes into relationship graph:
- Intersection: Common features
- Union: Combined attributes
- Transformation: Morphological changes

### 4. MACA Consensus
Multi-Agent Consensus Alignment:
1. Send shape to multiple validator agents
2. Collect shape transformations as "arguments"
3. Calculate entropy reduction: ΔS = S_initial - S_final
4. Accept shape if ΔS > threshold

### 5. Visualize Result
Render via Three.js sprayplate:
- Cymatic patterns for audio
- Mesh visualization for 3D
- Phase portraits for time series

## Constraints
- Shape operations require geometric validity
- MACA needs minimum 3 validator perspectives
- Entropy threshold depends on domain context
