import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { AuthGuard } from './components/AuthGuard'
import { StudioLayout } from './components/StudioLayout'
import { InsightsList } from './pages/InsightsList'
import { InsightEditor } from './pages/InsightEditor'
import { ContentEngine } from './pages/ContentEngine'
import { Signal } from './pages/Signal'
import { ImageBank } from './pages/ImageBank'
import { Spotlight } from './pages/Spotlight'
import { CaseStudiesList } from './pages/CaseStudiesList'
import { CaseStudyEditor } from './pages/CaseStudyEditor'
import { Analytics } from './pages/Analytics'
import { UpdatesList } from './pages/UpdatesList'
import { UpdateViewer } from './pages/UpdateViewer'
import { AutoInsightsLog } from './pages/AutoInsightsLog'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGuard>
          <StudioLayout>
            <Routes>
              <Route path="/" element={<InsightsList />} />
              <Route path="/insights/new" element={<InsightEditor />} />
              <Route path="/insights/:id" element={<InsightEditor />} />
              <Route path="/engine" element={<ContentEngine />} />
              <Route path="/signal" element={<Signal />} />
              <Route path="/images" element={<ImageBank />} />
              <Route path="/spotlight" element={<Spotlight />} />
              <Route path="/spotlight/:imageId" element={<Spotlight />} />
              <Route path="/case-studies" element={<CaseStudiesList />} />
              <Route path="/case-studies/new" element={<CaseStudyEditor />} />
              <Route path="/case-studies/:id" element={<CaseStudyEditor />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/analytics/updates" element={<UpdatesList />} />
              <Route path="/analytics/updates/:slug" element={<UpdateViewer />} />
              <Route path="/auto-insights" element={<AutoInsightsLog />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </StudioLayout>
        </AuthGuard>
      </BrowserRouter>
    </AuthProvider>
  )
}
