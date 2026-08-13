import Home from "./pages/Home";
import { Header } from "./components/Header";

function App() {
  return (
    <div className="relative min-h-screen">
      <div className="site-bg" />
      <div className="site-grid" />
      <Header />
      <main>
        <Home />
      </main>
    </div>
  );
}

export default App;
