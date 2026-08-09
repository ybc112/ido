import Ido from "./pages/Ido";
import { OceanBackground } from "./components/OceanBackground";

function App() {
  return (
    <div className="relative min-h-screen">
      <OceanBackground />
      <main className="relative mx-auto max-w-[1600px] px-4 py-6 sm:p-6 lg:p-8">
        <Ido />
      </main>
    </div>
  );
}

export default App;
