import Navbar from './components/Navbar'
import SimpleApiPage from './pages/SimpleApiPage'
import './styles/main.scss'

function App() {
  return (
    <div>
      <Navbar />
      <div className="container">
        <SimpleApiPage />
      </div>
    </div>
  )
}

export default App