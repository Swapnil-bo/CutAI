import { useState } from 'react'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import MainCanvas from './components/layout/MainCanvas'
import HomePage from './pages/HomePage'
import ProjectPage from './pages/ProjectPage'

function ProjectShell() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('script')

  return (
    <div className="h-screen flex flex-col">
      <Header projectTitle={`Project #${id}`} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <MainCanvas>
          <ProjectPage activeTab={activeTab} />
        </MainCanvas>
      </div>
    </div>
  )
}

function HomeShell() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={null} onTabChange={() => {}} />
        <MainCanvas>
          <HomePage />
        </MainCanvas>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeShell />} />
        <Route path="/project/:id" element={<ProjectShell />} />
      </Routes>
    </BrowserRouter>
  )
}
