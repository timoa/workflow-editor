import { useEffect, useRef, useState } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import { HiCheck, HiX } from 'react-icons/hi'
import { parseWorkflow } from '@/lib/parseWorkflow'
import { validateWorkflowYaml, type LintError } from '@/lib/workflowValidation'
import type { Workflow } from '@/types/workflow'

interface SourceCodeDialogProps {
  initialYaml: string
  onClose: () => void
  onSave: (workflow: Workflow, errors: string[]) => void
}

const yamlLanguage = StreamLanguage.define(yaml)

function getEditorTheme() {
  const isDark = document.documentElement.classList.contains('dark')
  return isDark ? [oneDark] : [syntaxHighlighting(defaultHighlightStyle)]
}

export function SourceCodeDialog({
  initialYaml,
  onClose,
  onSave,
}: SourceCodeDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lintErrors, setLintErrors] = useState<LintError[]>([])
  const [syntaxCheckValid, setSyntaxCheckValid] = useState<boolean | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const theme = EditorView.theme({
      '&': {
        backgroundColor: 'transparent',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': {
        overflow: 'auto',
        flex: 1,
        minHeight: 0,
      },
      '.cm-content': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.875rem',
        padding: '1rem',
      },
    })

    const state = EditorState.create({
      doc: initialYaml,
      extensions: [
        yamlLanguage,
        ...getEditorTheme(),
        keymap.of(defaultKeymap),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) setSyntaxCheckValid(null)
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: container,
    })
    viewRef.current = view
    view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const getYaml = () => viewRef.current?.state.doc.toString() ?? ''

  const handleSave = () => {
    setSaveError(null)
    const yamlContent = getYaml()
    const { workflow, errors } = parseWorkflow(yamlContent)
    const isParseError =
      errors.length > 0 &&
      (errors[0].includes('YAML parse error') || errors[0].includes('Invalid workflow'))
    if (isParseError) {
      setSaveError(errors[0])
      setSyntaxCheckValid(false)
      return
    }
    const lintErrs = validateWorkflowYaml(yamlContent)
    setLintErrors(lintErrs)
    onSave(workflow, errors)
    onClose()
  }

  const handleLint = () => {
    setSaveError(null)
    const yamlContent = getYaml()
    const { errors } = parseWorkflow(yamlContent)
    const isParseError =
      errors.length > 0 &&
      (errors[0].includes('YAML parse error') || errors[0].includes('Invalid workflow'))
    if (isParseError) {
      setSaveError(errors[0])
      setLintErrors([])
      setSyntaxCheckValid(false)
      return
    }
    const lintErrs = validateWorkflowYaml(yamlContent)
    setLintErrors(lintErrs)
    setSyntaxCheckValid(lintErrs.length === 0)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-dialog-title"
      onClick={handleBackdropClick}
    >
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white dark:bg-slate-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 id="source-dialog-title" className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Workflow source (YAML)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Edit the YAML below. The flow diagram updates only when you click Save.
          </p>
          <button
            type="button"
            onClick={handleLint}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
          >
            {syntaxCheckValid === true && (
              <HiCheck className="shrink-0 text-green-600 dark:text-green-400" size={14} aria-hidden />
            )}
            {syntaxCheckValid === false && (
              <HiX className="shrink-0 text-red-600 dark:text-red-400" size={14} aria-hidden />
            )}
            Check syntax
          </button>
        </div>
        <div
          ref={containerRef}
          className="flex-1 min-h-0 flex flex-col rounded-none border-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden"
          aria-label="Workflow YAML content"
        />
        {(saveError || lintErrors.length > 0) && (
          <div
            role="alert"
            className="border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 max-h-40 overflow-y-auto"
          >
            {saveError && <div className="mb-2 font-medium">{saveError}</div>}
            {lintErrors.length > 0 && (
              <div>
                <div className="mb-1 font-medium">
                  {lintErrors.length} lint error{lintErrors.length !== 1 ? 's' : ''}:
                </div>
                <ul className="ml-4 list-disc space-y-0.5 text-xs">
                  {lintErrors.map((error, idx) => (
                    <li key={`${error.path ?? ''}-${error.message}-${idx}`}>
                      <span className={error.severity === 'error' ? 'font-medium' : ''}>
                        {error.path && <code className="text-xs">{error.path}:</code>} {error.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-slate-800 dark:bg-slate-700 px-3 py-1.5 text-sm text-white dark:text-slate-200 hover:bg-slate-700 dark:hover:bg-slate-600"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
