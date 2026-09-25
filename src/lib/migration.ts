import { maxPathsPerSpecies, speciesData } from "../data/migrationData";
import type {
  BirdMarker,
  EffectsLevel,
  GlobePath,
  MigrationCorridor,
  MigrationPoint,
  SeasonalWindow,
  Species,
  VisualizationMode,
} from "../types/migration";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const trailLengthKm = 2000;
const trailSegmentCount = 5;
const migrationTransitionDays = 5;

const effectsConfig = {
  full: { trailSegments: 5, trailScale: 1, markerScale: 1, activeTrails: true },
  balanced: { trailSegments: 3, trailScale: 0.78, markerScale: 0.82, activeTrails: true },
  minimal: { trailSegments: 0, trailScale: 0, markerScale: 0.62, activeTrails: false },
} satisfies Record<EffectsLevel, { trailSegments: number; trailScale: number; markerScale: number; activeTrails: boolean }>;

type StrandGeometry = {
  points: MigrationPoint[];
  distances: number[];
};

const strandGeometryCache = new Map<string, StrandGeometry>();

const seededNoise = (seed: string) => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
};

export const formatSeasonWindow = ({ startDay, endDay }: SeasonalWindow) =>
  `${dayNumberToShortDate(startDay)}-${dayNumberToShortDate(endDay)}`;

