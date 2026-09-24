import BirdPanel from "./components/BirdPanel";
import GlobeView from "./components/GlobeView";
import Timeline from "./components/Timeline";

const App = () => {
  return (
    <main className="app">
      <GlobeView />
      <BirdPanel />
      <Timeline />
    </main>
  );
};

export default App;
