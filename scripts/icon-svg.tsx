// Renders the Berry component to a standalone SVG (CSS variables resolved to palette colours).
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// tsx compiles JSX with the classic runtime, so React must be global for the imported component
;(globalThis as unknown as { React: typeof React }).React = React
import { Berry } from '../src/components/Characters'
const VARS: Record<string, string> = {
  '--char-ink': '#2D2B22', '--sticker': '#FFFCF7', '--berry': '#C66F80', '--berry-hi': '#F4C7D0', '--seed': '#FCEBF1', '--cheek': '#F7A7B7',
  '--leaf': '#9FAA74', '--leaf-dark': '#4A6644', '--mouth': '#7E3446', '--gold': '#E9C77B', '--sparkle': '#F4C7D0', '--c477': '#4A6644', '--drop': '#CFE1EC', '--oat': '#ECE3D2',
}
export function berrySvg(opts: { bg?: string; pad?: number; size?: number }) {
  let inner = renderToStaticMarkup(<Berry mood="happy" size={120} sticker />)
  inner = inner.replace(/var\((--[a-z0-9-]+)\)/g, (_, v) => VARS[v] || '#000').replace(/ class="[^"]*"/g, '').replace(/ role="img"/, '').replace(/ aria-label="[^"]*"/, '')
  const body = inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const pad = opts.pad ?? 0, vb = 124 + pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad - 2} ${-pad - 2} ${vb + 4} ${vb + 4}" width="${opts.size || 512}" height="${opts.size || 512}">${opts.bg ? `<rect x="${-pad - 2}" y="${-pad - 2}" width="${vb + 4}" height="${vb + 4}" fill="${opts.bg}"/>` : ''}${body}</svg>`
}
