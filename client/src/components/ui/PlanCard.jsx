import { Check, Layers, Flame, Sparkles, Crown, Star, Gem } from 'lucide-react';

// Floating-avatar pricing card: icon badge peeking above the top-left corner,
// a ribbon price tag in the top-right, and a checklist body (the shape from
// the reference design).
const PLAN_CARD_THEMES = [
  { from: '#60a5fa', to: '#2563eb', icon: Layers },
  { from: '#fb923c', to: '#ea580c', icon: Flame },
  { from: '#2dd4bf', to: '#0d9488', icon: Sparkles },
  { from: '#a78bfa', to: '#7c3aed', icon: Crown },
  { from: '#f472b6', to: '#db2777', icon: Star },
  { from: '#fbbf24', to: '#d97706', icon: Gem },
];

export const planCardColor = (index) => PLAN_CARD_THEMES[index % PLAN_CARD_THEMES.length];

const RIBBON_CLIP = 'polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)';

const PlanCard = ({ color, title, statusLabel, statusActive = true, price, priceSuffix, metaBadges, lines, actions, dimmed }) => {
  const theme = color || PLAN_CARD_THEMES[0];
  const Icon = theme.icon;
  const gradient = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;

  return (
    <div className={`relative mt-6 transition-opacity ${dimmed ? 'opacity-60' : ''}`}>
      {/* Icon badge, floating above the card's top-left corner */}
      <div className="absolute -top-6 left-6 z-10 w-12 h-12 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center">
        <Icon className="h-5 w-5" style={{ color: theme.to }} />
      </div>

      {/* Ribbon price tag, top-right */}
      <div className="absolute -top-3 right-6 z-10 w-14 text-center shadow-md" style={{ clipPath: RIBBON_CLIP, background: gradient }}>
        <p className="text-white text-sm font-bold leading-tight pt-3">{price}</p>
        <p className="text-white/80 text-[9px] leading-tight pb-4">{priceSuffix}</p>
      </div>

      <div className="bg-white shadow-lg pt-9 px-6 pb-6 flex flex-col h-full">
        <p className={`text-[11px] font-semibold tracking-wide uppercase ${statusActive ? 'text-green-600' : 'text-gray-400'}`}>
          {statusLabel}
        </p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1 truncate">{title}</h3>

        {metaBadges?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{metaBadges}</div>}

        <ul className="mt-4 space-y-2.5 flex-1">
          {lines?.length > 0 ? (
            lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: theme.to }} />
                <span className="leading-snug">{line}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-300 italic">No features added</li>
          )}
        </ul>

        {actions?.length > 0 && (
          <div className="mt-6 flex gap-2">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                style={i === 0 ? { background: gradient } : undefined}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${
                  i === 0 ? 'text-white hover:brightness-110 shadow-md' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanCard;
