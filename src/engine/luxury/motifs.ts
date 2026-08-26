import type { LuxuryCustomShape, LuxuryShapeCategory } from './types'

export type LuxuryMotif = {
  id: string
  name: string
  category: LuxuryShapeCategory
  roles: string[]
  body: string
  originalColors?: string[]
  sourceViewBox?: string
}

export const LUXURY_MOTIFS: LuxuryMotif[] = [
  { id: 'quatrefoil-01', name: 'Quatrefoil', category: 'main', roles: ['primary','accent'], body: '<path fill="{{primary}}" d="M50 7C61 7 69 16 69 27c11 0 20 9 20 20s-9 20-20 20c0 11-8 20-19 20s-19-9-19-20c-11 0-20-9-20-20s9-20 20-20C31 16 39 7 50 7Z"/><path fill="{{accent}}" d="M50 31 67 48 50 65 33 48Z"/>' },
  { id: 'diamond-bloom', name: 'Diamond Bloom', category: 'main', roles: ['primary','secondary','accent'], body: '<path fill="{{primary}}" d="M50 5 95 50 50 95 5 50Z"/><path fill="{{secondary}}" d="M50 20c7 11 15 15 26 18-11 5-16 11-18 23-5-10-10-15-22-18 9-5 13-11 14-23Z"/><circle cx="50" cy="50" r="7" fill="{{accent}}"/>' },
  { id: 'rosette-01', name: 'Rosette', category: 'main', roles: ['primary','secondary'], body: '<path fill="{{primary}}" d="M50 8c7 12 12 14 24 10-4 12-2 18 10 25-12 6-15 11-12 24-13-3-18 0-24 12-7-12-12-14-24-10 4-12 2-18-10-25 12-6 15-11 12-24 13 3 18 0 24-12Z"/><circle cx="50" cy="50" r="19" fill="{{secondary}}"/>' },
  { id: 'petal-star', name: 'Petal Star', category: 'main', roles: ['primary','accent'], body: '<path fill="{{primary}}" d="M50 6 59 36 87 23 64 45 94 50 64 55 87 77 59 64 50 94 41 64 13 77 36 55 6 50 36 45 13 23 41 36Z"/><circle cx="50" cy="50" r="10" fill="{{accent}}"/>' },
  { id: 'deco-emblem', name: 'Art Deco Emblem', category: 'main', roles: ['primary','secondary'], body: '<path fill="{{primary}}" d="M50 6 86 30 76 80 50 94 24 80 14 30Z"/><path fill="{{secondary}}" d="M50 20 70 36 63 68 50 80 37 68 30 36Z"/>' },
  { id: 'laurel-emblem', name: 'Laurel Emblem', category: 'main', roles: ['primary','accent'], body: '<path fill="none" stroke="{{primary}}" stroke-width="7" stroke-linecap="round" d="M48 83C22 72 16 48 27 24M52 83c26-11 32-35 21-59"/><path fill="{{primary}}" d="m27 29-15 3 11 9Zm-4 17-15 7 15 5Zm5 18-11 11 17 1Zm46-35 14 3-11 9Zm4 17 14 7-15 5Zm-5 18 12 11-17 1Z"/><circle cx="50" cy="50" r="12" fill="{{accent}}"/>' },
  { id: 'knot-emblem', name: 'Geometric Knot', category: 'main', roles: ['primary','secondary'], body: '<path fill="none" stroke="{{primary}}" stroke-width="12" d="M20 50 50 20 80 50 50 80Z"/><path fill="none" stroke="{{secondary}}" stroke-width="7" d="M33 50 50 33 67 50 50 67Z"/>' },
  { id: 'crest-abstract', name: 'Abstract Crest', category: 'main', roles: ['primary','secondary','accent'], body: '<path fill="{{primary}}" d="M50 6 84 20v27c0 22-13 38-34 47C29 85 16 69 16 47V20Z"/><path fill="{{secondary}}" d="M50 22 68 31v16c0 12-6 21-18 28-12-7-18-16-18-28V31Z"/><path fill="{{accent}}" d="m50 31 5 11 12 2-9 8 2 12-10-6-10 6 2-12-9-8 12-2Z"/>' },

  { id: 'tiny-diamond', name: 'Tiny Diamond', category: 'filler', roles: ['primary'], body: '<path fill="{{primary}}" d="M50 14 86 50 50 86 14 50Z"/>' },
  { id: 'mini-flower', name: 'Mini Flower', category: 'filler', roles: ['primary','accent'], body: '<path fill="{{primary}}" d="M50 18c8 0 13 7 13 15 8-4 17 0 19 8 2 8-4 15-12 17 7 5 8 15 2 21-6 6-15 5-21-2-4 8-14 11-21 6-7-5-7-14-1-21-9 0-16-6-16-14 0-8 7-14 16-14-5-8-2-17 6-21 8-4 16 0 18 9 4-7 7-10 13-10Z"/><circle cx="50" cy="50" r="8" fill="{{accent}}"/>' },
  { id: 'bead', name: 'Bead', category: 'filler', roles: ['primary'], body: '<circle cx="50" cy="50" r="24" fill="{{primary}}"/>' },
  { id: 'four-petal', name: 'Four Petal', category: 'filler', roles: ['primary'], body: '<path fill="{{primary}}" d="M50 14c12 10 14 20 0 36-14-16-12-26 0-36Zm36 36c-10 12-20 14-36 0 16-14 26-12 36 0ZM50 86c-12-10-14-20 0-36 14 16 12 26 0 36ZM14 50c10-12 20-14 36 0-16 14-26 12-36 0Z"/>' },
  { id: 'mini-star', name: 'Mini Star', category: 'filler', roles: ['primary'], body: '<path fill="{{primary}}" d="m50 12 10 25 27 2-21 17 7 27-23-15-23 15 7-27-21-17 27-2Z"/>' },
  { id: 'mini-leaf', name: 'Mini Leaf', category: 'filler', roles: ['primary'], body: '<path fill="{{primary}}" d="M17 65C28 31 50 17 82 18 80 49 62 73 25 82c14-15 28-27 44-37-20 7-35 14-52 20Z"/>' },
]

export const MAIN_LUXURY_MOTIFS = LUXURY_MOTIFS.filter((item) => item.category === 'main')
export const FILLER_LUXURY_MOTIFS = LUXURY_MOTIFS.filter((item) => item.category === 'filler')

export function resolveLuxuryMotif(id: string, customShapes: LuxuryCustomShape[] = []): LuxuryMotif {
  const custom = customShapes.find((item) => item.id === id)
  if (custom) return custom
  return LUXURY_MOTIFS.find((item) => item.id === id) ?? LUXURY_MOTIFS[0]
}

export function luxuryMotifById(id: string) {
  return resolveLuxuryMotif(id)
}
