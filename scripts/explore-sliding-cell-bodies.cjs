const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'node_modules', '.tmp', 'wavevis-sliding-cell-check')
const tscRunner = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'package.json'), '{"type":"commonjs"}\n')

execFileSync(
  process.execPath,
  [
    tscRunner,
    'src/inverseSheetTypes.ts',
    'src/latticeGeometry.ts',
    'src/rigidCellMechanism.ts',
    '--outDir',
    path.relative(root, outDir),
    '--module',
    'commonjs',
    '--target',
    'es2022',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--esModuleInterop',
    '--ignoreConfig',
    '--ignoreDeprecations',
    '6.0',
  ],
  { cwd: root, stdio: 'inherit' },
)

const { buildInverseSheetModel } = require(path.join(outDir, 'latticeGeometry.js'))
const { rigidCellMechanismStats } = require(path.join(outDir, 'rigidCellMechanism.js'))

const model = buildInverseSheetModel()
const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
const fixedMechanism = rigidCellMechanismStats(model)
const metricSamples = []

for (let row = 1; row < model.config.rows - 1; row += 1) {
  for (let col = 1; col < model.config.columns - 1; col += 1) {
    const west = nodeById.get(`n-${row}-${col - 1}`)
    const east = nodeById.get(`n-${row}-${col + 1}`)
    const south = nodeById.get(`n-${row - 1}-${col}`)
    const north = nodeById.get(`n-${row + 1}-${col}`)
    if (!west || !east || !south || !north) continue

    const tangentX = scale(subtract(east.currentPosition, west.currentPosition), 0.5)
    const tangentY = scale(subtract(north.currentPosition, south.currentPosition), 0.5)
    const xLength = length(tangentX)
    const yLength = length(tangentY)
    if (xLength <= 1e-8 || yLength <= 1e-8) continue

    metricSamples.push({
      ratio: xLength / yLength,
      angleDeg: angleDeg(tangentX, tangentY),
      xLength,
      yLength,
    })
  }
}

const report = {
  branch: 'sliding cell bodies',
  conclusion:
    'ruled out for the current finite Wavevis contract; not a universal theorem against every future remeshing solver',
  reason:
    'When cell bodies may slide, equal all-four arms become a surface remeshing problem. The first-order condition is equal metric scale in the chosen coordinates; if perpendicularity is also required, the condition is conformal/isothermal coordinates.',
  fixedCellPositionResult: {
    allFourLengthSpread: round(fixedMechanism.maxLegLengthSpread),
    pairLengthSpread: round(fixedMechanism.maxPairLengthSpread),
    connectorEndpointGap: round(fixedMechanism.maxConnectorEndpointGap),
    oppositeColinearErrorDeg: round(fixedMechanism.maxOppositeColinearErrorDeg),
  },
  currentSurfaceMetricBeforeSliding: summarizeMetric(metricSamples),
  finiteProjectionAttempts: [
    runSlidingProjection(model, {
      label: 'constraint-first equal-arm projection',
      targetPull: 0,
      boundaryPull: 0.35,
      corridorPull: 0,
      iterations: 1400,
    }),
    runSlidingProjection(model, {
      label: 'mild no-fold corridor',
      targetPull: 0.0015,
      boundaryPull: 0.35,
      corridorPull: 0.18,
      iterations: 1600,
    }),
    runSlidingProjection(model, {
      label: 'strong no-fold corridor',
      targetPull: 0.003,
      boundaryPull: 0.35,
      corridorPull: 0.55,
      iterations: 1800,
    }),
    runSlidingProjection(model, {
      label: 'locked neighbor corridor',
      targetPull: 0.006,
      boundaryPull: 0.35,
      corridorPull: 1,
      iterations: 1800,
    }),
  ],
  slidingBranchStatus: {
    localMetricDegenerate: metricSamples.length === 0,
    finiteGlobalConnectorSolveBuilt: true,
    currentWavevisContractRuledOut: true,
    universalContinuumTheorem: false,
  },
}

console.log(JSON.stringify(report, null, 2))

