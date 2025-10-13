import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PatientCaseDetail from './pages/PatientCaseDetail';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cases/:id" element={<PatientCaseDetail />} />
      </Routes>
    </Layout>
  );
}

export default App;
