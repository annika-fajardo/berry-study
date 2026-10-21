// Renders the Berry component to a standalone SVG (CSS variables resolved to palette colours).
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// tsx compiles JSX with the classic runtime, so React must be global for the imported component
;(globalThis as unknown as { React: typeof React }).React = React
import { CatHead } from '../src/components/Cat'
const VARS: Record<string, string> = {}
export function berrySvg(opts: { bg?: string; pad?: number; size?: number }) {
  let inner = renderToStaticMarkup(<CatHead size={64} tile={false} />)
  inner = inner.replace(/var\((--[a-z0-9-]+)\)/g, (_, v) => VARS[v] || '#000').replace(/ class="[^"]*"/g, '').replace(/ role="img"/, '').replace(/ aria-label="[^"]*"/, '')
  const body = inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const pad = opts.pad ?? 0, vb = 64 + pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${vb} ${vb}" width="${opts.size || 512}" height="${opts.size || 512}">${opts.bg ? `<rect x="${-pad}" y="${-pad}" width="${vb}" height="${vb}" rx="${opts.bg === 'none' ? 0 : 10}" fill="${opts.bg}"/>` : ''}${body}</svg>`
}
