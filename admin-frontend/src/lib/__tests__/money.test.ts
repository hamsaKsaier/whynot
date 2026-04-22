import { describe, it, expect } from 'vitest'
import { formatCents, dollarsToCents, centsToDollars } from '../money'

describe('formatCents', () => {
  describe('basic values', () => {
    it('formats 0 cents as $0.00', () => {
      expect(formatCents(0)).toBe('$0.00')
    })

    it('formats 100 cents as $1.00', () => {
      expect(formatCents(100)).toBe('$1.00')
    })

    it('formats 1999 cents as $19.99', () => {
      expect(formatCents(1999)).toBe('$19.99')
    })

    it('formats 999999 cents as $9,999.99', () => {
      expect(formatCents(999999)).toBe('$9,999.99')
    })

    it('formats 1 cent as $0.01', () => {
      expect(formatCents(1)).toBe('$0.01')
    })

    it('formats 50 cents as $0.50', () => {
      expect(formatCents(50)).toBe('$0.50')
    })
  })

  describe('negative values', () => {
    it('formats -100 cents as -$1.00', () => {
      expect(formatCents(-100)).toBe('-$1.00')
    })

    it('formats -1999 cents as -$19.99', () => {
      expect(formatCents(-1999)).toBe('-$19.99')
    })

    it('formats -1 cent as -$0.01', () => {
      expect(formatCents(-1)).toBe('-$0.01')
    })
  })

  describe('whole option (no decimals)', () => {
    it('formats 0 cents as $0 when whole is true', () => {
      expect(formatCents(0, { whole: true })).toBe('$0')
    })

    it('formats 100 cents as $1 when whole is true', () => {
      expect(formatCents(100, { whole: true })).toBe('$1')
    })

    it('formats 1999 cents as $20 when whole is true (rounds)', () => {
      expect(formatCents(1999, { whole: true })).toBe('$20')
    })

    it('formats 999999 cents as $10,000 when whole is true', () => {
      expect(formatCents(999999, { whole: true })).toBe('$10,000')
    })

    it('formats 150 cents as $2 when whole is true (rounds)', () => {
      expect(formatCents(150, { whole: true })).toBe('$2')
    })

    it('formats 149 cents as $1 when whole is true (rounds)', () => {
      expect(formatCents(149, { whole: true })).toBe('$1')
    })
  })

  describe('null and undefined input', () => {
    it('formats null as $0.00', () => {
      expect(formatCents(null)).toBe('$0.00')
    })

    it('formats undefined as $0.00', () => {
      expect(formatCents(undefined)).toBe('$0.00')
    })

    it('formats null with whole option as $0', () => {
      expect(formatCents(null, { whole: true })).toBe('$0')
    })

    it('formats undefined with whole option as $0', () => {
      expect(formatCents(undefined, { whole: true })).toBe('$0')
    })
  })

  describe('custom locale and currency', () => {
    it('formats with EUR currency', () => {
      const result = formatCents(1999, { currency: 'EUR' })
      expect(result).toContain('19.99')
    })

    it('formats with GBP currency', () => {
      const result = formatCents(1999, { currency: 'GBP' })
      expect(result).toContain('19.99')
    })

    it('formats with de-DE locale and EUR currency', () => {
      const result = formatCents(199999, { locale: 'de-DE', currency: 'EUR' })
      // German locale uses comma for decimals and period for thousands
      expect(result).toContain('1.999,99')
    })

    it('formats with custom locale and whole option', () => {
      const result = formatCents(199999, { locale: 'de-DE', currency: 'EUR', whole: true })
      expect(result).toContain('2.000')
    })

    it('uses en-US locale by default when only currency is specified', () => {
      const result = formatCents(100, { currency: 'USD' })
      expect(result).toBe('$1.00')
    })
  })

  describe('string inputs', () => {
    it('formats string "1999" as $19.99', () => {
      expect(formatCents('1999')).toBe('$19.99')
    })

    it('formats string "0" as $0.00', () => {
      expect(formatCents('0')).toBe('$0.00')
    })

    it('formats string "-500" as -$5.00', () => {
      expect(formatCents('-500')).toBe('-$5.00')
    })

    it('formats non-numeric string as $0.00', () => {
      expect(formatCents('abc')).toBe('$0.00')
    })
  })

  describe('edge cases: NaN, Infinity', () => {
    it('formats NaN as $0.00', () => {
      expect(formatCents(NaN)).toBe('$0.00')
    })

    it('formats Infinity as $0.00', () => {
      expect(formatCents(Infinity)).toBe('$0.00')
    })

    it('formats -Infinity as $0.00', () => {
      expect(formatCents(-Infinity)).toBe('$0.00')
    })
  })

  describe('very large numbers', () => {
    it('formats 10000000 cents (100k dollars)', () => {
      expect(formatCents(10000000)).toBe('$100,000.00')
    })

    it('formats 100000000 cents (1M dollars)', () => {
      expect(formatCents(100000000)).toBe('$1,000,000.00')
    })
  })
})

