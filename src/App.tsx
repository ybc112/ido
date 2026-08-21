import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import FishGame from "./pages/FishGame";
import { Header } from "./components/Header";
import { Announcement } from "./components/Announcement";

function App() {
  return (
    <BrowserRouter>
      <div className="site-bg" />
      <div className="site-grid" />
      <Routes>
        {/* 捕鱼游戏全屏页（不渲染官网 Header/背景） */}
        <Route path="/fish-game" element={<FishGame />} />
        {/* 官网首页 */}
        <Route
          path="/"
          element={
            <div className="relative min-h-screen">
              <Header />
              <Announcement />
              <main>
                <Home />
              </main>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
