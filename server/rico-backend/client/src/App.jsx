import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SubmitDeal from './pages/SubmitDeal.jsx';
import BusinessLogin from './pages/BusinessLogin.jsx';
import BusinessDashboard from './pages/BusinessDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/submit-deal" element={<SubmitDeal />} />
        <Route path="/business/login" element={<BusinessLogin />} />
        <Route path="/business/dashboard" element={<BusinessDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
