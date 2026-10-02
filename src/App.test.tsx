import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the V35 foundation and responsive navigation landmarks', () => {
    render(<App />)
    expect(screen.getByText('Fundação V35')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument()
  })
})
