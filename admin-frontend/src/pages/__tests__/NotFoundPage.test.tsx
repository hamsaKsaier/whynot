import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotFoundPage } from '../NotFoundPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'admin.errors.notFound.title': 'Page Not Found',
        'admin.errors.notFound.description': "The page you're looking for doesn't exist or has been moved.",
        'admin.errors.backHome': 'Back to Dashboard',
      }
      return map[key] || key
    },
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() },
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('renders 404 title', () => {
    renderPage()
    expect(screen.getByText('Page Not Found')).toBeInTheDocument()
  })

  it('renders description text', () => {
    renderPage()
    expect(screen.getByText(/doesn't exist or has been moved/)).toBeInTheDocument()
  })

  it('renders a link back to dashboard', () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'Back to Dashboard' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('centers content with responsive padding', () => {
    const { container } = renderPage()
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('flex')
    expect(wrapper.className).toContain('items-center')
    expect(wrapper.className).toContain('justify-center')
    expect(wrapper.className).toContain('px-4')
  })

  it('uses min-h-[60vh] for in-shell layout', () => {
    const { container } = renderPage()
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('min-h-[60vh]')
  })
})
