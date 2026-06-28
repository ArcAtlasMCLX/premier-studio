import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { AuthGuard } from './components/AuthGuard'
import { StudioLayout } from './components/StudioLayout'
import { InsightsList } from './pages/InsightsList'
import { InsightEditor } from './pages/InsightEditor'
import { ContentEngine } from './pages/ContentEngine'
import { Signal } from './pages/Signal'
import { ImageBank } from './pages/ImageBank'
import { CaseStudiesList } from './pages/CaseStudiesList'
import { CaseStudyEditor } from './pages/CaseStudyEditor'
import { Analytics } from './pages/Analytics'

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
              <Route path="/case-studies" element={<CaseStudiesList />} />
              <Route path="/case-studies/new" element={<CaseStudyEditor />} />
              <Route path="/case-studies/:id" element={<CaseStudyEditor />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </StudioLayout>
        </AuthGuard>
      </BrowserRouter>
    </AuthProvider>
  )
}
