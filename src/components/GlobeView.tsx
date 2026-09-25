import { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { locationAnchors } from "../data/migrationData";
import { deriveBirdMarkers, deriveGlobePaths } from "../lib/migration";
import { useMigrationStore } from "../state/useMigrationStore";
import type { BirdMarker, EffectsLevel, GlobePath, LocationAnchor, MigrationPoint } from "../types/migration";

type GlobeMethods = {
  pointOfView: (coords: { lat: number; lng: number; altitude: number }, duration?: number) => void;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number; enableDamping: boolean; dampingFactor: number };
  renderer: () => { setPixelRatio: (ratio: number) => void };
};

const hexToRgba = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

type GlobePoint =
  LocationAnchor & { kind: "anchor" };

const globeTextures = [
  { id: "night", label: "Night", url: "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg" },
  { id: "blue-marble", label: "Blue marble", url: "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg" },
  { id: "dark", label: "Dark", url: "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg" },
  { id: "day", label: "Day", url: "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg" },
] as const;

const effectsOptions: { id: EffectsLevel; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "balanced", label: "Balanced" },
  { id: "minimal", label: "Minimal" },
];

const makeOrbTexture = (color: string, opacity: number) => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) return new THREE.CanvasTexture(canvas);

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, hexToRgba("#ffffff", opacity));
  gradient.addColorStop(0.22, hexToRgba(color, opacity));
  gradient.addColorStop(0.48, hexToRgba(color, opacity * 0.58));
  gradient.addColorStop(1, hexToRgba(color, 0));
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

const makeBirdOrb = (marker: BirdMarker) => {
  const material = new THREE.SpriteMaterial({
    map: makeOrbTexture(marker.color, marker.opacity),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  const scale = marker.scale ?? (marker.resting ? 1.75 : 2.7);
  sprite.scale.set(scale, scale, 1);

  // Invisible, larger sprite purely to widen the hover/tooltip hit area without
  // changing the rendered glow size.
  const hitMaterial = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false });
  const hitSprite = new THREE.Sprite(hitMaterial);
  const hitScale = scale * 3;
  hitSprite.scale.set(hitScale, hitScale, 1);

  const group = new THREE.Group();
  group.add(hitSprite);
  group.add(sprite);
  return group;
};

