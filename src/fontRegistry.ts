import type { TextDirection, TextScript } from './types'

export type FontRegistryItem = {
  id: string
  label: string
  family: string
  script: TextScript
  category: 'display' | 'neutral'
  weights: number[]
  license: 'SIL OFL 1.1'
  source: string
}

export const FONT_REGISTRY: FontRegistryItem[] = [
  {
    id: 'baloo-2',
    label: 'Baloo 2',
    family: 'Baloo 2',
    script: 'latin',
    category: 'display',
    weights: [400, 500, 600, 700, 800],
    license: 'SIL OFL 1.1',
    source: 'Google Fonts / Ek Type',
  },
  {
    id: 'noto-sans-devanagari',
    label: 'Noto Sans Devanagari',
    family: 'Noto Sans Devanagari',
    script: 'devanagari',
    category: 'neutral',
    weights: [400, 500, 600, 700],
    license: 'SIL OFL 1.1',
    source: 'Google Fonts / Noto',
  },
  {
    id: 'baloo-2-devanagari',
    label: 'Baloo 2',
    family: 'Baloo 2',
    script: 'devanagari',
    category: 'display',
    weights: [400, 500, 600, 700, 800],
    license: 'SIL OFL 1.1',
    source: 'Google Fonts / Ek Type',
  },
  {
    id: 'cairo',
    label: 'Cairo',
    family: 'Cairo',
    script: 'arabic',
    category: 'neutral',
    weights: [400, 500, 600, 700],
    license: 'SIL OFL 1.1',
    source: 'Google Fonts / Mohamed Gaber',
  },
  {
    id: 'reem-kufi',
    label: 'Reem Kufi',
    family: 'Reem Kufi',
    script: 'arabic',
    category: 'display',
    weights: [400, 500, 600, 700],
    license: 'SIL OFL 1.1',
    source: 'Google Fonts',
  },
  {
    id: 'zcool-kuaile',
    label: 'ZCOOL KuaiLe',
    family: 'ZCOOL KuaiLe',
    script: 'zh-hans',
    category: 'display',
    weights: [400],
    license: 'SIL OFL 1.1',
    source: 'Google Fonts / ZCOOL',
  },
  {
    id: 'black-han-sans',
    label: 'Black Han Sans',
    family: 'Black Han Sans',
    script: 'korean',
    category: 'display',
    weights: [400],
    license: 'SIL OFL 1.1',
    source: 'Google Fonts / Black Han Sans Project',
  },
  {
    id: 'dela-gothic-one',
    label: 'Dela Gothic One',
    family: 'Dela Gothic One',
    script: 'japanese',
    category: 'display',
    weights: [400],
    license: 'SIL OFL 1.1',
    source: 'Google Fonts / Dela Gothic Project',
  },
]

export const SCRIPT_LABELS: Record<TextScript, string> = {
  latin: 'Latin / English',
  devanagari: 'Devanagari / Hindi',
  arabic: 'Arabic',
  'zh-hans': 'Chinese (Simplified)',
  korean: 'Korean',
  japanese: 'Japanese',
}

export const SCRIPT_DEFAULTS: Record<TextScript, { text: string; fontFamily: string; direction: TextDirection }> = {
  latin: { text: 'HAPPY DIWALI', fontFamily: 'Baloo 2', direction: 'ltr' },
  devanagari: { text: 'शुभ दीपावली', fontFamily: 'Noto Sans Devanagari', direction: 'ltr' },
  arabic: { text: 'عيد مبارك', fontFamily: 'Reem Kufi', direction: 'rtl' },
  'zh-hans': { text: '新年快乐', fontFamily: 'ZCOOL KuaiLe', direction: 'ltr' },
  korean: { text: '새해 복 많이 받으세요', fontFamily: 'Black Han Sans', direction: 'ltr' },
  japanese: { text: '明けましておめでとうございます', fontFamily: 'Dela Gothic One', direction: 'ltr' },
}

export function fontsForScript(script: TextScript) {
  return FONT_REGISTRY.filter((font) => font.script === script)
}

export function fontByFamily(family: string, script?: TextScript) {
  return FONT_REGISTRY.find((font) => font.family === family && (!script || font.script === script)) ?? FONT_REGISTRY.find((font) => font.family === family)
}