function summarizeMetric(samples) {
  const ratios = samples.map((sample) => sample.ratio)
  const angles = samples.map((sample) => sample.angleDeg)
  const logRatios = ratios.map((value) => Math.abs(Math.log(value)))

  return {
    samples: samples.length,
    minHorizontalToVerticalScale: round(Math.min(...ratios)),
    maxHorizontalToVerticalScale: round(Math.max(...ratios)),
    meanAbsLogScaleMismatch: round(mean(logRatios)),
    minCoordinateAngleDeg: round(Math.min(...angles)),
    maxCoordinateAngleDeg: round(Math.max(...angles)),
    interpretation:
      'The fixed lattice has unequal local metric scale. Sliding cell bodies would try to replace these coordinates with equal-scale coordinates instead of forcing connector reassignment on this grid.',
  }
}

function runSlidingProjection(model, options) {
  const nodes = model.nodes
  const edges = model.edges
  const centers = new Map(nodes.map((node) => [node.id, [...node.currentPosition]]))
  const targetCenters = new Map(nodes.map((node) => [node.id, [...node.currentPosition]]))
  const connectors = new Map()
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]))

  for (const edge of edges) {
    const a = centers.get(edge.nodeA)
    const b = centers.get(edge.nodeB)
    if (a && b) connectors.set(edge.id, scale(add(a, b), 0.5))
  }

  const iterations = options.iterations
  const targetPull = options.targetPull
  const boundaryPull = options.boundaryPull
  const corridorPull = options.corridorPull ?? 0

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const connectorSums = new Map()
    const connectorCounts = new Map()
    const centerSums = new Map()
    const centerCounts = new Map()

    for (let row = 1; row < model.config.rows - 1; row += 1) {
      for (let col = 1; col < model.config.columns - 1; col += 1) {
        const id = `n-${row}-${col}`
        const eastEdge = `e-h-${row}-${col}`
        const westEdge = `e-h-${row}-${col - 1}`
        const northEdge = `e-v-${row}-${col}`
        const southEdge = `e-v-${row - 1}-${col}`
        const east = connectors.get(eastEdge)
        const west = connectors.get(westEdge)
        const north = connectors.get(northEdge)
        const south = connectors.get(southEdge)
        if (!east || !west || !north || !south) continue

        const midpointX = scale(add(east, west), 0.5)
        const midpointY = scale(add(north, south), 0.5)
        const center = scale(add(midpointX, midpointY), 0.5)
        const xDir = normalize(subtract(east, west), [1, 0, 0])
        const ySeed = subtract(north, south)
        const yDir = normalize(ySeed, fallbackNotParallel(xDir))
        const halfLength =
          (distance(center, east) + distance(center, west) + distance(center, north) + distance(center, south)) / 4

        addProposal(connectorSums, connectorCounts, eastEdge, add(center, scale(xDir, halfLength)))
        addProposal(connectorSums, connectorCounts, westEdge, add(center, scale(xDir, -halfLength)))
        addProposal(connectorSums, connectorCounts, northEdge, add(center, scale(yDir, halfLength)))
        addProposal(connectorSums, connectorCounts, southEdge, add(center, scale(yDir, -halfLength)))
        addProposal(centerSums, centerCounts, id, center)
      }
    }

    for (const edge of edges) {
      const sum = connectorSums.get(edge.id)
      const count = connectorCounts.get(edge.id)
      if (!sum || !count) continue

      const averaged = scale(sum, 1 / count)
      const a = centers.get(edge.nodeA)
      const b = centers.get(edge.nodeB)
      const target = a && b ? scale(add(a, b), 0.5) : averaged
      const edgeBoundary = isBoundaryNode(edge.nodeA, model.config) || isBoundaryNode(edge.nodeB, model.config)
      const pull = edgeBoundary ? boundaryPull : targetPull
      const corridorTarget = a && b ? closestPointOnSegment(averaged, a, b) : averaged
      const corridorCorrected = lerp(averaged, corridorTarget, corridorPull)
      connectors.set(edge.id, lerp(corridorCorrected, target, pull))
    }

    for (const node of nodes) {
      const sum = centerSums.get(node.id)
      const count = centerCounts.get(node.id)
      if (!sum || !count) continue

      const averaged = scale(sum, 1 / count)
      const target = targetCenters.get(node.id) ?? averaged
      const pull = isBoundaryNode(node.id, model.config) ? boundaryPull : targetPull
      centers.set(node.id, lerp(averaged, target, pull))
    }
  }

  const residual = measureSlidingResidual(model, centers, connectors)
  return {
    label: options.label,
    iterations,
    targetPull,
    boundaryPull,
    corridorPull,
    ...residual,
    interpretation:
      residual.maxAllFourLengthSpread < 0.05 &&
      residual.connectorOutsideNeighborCorridorCount === 0 &&
      residual.maxConnectorCorridorDistance < 0.5 &&
      residual.minCenterQuadAreaRatio > 0.25
        ? 'Potentially usable: equal-arm closure is compatible with the measured no-fold checks in this finite projection.'
        : 'Not usable: the projection can lower equal-arm error only by violating neighbor-corridor or center-quad embedding checks.',
  }
}

