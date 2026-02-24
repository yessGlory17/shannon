const MODELS = ['sonnet', 'opus', 'haiku']

interface BasicInfoStepProps {
  form: {
    name: string
    description: string
    model: string
  }
  onChange: (updates: Partial<{ name: string; description: string; model: string }>) => void
  nameError: boolean
}

export function BasicInfoStep({ form, onChange, nameError }: BasicInfoStepProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Go Developer"
            className={`w-full bg-zinc-800 border rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 ${
              nameError ? 'border-red-500/50' : 'border-zinc-700'
            }`}
          />
          {nameError && (
            <p className="text-xs text-red-400 mt-1">Name is required</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Model</label>
          <select
            value={form.model}
            onChange={(e) => onChange({ model: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Description</label>
        <input
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Specializes in Go backend development"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>
    </div>
  )
}
