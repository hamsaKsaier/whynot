import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ServerErrorPage } from '../ServerErrorPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'admin.errors.serverError.title': 'Server Error',
        'admin.errors.serverError.description': 'Something went wrong on our end. Please try again later.',
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
      <ServerErrorPage />
    </MemoryRouter>,
  )
}

describe('ServerErrorPage', () => {
  it('renders 500 title', () => {
    renderPage()
    expect(screen.getByText('Server Error')).toBeInTheDocument()
  })

  it('renders description text', () => {
    renderPage()
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })

  it('renders a link back to dashboard', () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'Back to Dashboard' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('uses text-destructive for the warning icon', () => {
    const { container } = renderPage()
    const icon = container.querySelector('.text-destructive')
    expect(icon).toBeTruthy()
  })

  it('uses min-h-[60vh] for in-shell layout', () => {
    const { container } = renderPage()
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('min-h-[60vh]')
  })
})
