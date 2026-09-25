import { create } from "zustand";
import { speciesData } from "../data/migrationData";
import type { EffectsLevel, MigrationCorridor, VisualizationMode } from "../types/migration";

export type PlaybackSpeed = "auto" | 0.5 | 1 | 2 | 4;

type MigrationState = {
  selectedSpeciesIds: string[];
  inspectedSpeciesId: string | null;
  selectedCorridorId: string | null;
  selectedLocation: string | null;
  selectedCountries: string[];
  mode: VisualizationMode;
  effectsLevel: EffectsLevel;
  dayOfYear: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  toggleSpecies: (speciesId: string) => void;
  setSelectedSpeciesIds: (speciesIds: string[]) => void;
  selectAllSpecies: () => void;
  clearSpecies: () => void;
  setInspectedSpecies: (speciesId: string | null) => void;
  setSelectedCorridor: (corridorId: string | null) => void;
  setSelectedLocation: (location: string | null) => void;
  toggleCountry: (country: string) => void;
  clearCountries: () => void;
  setMode: (mode: VisualizationMode) => void;
  setEffectsLevel: (effectsLevel: EffectsLevel) => void;
  setDayOfYear: (day: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
};

export const useMigrationStore = create<MigrationState>((set) => ({
  selectedSpeciesIds: ["common-swift", "arctic-tern", "barn-swallow", "common-crane"],
  inspectedSpeciesId: null,
  selectedCorridorId: null,
  selectedLocation: null,
  selectedCountries: [],
  mode: "flow",
  effectsLevel: "full",
  dayOfYear: 252,
  isPlaying: false,
  speed: "auto",
  toggleSpecies: (speciesId) =>
    set((state) => {
      const isSelected = state.selectedSpeciesIds.includes(speciesId);
      const selectedSpeciesIds = isSelected
        ? state.selectedSpeciesIds.filter((id) => id !== speciesId)
        : [...state.selectedSpeciesIds, speciesId];

      return {
        selectedSpeciesIds,
        inspectedSpeciesId: isSelected && state.inspectedSpeciesId === speciesId ? null : speciesId,
        selectedCorridorId:
          isSelected && selectedSpeciesIds.length === 0 ? null : state.selectedCorridorId,
      };
    }),
  setSelectedSpeciesIds: (selectedSpeciesIds) =>
    set({
      selectedSpeciesIds,
      inspectedSpeciesId: selectedSpeciesIds.length === 1 ? selectedSpeciesIds[0] : null,
      selectedCorridorId: null,
    }),
  selectAllSpecies: () =>
    set({
      selectedSpeciesIds: speciesData.map((species) => species.id),
      inspectedSpeciesId: null,
      selectedCorridorId: null,
    }),
  clearSpecies: () =>
    set({
      selectedSpeciesIds: [],
      inspectedSpeciesId: null,
      selectedCorridorId: null,
    }),
  setInspectedSpecies: (speciesId) => set({ inspectedSpeciesId: speciesId }),
  setSelectedCorridor: (corridorId) => set({ selectedCorridorId: corridorId }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  toggleCountry: (country) =>
    set((state) => {
      const selectedCountries = state.selectedCountries.includes(country)
        ? state.selectedCountries.filter((item) => item !== country)
        : [...state.selectedCountries, country];
      const selectedSpeciesIds =
        selectedCountries.length === 0
          ? state.selectedSpeciesIds
          : speciesData
              .filter((species) =>
                selectedCountries.some(
                  (item) =>
                    species.locations.includes(item) ||
                    species.corridors.some((corridor) => corridor.locations.includes(item)),
                ),
              )
              .map((species) => species.id);

      return {
        selectedCountries,
        selectedSpeciesIds,
        inspectedSpeciesId: selectedSpeciesIds.length === 1 ? selectedSpeciesIds[0] : null,
        selectedCorridorId: null,
      };
    }),
  clearCountries: () => set({ selectedCountries: [] }),
  setMode: (mode) => set({ mode }),
  setEffectsLevel: (effectsLevel) => set({ effectsLevel }),
  setDayOfYear: (day) => set({ dayOfYear: Math.min(365, Math.max(1, day)) }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setSpeed: (speed) => set({ speed }),
}));

export const findCorridor = (corridorId: string | null): MigrationCorridor | null => {
  if (!corridorId) return null;

  for (const species of speciesData) {
    const corridor = species.corridors.find((item) => item.id === corridorId);
    if (corridor) return corridor;
  }

  return null;
};
