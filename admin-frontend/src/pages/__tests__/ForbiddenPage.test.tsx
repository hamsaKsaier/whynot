import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForbiddenPage } from '../ForbiddenPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'admin.errors.forbidden.title': 'Access Forbidden',
        'admin.errors.forbidden.description': "You don't have permission to access this area. Super administrator access is required.",
        'admin.errors.backToLogin': 'Back to Login',
      }
      return map[key] || key
    },
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() },
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ForbiddenPage />
    </MemoryRouter>,
  )
}

describe('ForbiddenPage', () => {
  it('renders forbidden title', () => {
    renderPage()
    expect(screen.getByText('Access Forbidden')).toBeInTheDocument()
  })

  it('renders description about super admin requirement', () => {
    renderPage()
    expect(screen.getByText(/Super administrator access is required/)).toBeInTheDocument()
  })

  it('renders a link back to login', () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'Back to Login' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
  })

  it('uses full-screen layout with centered content', () => {
    const { container } = renderPage()
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('min-h-screen')
    expect(wrapper.className).toContain('flex')
    expect(wrapper.className).toContain('items-center')
    expect(wrapper.className).toContain('justify-center')
  })

  it('uses text-destructive for shield icon', () => {
    const { container } = renderPage()
    const icon = container.querySelector('.text-destructive')
    expect(icon).toBeTruthy()
  })
})
