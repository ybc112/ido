import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Ido from "./pages/Ido";
import Fishing from "./pages/Fishing";
import { Header } from "./components/Header";
import { OceanBackground } from "./components/OceanBackground";

function App() {
  return (
    <Router>
      <div className="relative min-h-screen">
        <OceanBackground />
        <Header />
        <main className="relative mx-auto max-w-[1600px] px-4 py-5 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Ido />} />
            <Route path="/fishing" element={<Fishing />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
