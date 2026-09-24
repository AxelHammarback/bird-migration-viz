import { Layers, Route, Waves } from "lucide-react";
import { useMigrationStore } from "../state/useMigrationStore";
import type { VisualizationMode } from "../types/migration";

const modes: Array<{ id: VisualizationMode; label: string; icon: typeof Waves; disabled?: boolean }> = [
  { id: "flow", label: "Flow", icon: Waves },
  { id: "tracks", label: "Tracks", icon: Route },
  { id: "presence", label: "Presence", icon: Layers, disabled: true },
];

const ModeSwitch = () => {
  const { mode, setMode } = useMigrationStore();

  return (
    <nav className="mode-switch" aria-label="Visualization mode">
      {modes.map(({ id, label, icon: Icon, disabled }) => (
        <button
          className={mode === id ? "active" : ""}
          disabled={disabled}
          key={id}
          type="button"
          onClick={() => setMode(id)}
          title={disabled ? "Future scope" : `${label} mode`}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
};

export default ModeSwitch;
