import { useState } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { TEMPLATES, type TemplateId } from '../../data/templates'

export function NewTreeDialog() {
  const isOpen = useTreeStore((s) => s.isNewTreeOpen)
  const close = useTreeStore((s) => s.closeNewTreeDialog)
  const createTree = useTreeStore((s) => s.createTree)

  const [name, setName] = useState('Untitled Industrial Tree')
  const [template, setTemplate] = useState<TemplateId>('empty')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={close}>
      <div
        className="w-[420px] border border-[var(--ink-400)] bg-[var(--paper)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--ink-200)] px-4 py-2.5">
          <h2 className="font-technical text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-900)]">
            New Industrial Tree
          </h2>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <label className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-[var(--ink-300)] bg-[var(--paper)] px-2 py-1.5 text-[13px] text-[var(--ink-900)] outline-none focus:border-[var(--ink-700)]"
            />
          </div>

          <div>
            <div className="mb-1.5 font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
              Template
            </div>
            <div className="space-y-1.5">
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-start gap-2.5 border px-2.5 py-2 ${
                    template === t.id
                      ? 'border-[var(--ink-800)] bg-[var(--ink-50)]'
                      : 'border-[var(--ink-200)] hover:border-[var(--ink-400)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    checked={template === t.id}
                    onChange={() => setTemplate(t.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[var(--ink-900)]">{t.label}</div>
                    <div className="text-[11.5px] text-[var(--ink-500)]">{t.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--ink-200)] px-4 py-2.5">
          <button onClick={close} className="px-3 py-1.5 text-[12.5px] text-[var(--ink-600)] hover:text-[var(--ink-900)]">
            Cancel
          </button>
          <button
            onClick={() => createTree(name, template)}
            className="bg-[var(--ink-900)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--paper)] hover:bg-[var(--ink-700)]"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