const GlobeView = () => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [fps, setFps] = useState(0);
  const [textureId, setTextureId] = useState<(typeof globeTextures)[number]["id"]>("night");
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const pendingClearRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const {
    dayOfYear,
    selectedSpeciesIds,
    inspectedSpeciesId,
    selectedCorridorId,
    selectedLocation,
    mode,
    effectsLevel,
    setSelectedCorridor,
    setEffectsLevel,
  } = useMigrationStore();

  const paths = useMemo(
    () =>
      deriveGlobePaths({
        dayOfYear,
        selectedSpeciesIds,
        inspectedSpeciesId,
        selectedCorridorId,
        mode,
        effectsLevel,
      }),
    [dayOfYear, effectsLevel, inspectedSpeciesId, mode, selectedCorridorId, selectedSpeciesIds],
  );

  const birdMarkers = useMemo(
    () =>
      deriveBirdMarkers({
        dayOfYear,
        selectedSpeciesIds,
        inspectedSpeciesId,
        selectedCorridorId,
        mode,
        effectsLevel,
      }),
    [dayOfYear, effectsLevel, inspectedSpeciesId, mode, selectedCorridorId, selectedSpeciesIds],
  );

  const activeAnchors = useMemo(() => {
    const lowerLocations = new Set<string>();
    paths.forEach((path) => {
      path.sourceCorridor.locations.forEach((location) => lowerLocations.add(location.toLowerCase()));
    });
    return locationAnchors.filter((anchor) => lowerLocations.has(anchor.name.toLowerCase()));
  }, [paths]);

  const globePoints: GlobePoint[] = useMemo(
    () => activeAnchors.map((anchor) => ({ ...anchor, kind: "anchor" as const })),
    [activeAnchors],
  );
  const selectedTexture = globeTextures.find((texture) => texture.id === textureId) ?? globeTextures[0];

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.18;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));

    globe.pointOfView({ lat: 28, lng: 4, altitude: 2.05 }, 0);
  }, []);

  useEffect(() => {
    if (!selectedLocation || !globeRef.current) return;

    const anchor = locationAnchors.find((item) => item.name === selectedLocation);
    if (anchor) {
      globeRef.current.pointOfView({ lat: anchor.lat, lng: anchor.lng, altitude: 1.65 }, 1100);
    }
  }, [selectedLocation]);

  useEffect(() => {
    let frame = 0;
    let frames = 0;
    let lastUpdate = performance.now();

    const tick = (time: number) => {
      frames += 1;
      const elapsed = time - lastUpdate;
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        lastUpdate = time;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = shell.getBoundingClientRect();
      lastMouseRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };

      if (pendingClearRef.current) {
        pendingClearRef.current = false;
        setTooltip(null);
        return;
      }

      setTooltip((current) => (current ? { ...current, ...lastMouseRef.current } : current));
    };

    shell.addEventListener("mousemove", handleMouseMove);
    return () => shell.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleHoverChange = (label: string | null) => {
    if (label) {
      pendingClearRef.current = false;
      setTooltip({ label, x: lastMouseRef.current.x, y: lastMouseRef.current.y });
    } else {
      // Don't hide immediately: keep the tooltip until the user genuinely moves
      // the mouse, so marker/path animation alone doesn't dismiss it.
      pendingClearRef.current = true;
    }
  };

  return (
    <div className="globe-shell" ref={shellRef}>
      <div className="globe-controls">
        <div className="fps-counter">{fps} FPS</div>
        <label className="texture-picker">
          <span>Earth</span>
          <select value={textureId} onChange={(event) => setTextureId(event.target.value as typeof textureId)}>
            {globeTextures.map((texture) => (
              <option key={texture.id} value={texture.id}>
                {texture.label}
              </option>
            ))}
          </select>
        </label>
        <label className="texture-picker">
          <span>Effects</span>
          <select value={effectsLevel} onChange={(event) => setEffectsLevel(event.target.value as EffectsLevel)}>
            {effectsOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Globe
        ref={globeRef as never}
        globeOffset={[-130, 0]}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={selectedTexture.url}
        bumpImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png"
        atmosphereColor="#38bdf8"
        atmosphereAltitude={0.1}
        showAtmosphere
        onGlobeReady={() => globeRef.current?.pointOfView({ lat: 28, lng: 4, altitude: 2.05 }, 0)}
        pathsData={paths}
        pathPoints={(path: object) => (path as GlobePath).points}
        pathPointLat="lat"
        pathPointLng="lng"
        pathPointAlt={(point: object) => (point as MigrationPoint).alt ?? 0.006}
        pathResolution={3}
        pathColor={(path: object) => {
          const item = path as GlobePath;
          return hexToRgba(item.color, item.opacity);
        }}
        pathStroke={(path: object) => (path as GlobePath).stroke}
        pathDashLength={() => 1}
        pathDashGap={() => 0.01}
        pathDashInitialGap={(path: object) => (path as GlobePath).dashInitialGap}
        pathDashAnimateTime={() => 0}
        pathTransitionDuration={0}
        pathLabel={(path: object) => (path as GlobePath).label}
        lineHoverPrecision={3.5}
        onPathHover={(path: object | null) => handleHoverChange(path ? (path as GlobePath).label : null)}
        onPathClick={(path: object) => setSelectedCorridor((path as GlobePath).corridorId)}
        pointsData={globePoints}
        pointLat={(point: object) => (point as GlobePoint).lat}
        pointLng={(point: object) => (point as GlobePoint).lng}
        pointColor={(point: object) => {
          const item = point as GlobePoint;
          return item.name === selectedLocation ? "#fef3c7" : "rgba(255,255,255,0.58)";
        }}
        pointAltitude={0.012}
        pointRadius={(point: object) => {
          const item = point as GlobePoint;
          return item.name === selectedLocation ? 0.18 : 0.07;
        }}
        pointResolution={14}
        pointsTransitionDuration={0}
        pointLabel={(point: object) => {
          const item = point as GlobePoint;
          return item.name;
        }}
        objectsData={birdMarkers}
        objectLat={(marker: object) => (marker as BirdMarker).lat}
        objectLng={(marker: object) => (marker as BirdMarker).lng}
        objectAltitude={0.022}
        objectFacesSurfaces={false}
        objectThreeObject={(marker: object) => makeBirdOrb(marker as BirdMarker)}
        objectLabel={(marker: object) => (marker as BirdMarker).label}
        onObjectHover={(marker: object | null) => handleHoverChange(marker ? (marker as BirdMarker).label : null)}
        labelsData={activeAnchors}
        labelLat="lat"
        labelLng="lng"
        labelText="name"
        labelColor={() => "rgba(226, 232, 240, 0.66)"}
        labelSize={0.75}
        labelDotRadius={0}
        labelResolution={2}
      />
      <div className="globe-vignette" />
      {tooltip ? (
        <div className="globe-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.label}
        </div>
      ) : null}
    </div>
  );
};

export default GlobeView;
