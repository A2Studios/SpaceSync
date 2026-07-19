import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Setup from './pages/Setup';
import RoomRouter from './pages/RoomRouter';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/:code" element={<RoomRouter />} />
      </Routes>
    </Router>
  );
}

export default App;
