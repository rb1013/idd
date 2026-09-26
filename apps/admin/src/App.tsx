import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import TutorialsPage from './pages/TutorialsPage';
import CategoriesPage from './pages/CategoriesPage';
import UsersPage from './pages/UsersPage';
import GuardiansPage from './pages/GuardiansPage';
import SituationTagsPage from './pages/SituationTagsPage';
import MedicalConditionsPage from './pages/MedicalConditionsPage';
import EventCategoriesPage from './pages/EventCategoriesPage';
import DiscussionCategoriesPage from './pages/DiscussionCategoriesPage';
import TutorialSkillsPage from './pages/TutorialSkillsPage';
import AppSettingsPage from './pages/AppSettingsPage';
import ReportsPage from './pages/ReportsPage';
import BlockedWordsPage from './pages/BlockedWordsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

function ProtectedRoutes() {
  const { session, isAdmin, loading, needsPasswordReset } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (needsPasswordReset) return <ResetPasswordPage />;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2>Access Denied</h2>
      <p>Your account does not have admin privileges.</p>
    </div>
  );
  return <Layout />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tutorials" element={<TutorialsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/guardians" element={<GuardiansPage />} />
            <Route path="/situation-tags" element={<SituationTagsPage />} />
            <Route path="/medical-conditions" element={<MedicalConditionsPage />} />
            <Route path="/event-categories" element={<EventCategoriesPage />} />
            <Route path="/discussion-categories" element={<DiscussionCategoriesPage />} />
            <Route path="/tutorial-skills" element={<TutorialSkillsPage />} />
            <Route path="/settings" element={<AppSettingsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/blocked-words" element={<BlockedWordsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
