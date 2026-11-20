import React, {useEffect} from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {I18nextProvider} from 'react-i18next';
import {AccessibilityPanel} from './components/AccessibilityPanel';
import {JudgeDemoPlayer} from './components/JudgeDemoPlayer';
import {Navbar} from './components/Navbar';
import {OfflineIndicator} from './components/OfflineIndicator';
import {ToastRegion} from './components/ui/ToastRegion';
import i18n from './i18n';
import {AdminDemoPage} from './pages/AdminDemoPage';
import {BookingPage} from './pages/BookingPage';
import {ConductorPage} from './pages/ConductorPage';
import {HelpCenterPage} from './pages/HelpCenterPage';
import {HomeDashboardPage} from './pages/HomeDashboardPage';
import {JourneyModePage} from './pages/JourneyModePage';
import {LandingPage} from './pages/LandingPage';
import {OnboardingPage} from './pages/OnboardingPage';
import {SettingsPage} from './pages/SettingsPage';
import {TicketPage} from './pages/TicketPage';
import {TrackingPage} from './pages/TrackingPage';
import {useAppStore} from './store/useAppStore';

const queryClient = new QueryClient();

const AppShell: React.FC = () => {
  const profile = useAppStore((s) => s.profile);
  const navigate = useNavigate();
  const location = useLocation();

  // Apply global accessibility CSS classes & font scale on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'high-contrast', 'colorblind-safe', 'dyslexia-font', 'reduce-motion');

    if (profile.theme === 'dark') root.classList.add('dark');
    if (profile.theme === 'high-contrast') root.classList.add('high-contrast');
    if (profile.colorBlindSafe) root.classList.add('colorblind-safe');
    if (profile.dyslexiaFont) root.classList.add('dyslexia-font');
    if (profile.reduceMotion) root.classList.add('reduce-motion');

    root.style.setProperty('--sy-font-scale', String(profile.fontScale || 1));
    root.lang = profile.language;
  }, [
    profile.colorBlindSafe,
    profile.dyslexiaFont,
    profile.fontScale,
    profile.language,
    profile.reduceMotion,
    profile.theme,
  ]);

  // Keep i18n synced
  useEffect(() => {
    if (i18n.language !== profile.language) {
      void i18n.changeLanguage(profile.language);
    }
  }, [profile.language]);

  // Global Ctrl+Shift+D shortcut for /admin
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (location.pathname === '/admin') {
          navigate('/home');
        } else {
          navigate('/admin');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--sy-bg)] text-[var(--sy-text)]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <OfflineIndicator />
      <Navbar />

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/home" element={<HomeDashboardPage />} />
          <Route path="/book" element={<BookingPage />} />
          <Route path="/ticket" element={<TicketPage />} />
          <Route path="/ticket/:id" element={<TicketPage />} />
          <Route path="/track" element={<TrackingPage />} />
          <Route path="/journey" element={<JourneyModePage />} />
          <Route path="/conductor" element={<ConductorPage />} />
          <Route path="/admin" element={<AdminDemoPage />} />
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <AccessibilityPanel />
      <ToastRegion />
      <JudgeDemoPlayer />
    </div>
  );
};

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
