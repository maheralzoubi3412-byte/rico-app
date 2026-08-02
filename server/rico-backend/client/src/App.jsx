import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SubmitDeal from './pages/SubmitDeal.jsx';
import BusinessLogin from './pages/BusinessLogin.jsx';
import BusinessDashboard from './pages/BusinessDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import OwnerDashboard from './pages/OwnerDashboard.jsx';
import BusinessDirectory from './pages/BusinessDirectory.jsx';
import Home from './pages/Home.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Home />} />
        <Route path="/submit-deal" element={<SubmitDeal />} />
        <Route path="/business/login" element={<BusinessLogin />} />
        <Route path="/business/dashboard" element={<BusinessDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        <Route path="/directory" element={<BusinessDirectory />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
