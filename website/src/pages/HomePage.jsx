import Hero from '../components/Hero'
import Stats from '../components/Stats'
import AppCards from '../components/AppCards'
import './HomePage.css'

export default function HomePage() {
  return (
    <div className="home">
      <Hero />
      <Stats />
      <AppCards />
    </div>
  )
}