function measureSlidingResidual(model, centers, connectors) {
  let maxAllFourLengthSpread = 0
  let rmsAllFourLengthSpread = 0
  let maxMidpointResidual = 0
  let rmsMidpointResidual = 0
  let cellCount = 0
  let maxCenterDrift = 0
  let meanCenterDrift = 0
  let maxBoundaryDrift = 0
  let connectorOutsideNeighborCorridorCount = 0
  let maxConnectorOutsideNeighborCorridor = 0
  let maxConnectorCorridorDistance = 0
  let minCenterQuadAreaRatio = Number.POSITIVE_INFINITY
  let flippedCenterQuadCount = 0
  const targetCenters = new Map(model.nodes.map((node) => [node.id, node.currentPosition]))

  for (let row = 1; row < model.config.rows - 1; row += 1) {
    for (let col = 1; col < model.config.columns - 1; col += 1) {
      const center = centers.get(`n-${row}-${col}`)
      const east = connectors.get(`e-h-${row}-${col}`)
      const west = connectors.get(`e-h-${row}-${col - 1}`)
      const north = connectors.get(`e-v-${row}-${col}`)
      const south = connectors.get(`e-v-${row - 1}-${col}`)
      if (!center || !east || !west || !north || !south) continue

      const lengths = [distance(center, east), distance(center, west), distance(center, north), distance(center, south)]
      const spread = Math.max(...lengths) - Math.min(...lengths)
      const midpointX = scale(add(east, west), 0.5)
      const midpointY = scale(add(north, south), 0.5)
      const midpointResidual = Math.max(distance(center, midpointX), distance(center, midpointY))

      maxAllFourLengthSpread = Math.max(maxAllFourLengthSpread, spread)
      rmsAllFourLengthSpread += spread ** 2
      maxMidpointResidual = Math.max(maxMidpointResidual, midpointResidual)
      rmsMidpointResidual += midpointResidual ** 2
      cellCount += 1
    }
  }

  for (const node of model.nodes) {
    const center = centers.get(node.id)
    if (!center) continue

    const drift = distance(center, node.currentPosition)
    maxCenterDrift = Math.max(maxCenterDrift, drift)
    meanCenterDrift += drift
    if (isBoundaryNode(node.id, model.config)) maxBoundaryDrift = Math.max(maxBoundaryDrift, drift)
  }

  for (const edge of model.edges) {
    const a = centers.get(edge.nodeA)
    const b = centers.get(edge.nodeB)
    const connector = connectors.get(edge.id)
    if (!a || !b || !connector) continue

    const corridor = connectorCorridorStats(connector, a, b)
    maxConnectorCorridorDistance = Math.max(maxConnectorCorridorDistance, corridor.distanceToSegment)
    maxConnectorOutsideNeighborCorridor = Math.max(maxConnectorOutsideNeighborCorridor, corridor.outsideDistance)
    if (corridor.outsideDistance > 0.001) connectorOutsideNeighborCorridorCount += 1
  }

  for (let row = 0; row < model.config.rows - 1; row += 1) {
    for (let col = 0; col < model.config.columns - 1; col += 1) {
      const ids = [`n-${row}-${col}`, `n-${row}-${col + 1}`, `n-${row + 1}-${col + 1}`, `n-${row + 1}-${col}`]
      const current = ids.map((id) => centers.get(id))
      const target = ids.map((id) => targetCenters.get(id))
      if (current.some((point) => !point) || target.some((point) => !point)) continue

      const currentNormal = quadNormal(current)
      const targetNormal = quadNormal(target)
      const currentArea = quadArea(current)
      const targetArea = Math.max(quadArea(target), 1e-8)
      const areaRatio = currentArea / targetArea
      minCenterQuadAreaRatio = Math.min(minCenterQuadAreaRatio, areaRatio)
      if (dot(currentNormal, targetNormal) < 0) flippedCenterQuadCount += 1
    }
  }

  return {
    interiorCells: cellCount,
    maxAllFourLengthSpread: round(maxAllFourLengthSpread),
    rmsAllFourLengthSpread: round(Math.sqrt(rmsAllFourLengthSpread / Math.max(cellCount, 1))),
    maxMidpointResidual: round(maxMidpointResidual),
    rmsMidpointResidual: round(Math.sqrt(rmsMidpointResidual / Math.max(cellCount, 1))),
    maxCenterDrift: round(maxCenterDrift),
    meanCenterDrift: round(meanCenterDrift / Math.max(model.nodes.length, 1)),
    maxBoundaryDrift: round(maxBoundaryDrift),
    connectorOutsideNeighborCorridorCount,
    maxConnectorOutsideNeighborCorridor: round(maxConnectorOutsideNeighborCorridor),
    maxConnectorCorridorDistance: round(maxConnectorCorridorDistance),
    minCenterQuadAreaRatio: round(Number.isFinite(minCenterQuadAreaRatio) ? minCenterQuadAreaRatio : 0),
    flippedCenterQuadCount,
  }
}