describe('dollarsToCents', () => {
  it('converts 1 dollar to 100 cents', () => {
    expect(dollarsToCents(1)).toBe(100)
  })

  it('converts 0 dollars to 0 cents', () => {
    expect(dollarsToCents(0)).toBe(0)
  })

  it('converts 19.99 dollars to 1999 cents', () => {
    expect(dollarsToCents(19.99)).toBe(1999)
  })

  it('converts 0.01 dollars to 1 cent', () => {
    expect(dollarsToCents(0.01)).toBe(1)
  })

  it('converts negative dollars to negative cents', () => {
    expect(dollarsToCents(-5)).toBe(-500)
  })

  it('rounds fractional cents (0.155 -> 16)', () => {
    expect(dollarsToCents(0.155)).toBe(16)
  })

  it('rounds fractional cents (0.154 -> 15)', () => {
    expect(dollarsToCents(0.154)).toBe(15)
  })

  it('handles string input "19.99"', () => {
    expect(dollarsToCents('19.99')).toBe(1999)
  })

  it('handles string input "0"', () => {
    expect(dollarsToCents('0')).toBe(0)
  })

  it('handles very large dollar amounts', () => {
    expect(dollarsToCents(1000000)).toBe(100000000)
  })
})

describe('centsToDollars', () => {
  it('converts 100 cents to 1 dollar', () => {
    expect(centsToDollars(100)).toBe(1)
  })

  it('converts 0 cents to 0 dollars', () => {
    expect(centsToDollars(0)).toBe(0)
  })

  it('converts 1999 cents to 19.99 dollars', () => {
    expect(centsToDollars(1999)).toBe(19.99)
  })

  it('converts 1 cent to 0.01 dollars', () => {
    expect(centsToDollars(1)).toBe(0.01)
  })

  it('converts negative cents to negative dollars', () => {
    expect(centsToDollars(-500)).toBe(-5)
  })

  it('handles string input "1999"', () => {
    expect(centsToDollars('1999')).toBe(19.99)
  })

  it('handles very large cent amounts', () => {
    expect(centsToDollars(100000000)).toBe(1000000)
  })
})

describe('dollarsToCents / centsToDollars round-trip', () => {
  it('round-trips 19.99', () => {
    expect(centsToDollars(dollarsToCents(19.99))).toBe(19.99)
  })

  it('round-trips 0', () => {
    expect(centsToDollars(dollarsToCents(0))).toBe(0)
  })

  it('round-trips 1', () => {
    expect(centsToDollars(dollarsToCents(1))).toBe(1)
  })

  it('round-trips 0.01', () => {
    expect(centsToDollars(dollarsToCents(0.01))).toBe(0.01)
  })

  it('round-trips 9999.99', () => {
    expect(centsToDollars(dollarsToCents(9999.99))).toBe(9999.99)
  })

  it('round-trips negative value -25.50', () => {
    expect(centsToDollars(dollarsToCents(-25.50))).toBe(-25.50)
  })
})
