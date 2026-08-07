import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SubmitDeal from './pages/SubmitDeal.jsx';
import VendorLogin from './pages/VendorLogin.jsx';
import VendorDashboard from './pages/VendorDashboard.jsx';
import OwnerLogin from './pages/OwnerLogin.jsx';
import OwnerDashboard from './pages/OwnerDashboard.jsx';
import SetPassword from './pages/SetPassword.jsx';
import BusinessDirectory from './pages/BusinessDirectory.jsx';
import Home from './pages/Home.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/submit-deal" element={<SubmitDeal />} />
        <Route path="/vendor/login" element={<VendorLogin />} />
        <Route path="/vendor/set-password" element={<SetPassword loginPath="/vendor/login" />} />
        <Route path="/vendor/dashboard" element={<VendorDashboard />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/set-password" element={<SetPassword loginPath="/owner/login" />} />
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        <Route path="/directory" element={<BusinessDirectory />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
