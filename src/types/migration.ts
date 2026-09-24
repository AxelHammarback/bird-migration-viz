export type ShareType = "measured" | "estimated" | "illustrative";

export type MigrationPoint = {
  lat: number;
  lng: number;
  alt?: number;
  progress?: number;
};

export type SeasonalWindow = {
  startDay: number;
  endDay: number;
};

export type MigrationDirection = "autumn" | "spring" | "other";

export type EndpointSpread = {
  latRadius: number;
  lngRadius: number;
};

export type MigrationCorridor = {
  id: string;
  speciesId: string;
  originRegion: string;
  destinationRegion: string;
  direction?: MigrationDirection;
  share: number;
  seasonalWindow: SeasonalWindow;
  path: MigrationPoint[];
  shareType: ShareType;
  source?: string;
  sampleSize?: number;
  uncertainty?: number;
  routeType: string;
  notes: string;
  locations: string[];
  endpointSpread?: {
    origin: EndpointSpread;
    destination: EndpointSpread;
  };
};

export type Species = {
  id: string;
  commonName: string;
  scientificName: string;
  color: string;
  annualDistanceKm: string;
  summary: string;
  locations: string[];
  corridors: MigrationCorridor[];
};

export type VisualizationMode = "flow" | "tracks" | "presence";
export type EffectsLevel = "full" | "balanced" | "minimal";

export type RoutePhase = "baseline" | "activeTrail";

export type GlobePath = {
  id: string;
  speciesId: string;
  corridorId: string;
  phase: RoutePhase;
  points: MigrationPoint[];
  color: string;
  share: number;
  strandIndex: number;
  strandCount: number;
  active: boolean;
  opacity: number;
  stroke: number;
  dashInitialGap: number;
  label: string;
  sourceCorridor: MigrationCorridor;
};

export type BirdMarker = {
  id: string;
  speciesId: string;
  corridorId: string;
  lat: number;
  lng: number;
  color: string;
  opacity: number;
  radius: number;
  scale?: number;
  strandIndex: number;
  resting: boolean;
  label: string;
  sourceCorridor: MigrationCorridor;
};

export type LocationAnchor = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};