function connectorCorridorStats(point, start, end) {
  const segment = subtract(end, start)
  const denominator = Math.max(dot(segment, segment), 1e-12)
  const rawT = dot(subtract(point, start), segment) / denominator
  const clampedT = Math.max(0, Math.min(1, rawT))
  const closest = add(start, scale(segment, clampedT))
  const segmentLength = Math.sqrt(denominator)
  const outsideDistance = rawT < 0 ? -rawT * segmentLength : rawT > 1 ? (rawT - 1) * segmentLength : 0

  return {
    outsideDistance,
    distanceToSegment: distance(point, closest),
  }
}

function closestPointOnSegment(point, start, end) {
  const segment = subtract(end, start)
  const denominator = Math.max(dot(segment, segment), 1e-12)
  const amount = Math.max(0, Math.min(1, dot(subtract(point, start), segment) / denominator))
  return add(start, scale(segment, amount))
}

function quadArea(points) {
  return triangleArea(points[0], points[1], points[2]) + triangleArea(points[0], points[2], points[3])
}

function triangleArea(a, b, c) {
  return length(cross(subtract(b, a), subtract(c, a))) * 0.5
}

function quadNormal(points) {
  return normalize(add(cross(subtract(points[1], points[0]), subtract(points[2], points[0])), cross(subtract(points[2], points[0]), subtract(points[3], points[0]))), [0, 0, 1])
}

function addProposal(sums, counts, id, value) {
  const existing = sums.get(id)
  sums.set(id, existing ? add(existing, value) : [...value])
  counts.set(id, (counts.get(id) ?? 0) + 1)
}

function isBoundaryNode(nodeId, config) {
  const match = /^n-(\d+)-(\d+)$/.exec(nodeId)
  if (!match) return false
  const row = Number(match[1])
  const col = Number(match[2])
  return row === 0 || col === 0 || row === config.rows - 1 || col === config.columns - 1
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function scale(vector, amount) {
  return [vector[0] * amount, vector[1] * amount, vector[2] * amount]
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function length(vector) {
  return Math.sqrt(dot(vector, vector))
}

function distance(a, b) {
  return length(subtract(a, b))
}

function normalize(vector, fallback) {
  const vectorLength = length(vector)
  if (vectorLength <= 1e-8) return normalize(fallback, [1, 0, 0])
  return scale(vector, 1 / vectorLength)
}

function fallbackNotParallel(axis) {
  const seed = Math.abs(axis[2]) < 0.8 ? [0, 0, 1] : [0, 1, 0]
  const cross = [
    axis[1] * seed[2] - axis[2] * seed[1],
    axis[2] * seed[0] - axis[0] * seed[2],
    axis[0] * seed[1] - axis[1] * seed[0],
  ]
  return normalize(cross, [0, 1, 0])
}

function lerp(a, b, amount) {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]
}

function angleDeg(a, b) {
  const denominator = Math.max(length(a) * length(b), 1e-12)
  const cosine = Math.max(-1, Math.min(1, dot(a, b) / denominator))
  return (Math.acos(cosine) * 180) / Math.PI
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value) {
  return Number(value.toFixed(4))
}
