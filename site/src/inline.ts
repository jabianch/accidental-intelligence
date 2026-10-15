// Copy may carry *emphasis*; everything else stays plain text.
export function inline(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
}