const dayNumberToShortDate = (day: number) => {
  const date = new Date(Date.UTC(2024, 0, Math.round(day)));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

const dayNumberToFuzzyDate = (day: number) => {
  const date = new Date(Date.UTC(2024, 0, Math.round(day)));
  const month = date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const dateOfMonth = date.getUTCDate();
  const period = dateOfMonth <= 10 ? "early" : dateOfMonth <= 20 ? "mid" : "late";
  return `${period} ${month}`;
};

const formatFuzzySeasonWindow = ({ startDay, endDay }: SeasonalWindow) =>
  `${dayNumberToFuzzyDate(startDay)} - ${dayNumberToFuzzyDate(endDay)}`;

const windowLength = ({ startDay, endDay }: SeasonalWindow) =>
  endDay >= startDay ? endDay - startDay : 365 - startDay + endDay;

const daysSinceWindowEnd = ({ endDay }: SeasonalWindow, dayOfYear: number) => {
  const day = ((dayOfYear - 1 + 365) % 365) + 1;
  return day >= endDay ? day - endDay : 365 - endDay + day;
};

const daysSinceWindowStart = ({ startDay }: SeasonalWindow, dayOfYear: number) => {
  const day = ((dayOfYear - 1 + 365) % 365) + 1;
  return day >= startDay ? day - startDay : 365 - startDay + day;
};

const daysUntilWindowStart = ({ startDay }: SeasonalWindow, dayOfYear: number) => {
  const day = ((dayOfYear - 1 + 365) % 365) + 1;
  return day <= startDay ? startDay - day : 365 - day + startDay;
};

export const isDayInSeasonWindow = ({ startDay, endDay }: SeasonalWindow, dayOfYear: number) => {
  const day = ((dayOfYear - 1 + 365) % 365) + 1;
  if (startDay <= endDay) return day >= startDay && day <= endDay;
  return day >= startDay || day <= endDay;
};

export const progressInSeasonWindow = (window: SeasonalWindow, dayOfYear: number) => {
  if (!isDayInSeasonWindow(window, dayOfYear)) return null;

  const { startDay, endDay } = window;
  const length = Math.max(1, windowLength(window));
  const day = ((dayOfYear - 1 + 365) % 365) + 1;
  const elapsed = startDay <= endDay ? day - startDay : day >= startDay ? day - startDay : 365 - startDay + day;

  return clamp(elapsed / length, 0, 1);
};

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

const interpolatePoint = (a: MigrationPoint, b: MigrationPoint, t: number): MigrationPoint => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

const distanceKm = (a: MigrationPoint, b: MigrationPoint) => {
  const earthRadiusKm = 6371;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const smoothPath = (path: MigrationPoint[], samplesPerSegment = 8) => {
  if (path.length < 3) return path;

  const smoothed: MigrationPoint[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const p0 = path[Math.max(0, index - 1)];
    const p1 = path[index];
    const p2 = path[index + 1];
    const p3 = path[Math.min(path.length - 1, index + 2)];

    for (let sample = 0; sample < samplesPerSegment; sample += 1) {
      const t = sample / samplesPerSegment;
      smoothed.push({
        lat: catmullRom(p0.lat, p1.lat, p2.lat, p3.lat, t),
        lng: catmullRom(p0.lng, p1.lng, p2.lng, p3.lng, t),
      });
    }
  }

  smoothed.push(path[path.length - 1]);
  return smoothed;
};

const spreadEndpoint = (
  point: MigrationPoint,
  corridor: MigrationCorridor,
  strandIndex: number,
  endpoint: "origin" | "destination",
) => {
  const spread = corridor.endpointSpread?.[endpoint];
  if (!spread) return point;

  const angle = seededNoise(`${corridor.id}:${strandIndex}:${endpoint}:angle`) * Math.PI * 2;
  const radius = Math.sqrt(seededNoise(`${corridor.id}:${strandIndex}:${endpoint}:radius`));

  return {
    lat: point.lat + Math.sin(angle) * radius * spread.latRadius,
    lng: point.lng + Math.cos(angle) * radius * spread.lngRadius,
  };
};

const offsetPath = (corridor: MigrationCorridor, strandIndex: number, strandCount: number) => {
  const { path } = corridor;
  const center = (strandCount - 1) / 2;
  const spread = strandCount <= 1 ? 0 : (strandIndex - center) / Math.max(1, center);
  const direction = seededNoise(`${corridor.id}:${strandIndex}:direction`) > 0.5 ? 1 : -1;
  const baseLatOffset = spread * 0.62 + (seededNoise(`${corridor.id}:${strandIndex}:lat`) - 0.5) * 0.32;
  const baseLngOffset = spread * 0.92 + (seededNoise(`${corridor.id}:${strandIndex}:lng`) - 0.5) * 0.44;
  const bendFrequency = 1.25 + seededNoise(`${corridor.id}:${strandIndex}:freq`) * 1.4;

  const offset = path.map((point, pointIndex) => {
    const progress = pointIndex / Math.max(1, path.length - 1);
    const endpointTaper = Math.sin(Math.PI * progress);
    const bend = Math.sin(progress * Math.PI * bendFrequency + strandIndex * 0.7) * endpointTaper;
    const jitterLat = (seededNoise(`${corridor.id}:${strandIndex}:${pointIndex}:lat`) - 0.5) * 0.08;
    const jitterLng = (seededNoise(`${corridor.id}:${strandIndex}:${pointIndex}:lng`) - 0.5) * 0.12;

    return {
      lat: point.lat + (baseLatOffset * 0.54 + bend * 0.42 * direction + jitterLat) * endpointTaper,
      lng: point.lng + (baseLngOffset * 0.72 - bend * 0.58 * direction + jitterLng) * endpointTaper,
    };
  });

  if (offset.length > 0) {
    offset[0] = spreadEndpoint(offset[0], corridor, strandIndex, "origin");
    offset[offset.length - 1] = spreadEndpoint(offset[offset.length - 1], corridor, strandIndex, "destination");
  }

  return offset;
};

const pointAtProgress = (path: MigrationPoint[], progress: number) => {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1 || progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];

  const scaled = progress * (path.length - 1);
  const whole = Math.floor(scaled);
  const fraction = scaled - whole;
  const next = path[whole + 1];

  return next ? interpolatePoint(path[whole], next, fraction) : path[whole];
};

const cumulativeDistances = (path: MigrationPoint[]) =>
  path.reduce<number[]>((distances, point, index) => {
    if (index === 0) return [0];
    return [...distances, distances[index - 1] + distanceKm(path[index - 1], point)];
  }, []);

const pointAtDistance = (path: MigrationPoint[], distances: number[], targetDistance: number) => {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (targetDistance <= 0) return path[0];

  const totalDistance = distances[distances.length - 1] ?? 0;
  if (targetDistance >= totalDistance) return path[path.length - 1];

  const endIndex = distances.findIndex((distance) => distance >= targetDistance);
  const startIndex = Math.max(0, endIndex - 1);
  const segmentDistance = distances[endIndex] - distances[startIndex];
  const segmentProgress = segmentDistance === 0 ? 0 : (targetDistance - distances[startIndex]) / segmentDistance;

  return interpolatePoint(path[startIndex], path[endIndex], segmentProgress);
};

const slicePathByDistance = (path: MigrationPoint[], distances: number[], startDistance: number, endDistance: number) => {
  if (path.length === 0 || endDistance <= startDistance) return [];

  const start = Math.max(0, startDistance);
  const end = Math.min(distances[distances.length - 1] ?? 0, endDistance);
  const middle = path.filter((_, index) => distances[index] > start && distances[index] < end);

  return [pointAtDistance(path, distances, start), ...middle, pointAtDistance(path, distances, end)].filter((point, index, points) => {
    const previous = points[index - 1];
    return !previous || previous.lat !== point.lat || previous.lng !== point.lng;
  });
};

const restingCorridorsForSpecies = (corridors: MigrationCorridor[], dayOfYear: number) => {
  const activeCorridor = corridors.find((corridor) => progressInSeasonWindow(corridor.seasonalWindow, dayOfYear) !== null);
  if (activeCorridor) return [];

  const lastCompleted = corridors
    .map((corridor) => ({
      corridor,
      daysSinceEnd: daysSinceWindowEnd(corridor.seasonalWindow, dayOfYear),
    }))
    .sort((a, b) => a.daysSinceEnd - b.daysSinceEnd)[0]?.corridor;

  if (!lastCompleted) return [];
  return corridors.filter((corridor) => corridor.direction === lastCompleted.direction);
};

const restingProgressForCorridor = (corridor: MigrationCorridor, dayOfYear: number) =>
  daysSinceWindowEnd(corridor.seasonalWindow, dayOfYear) < daysUntilWindowStart(corridor.seasonalWindow, dayOfYear) ? 1 : 0;

const trailFadeAfterArrival = (corridor: MigrationCorridor, dayOfYear: number) =>
  clamp(1 - daysSinceWindowEnd(corridor.seasonalWindow, dayOfYear) / migrationTransitionDays, 0, 1);

const activeMarkerFade = (corridor: MigrationCorridor, dayOfYear: number) =>
  clamp(0.42 + (daysSinceWindowStart(corridor.seasonalWindow, dayOfYear) / migrationTransitionDays) * 0.58, 0.42, 1);

const destinationSettleProgress = (corridor: MigrationCorridor, dayOfYear: number) =>
  clamp(daysSinceWindowEnd(corridor.seasonalWindow, dayOfYear) / migrationTransitionDays, 0, 1);

const restingMarkerFade = (corridor: MigrationCorridor, dayOfYear: number, progress: number) => {
  if (progress === 1) {
    const settle = destinationSettleProgress(corridor, dayOfYear);
    return 1.17 - settle * 0.17;
  }

  return clamp(1 - daysUntilWindowStart(corridor.seasonalWindow, dayOfYear) / migrationTransitionDays, 0, 1);
};

const restingMarkerScale = (corridor: MigrationCorridor, dayOfYear: number, progress: number) => {
  const restingScale = 1.75;
  const movingScale = 2.7;

  if (progress === 1) {
    const settle = destinationSettleProgress(corridor, dayOfYear);
    return movingScale + (restingScale - movingScale) * settle;
  }

  const departureFade = restingMarkerFade(corridor, dayOfYear, progress);
  return restingScale + (movingScale - restingScale) * departureFade;
};

const strandCountForCorridor = (corridor: MigrationCorridor, mode: VisualizationMode) =>
  mode === "tracks" ? Math.min(3, Math.max(1, Math.round(corridor.share * 4))) : Math.max(1, Math.round(corridor.share * maxPathsPerSpecies));

const pathLabel = (species: Species, corridor: MigrationCorridor) => {
  const direction = corridor.direction === "spring" ? "Spring return" : corridor.direction === "autumn" ? "Autumn migration" : corridor.routeType;
  return `<b>${species.commonName}</b><br/>${direction}: ${corridor.originRegion} to ${corridor.destinationRegion}<br/>Period: ${formatFuzzySeasonWindow(corridor.seasonalWindow)}`;
};

const strandPath = (corridor: MigrationCorridor, strandIndex: number, strandCount: number) =>
  smoothPath(offsetPath(corridor, strandIndex, strandCount), 7);

const strandGeometry = (corridor: MigrationCorridor, mode: VisualizationMode, strandIndex: number, strandCount: number) => {
  const cacheKey = `${mode}:${corridor.id}:${strandCount}:${strandIndex}`;
  const cached = strandGeometryCache.get(cacheKey);
  if (cached) return cached;

  const points = strandPath(corridor, strandIndex, strandCount);
  const geometry = {
    points,
    distances: cumulativeDistances(points),
  };
  strandGeometryCache.set(cacheKey, geometry);
  return geometry;
};

export const selectedSpecies = (selectedSpeciesIds: string[]) =>
  speciesData.filter((species) => selectedSpeciesIds.includes(species.id));

export const deriveGlobePaths = ({
  dayOfYear,
  selectedSpeciesIds,
  inspectedSpeciesId,
  selectedCorridorId,
  mode,
  effectsLevel,
  showRoutes = true,
}: {
  dayOfYear: number;
  selectedSpeciesIds: string[];
  inspectedSpeciesId: string | null;
  selectedCorridorId: string | null;
  mode: VisualizationMode;
  effectsLevel: EffectsLevel;
  showRoutes?: boolean;
}): GlobePath[] => {
  if (mode === "presence") return [];
  const config = effectsConfig[effectsLevel];

  return selectedSpecies(selectedSpeciesIds).flatMap((species) =>
    species.corridors.flatMap((corridor) => {
      const count = strandCountForCorridor(corridor, mode);
      const progress = progressInSeasonWindow(corridor.seasonalWindow, dayOfYear);
      const afterArrivalFade = progress === null ? trailFadeAfterArrival(corridor, dayOfYear) : 1;
      const trailProgress = progress ?? (afterArrivalFade > 0 ? 1 : null);
      const active = progress !== null;
      const isInspected =
        selectedCorridorId === corridor.id || (!selectedCorridorId && inspectedSpeciesId === species.id);
      const dimmed = Boolean((inspectedSpeciesId && inspectedSpeciesId !== species.id) || (selectedCorridorId && selectedCorridorId !== corridor.id));
      const label = pathLabel(species, corridor);
      const baselineOpacity = (dimmed ? 0.14 : isInspected ? 0.58 : active ? 0.5 : 0.34) * 0.7;
      const baseStroke = mode === "tracks" ? 0.36 : clamp(0.3 + corridor.share * 0.24, 0.34, 0.54);

      return Array.from({ length: count }, (_, strandIndex): GlobePath[] => {
        const { points, distances } = strandGeometry(corridor, mode, strandIndex, count);
        const baseline: GlobePath = {
          id: `${corridor.id}-${mode}-baseline-${strandIndex}`,
          speciesId: species.id,
          corridorId: corridor.id,
          phase: "baseline",
          points,
          color: species.color,
          share: corridor.share,
          strandIndex,
          strandCount: count,
          active,
          opacity: baselineOpacity,
          stroke: baseStroke,
          dashInitialGap: 0,
          label,
          sourceCorridor: corridor,
        };

        if (!config.activeTrails || trailProgress === null) return showRoutes ? [baseline] : [];

        const routeDistance = distances[distances.length - 1] ?? 0;
        const birdDistance = routeDistance * trailProgress;
        const trailStartDistance = Math.max(0, birdDistance - trailLengthKm);
        const visibleTrailDistance = birdDistance - trailStartDistance;

        if (visibleTrailDistance <= 0) return showRoutes ? [baseline] : [];

        const trails = Array.from({ length: config.trailSegments }, (_, segmentIndex): GlobePath | null => {
          const segmentStart = trailStartDistance + (visibleTrailDistance * segmentIndex) / config.trailSegments;
          const segmentEnd = trailStartDistance + (visibleTrailDistance * (segmentIndex + 1)) / config.trailSegments;
          const opacityT = (segmentIndex + 1) / config.trailSegments;
          const trailOpacity = Math.pow(opacityT, 0.72);
          const trailPoints = slicePathByDistance(points, distances, segmentStart, segmentEnd).map((point) => ({
            ...point,
            alt: 0.018,
          }));

          if (trailPoints.length < 2) return null;

          return {
            id: `${corridor.id}-${mode}-trail-${strandIndex}-${segmentIndex}`,
            speciesId: species.id,
            corridorId: corridor.id,
            phase: "activeTrail",
            points: trailPoints,
            color: species.color,
            share: corridor.share,
            strandIndex,
            strandCount: count,
            active,
            opacity: (dimmed ? 0.3 * trailOpacity : clamp(0.18 + trailOpacity * 0.92, 0.18, 1)) * afterArrivalFade * config.trailScale,
            stroke: baseStroke + 0.95 * config.trailScale,
            dashInitialGap: 0,
            label,
            sourceCorridor: corridor,
          };
        }).filter((trail): trail is GlobePath => trail !== null);

        return showRoutes ? [baseline, ...trails] : trails;
      });
    }),
  ).flat();
};

export const deriveBirdMarkers = ({
  dayOfYear,
  selectedSpeciesIds,
  inspectedSpeciesId,
  selectedCorridorId,
  mode,
  effectsLevel,
}: {
  dayOfYear: number;
  selectedSpeciesIds: string[];
  inspectedSpeciesId: string | null;
  selectedCorridorId: string | null;
  mode: VisualizationMode;
  effectsLevel: EffectsLevel;
}): BirdMarker[] => {
  if (mode === "presence") return [];
  const config = effectsConfig[effectsLevel];

  return selectedSpecies(selectedSpeciesIds).flatMap((species) => {
    const makeRestingMarkers = (corridor: MigrationCorridor, progress: number, opacityScale = 1) => {
      const count = strandCountForCorridor(corridor, mode);
      const dimmed = Boolean((inspectedSpeciesId && inspectedSpeciesId !== species.id) || (selectedCorridorId && selectedCorridorId !== corridor.id));
      const restingRegion = progress === 0 ? corridor.originRegion : corridor.destinationRegion;
      const label = `<b>${species.commonName}</b><br/>Resting near ${restingRegion}`;

      return Array.from({ length: count }, (_, strandIndex): BirdMarker => {
        const { points } = strandGeometry(corridor, mode, strandIndex, count);
        const base = pointAtProgress(points, progress);
        const driftAngle = dayOfYear * 0.075 + strandIndex * 1.43;
        const driftRadius = 0.16 + seededNoise(`${corridor.id}:${strandIndex}:rest`) * 0.16;

        return {
          id: `${corridor.id}-${mode}-bird-${strandIndex}`,
          speciesId: species.id,
          corridorId: corridor.id,
          lat: base.lat + Math.sin(driftAngle) * driftRadius,
          lng: base.lng + Math.cos(driftAngle * 0.83) * driftRadius,
          color: species.color,
          opacity: Math.min(1, (dimmed ? 0.2 : 0.84) * opacityScale),
          radius: mode === "tracks" ? 0.055 : 0.07,
          scale: restingMarkerScale(corridor, dayOfYear, progress) * config.markerScale,
          strandIndex,
          resting: true,
          label,
          sourceCorridor: corridor,
        };
      });
    };

    const activeDirections = new Set(
      species.corridors
        .filter((corridor) => progressInSeasonWindow(corridor.seasonalWindow, dayOfYear) !== null)
        .map((corridor) => corridor.direction),
    );

    const movingMarkers = species.corridors.flatMap((corridor) => {
      const progress = progressInSeasonWindow(corridor.seasonalWindow, dayOfYear);
      if (progress === null) return [];

      const count = strandCountForCorridor(corridor, mode);
      const dimmed = Boolean((inspectedSpeciesId && inspectedSpeciesId !== species.id) || (selectedCorridorId && selectedCorridorId !== corridor.id));
      const label = pathLabel(species, corridor);

      return Array.from({ length: count }, (_, strandIndex): BirdMarker => {
        const { points, distances } = strandGeometry(corridor, mode, strandIndex, count);
        const routeDistance = distances[distances.length - 1] ?? 0;
        const position = pointAtDistance(points, distances, routeDistance * progress);
        return {
          id: `${corridor.id}-${mode}-bird-${strandIndex}`,
          speciesId: species.id,
          corridorId: corridor.id,
          lat: position.lat,
          lng: position.lng,
          color: species.color,
          opacity: (dimmed ? 0.28 : 0.98) * activeMarkerFade(corridor, dayOfYear),
          radius: mode === "tracks" ? 0.08 : 0.1,
          scale: 2.7 * config.markerScale,
          strandIndex,
          resting: false,
          label,
          sourceCorridor: corridor,
        };
      });
    });

    if (movingMarkers.length > 0) {
      const sameSeasonRestingMarkers = species.corridors.flatMap((corridor) => {
        if (!activeDirections.has(corridor.direction)) return [];
        if (progressInSeasonWindow(corridor.seasonalWindow, dayOfYear) !== null) return [];
        const restingProgress = restingProgressForCorridor(corridor, dayOfYear);
        return makeRestingMarkers(corridor, restingProgress, restingMarkerFade(corridor, dayOfYear, restingProgress));
      });

      return [...movingMarkers, ...sameSeasonRestingMarkers];
    }

    const settledMarkers = restingCorridorsForSpecies(species.corridors, dayOfYear).flatMap((corridor) =>
      makeRestingMarkers(corridor, 1),
    );
    const upcomingMarkers = species.corridors.flatMap((corridor) => {
      const fade = restingMarkerFade(corridor, dayOfYear, 0);
      if (fade <= 0) return [];
      return makeRestingMarkers(corridor, 0, fade);
    });

    return [...settledMarkers, ...upcomingMarkers];
  });
};

export const speciesById = (speciesId: string | null): Species | null =>
  speciesData.find((species) => species.id === speciesId) ?? null;

export const corridorSpecies = (corridor: MigrationCorridor | null): Species | null =>
  corridor ? speciesData.find((species) => species.id === corridor.speciesId) ?? null : null;

export const locationSpeciesIds = (location: string) =>
  speciesData
    .filter((species) => species.locations.includes(location) || species.corridors.some((corridor) => corridor.locations.includes(location)))
    .map((species) => species.id);
