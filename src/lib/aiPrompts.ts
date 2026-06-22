// "Ask AI" prompt cards an insight can opt into. Keys must match the generator's
// AI_PROMPTS library in build-insights.py.
export const AI_PROMPT_OPTIONS: { key: string; label: string }[] = [
  { key: 'tr19', label: 'Do I need TR19 kitchen extract cleaning?' },
  { key: 'report', label: 'Explain my compliance report' },
  { key: 'inspection', label: 'What to do after a failed inspection' },
  { key: 'insurance', label: 'Compliance evidence for insurance & fire risk' },
  { key: 'pre-call', label: 'Prepare for a compliance visit' },
]
