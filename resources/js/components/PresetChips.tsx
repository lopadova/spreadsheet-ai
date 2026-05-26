import { PRESETS } from '../lib/presets';

interface PresetChipsProps {
    active: string;
    onPick: (id: string) => void;
}

export function PresetChips({ active, onPick }: PresetChipsProps) {
    return (
        <div className="preset-chips" role="tablist" aria-label="Preset scenarios">
            {PRESETS.map((p) => {
                const isActive = active === p.id;
                return (
                    <button
                        key={p.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`preset-chip ${isActive ? 'active' : ''}`}
                        onClick={() => onPick(p.id)}
                    >
                        <span className="preset-chip-emoji" aria-hidden="true">
                            {p.emoji}
                        </span>
                        <span className="preset-chip-body">
                            <span className="preset-chip-label">{p.label}</span>
                            <span className="preset-chip-sub">{p.sub}</span>
                        </span>
                        {isActive && <span className="preset-chip-active-dot" aria-hidden="true" />}
                    </button>
                );
            })}
        </div>
    );
}
