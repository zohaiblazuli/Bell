/**
 * NavSidebar (Design System v2) — §3 (Information Architecture) / §8.3. A config-driven, collapsible
 * primary navigation rail. The structure comes from `navConfig` (or the caller's own `groups`); this
 * component is a pure view over it.
 *
 * Layout is a vertical flex column: an optional `header` slot, a scrollable stack of nav groups
 * (each an eyebrow `.t-micro` caption + its rows), an optional `footer` slot (mascot / update pill),
 * and the `utility` items pinned to the bottom. Selection is a SUBTLE accent tint — a
 * `--surface-selected` fill, `--accent` text/icon and a 2px left indicator — never a saturated block.
 *
 * Collapsed (52px): labels, group captions and badges fade out while every icon holds its x-position
 * (constant left padding + an absolutely-positioned indicator), so nothing shifts sideways. The fade
 * is a transition gated under `prefers-reduced-motion: no-preference`; the hidden end-state itself
 * applies in every case, so reduced-motion users get an instant, non-jumping collapse.
 */
import { type ReactNode } from 'react';
import Icon from '../../components/Icon';
import Badge from '@ui/v2/Badge';
import { NAV_GROUPS, NAV_UTILITY, type NavGroup, type NavItem } from './navConfig';
import './NavSidebar.css';

export interface NavSidebarProps {
  /** Labelled nav groups. Defaults to the static §3 IA. */
  groups?: NavGroup[];
  /** Bottom-anchored utility items (Settings, Help). Defaults to the static §3 list. */
  utility?: NavItem[];
  /** Id of the currently active item — matched against `NavItem.id`. */
  activeId: string;
  onNavigate: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Brand / logo slot at the very top. */
  header?: ReactNode;
  /** Slot above the utility items (e.g. mascot or an update pill). */
  footer?: ReactNode;
  /** Dynamic "Pinned Subjects" group, rendered after the last group and before utility. */
  pinned?: NavItem[];
  className?: string;
}

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={['v2-nav__item', 't-ui', active && 'is-active'].filter(Boolean).join(' ')}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      onClick={() => onNavigate(item.id)}
    >
      <span className="v2-nav__indicator" aria-hidden="true" />
      <span className="v2-nav__icon" aria-hidden="true">
        <Icon name={item.icon} />
      </span>
      <span className="v2-nav__label">{item.label}</span>
      {item.badge != null ? (
        <Badge className="v2-nav__badge" tone="neutral">
          {item.badge}
        </Badge>
      ) : null}
    </button>
  );
}

function NavGroupBlock({
  group,
  activeId,
  collapsed,
  onNavigate,
}: {
  group: NavGroup;
  activeId: string;
  collapsed: boolean;
  onNavigate: (id: string) => void;
}) {
  return (
    <div className="v2-nav__group" role="group" aria-label={group.label}>
      {group.label ? <div className="v2-nav__grouplabel t-micro">{group.label}</div> : null}
      {group.items.map((item) => (
        <NavRow
          key={item.id}
          item={item}
          active={item.id === activeId}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

export default function NavSidebar({
  groups = NAV_GROUPS,
  utility = NAV_UTILITY,
  activeId,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  header,
  footer,
  pinned,
  className,
}: NavSidebarProps) {
  return (
    <nav
      className={['v2-nav', collapsed && 'is-collapsed', className].filter(Boolean).join(' ')}
      data-collapsed={collapsed || undefined}
      aria-label="Primary"
    >
      {header || onToggleCollapse ? (
        <div className="v2-nav__header">
          {header ? <div className="v2-nav__brand">{header}</div> : null}
          {onToggleCollapse ? (
            <button
              type="button"
              className="v2-nav__toggle"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={onToggleCollapse}
            >
              <Icon name="chev" className="v2-nav__toggle-icon" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="v2-nav__scroll">
        {groups.map((group) => (
          <NavGroupBlock
            key={group.id}
            group={group}
            activeId={activeId}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}

        {pinned && pinned.length > 0 ? (
          <NavGroupBlock
            group={{ id: 'pinned-subjects', label: 'Pinned Subjects', items: pinned }}
            activeId={activeId}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>

      {footer ? <div className="v2-nav__footer">{footer}</div> : null}

      {utility.length > 0 ? (
        <div className="v2-nav__utility" role="group" aria-label="Utility">
          {utility.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              active={item.id === activeId}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </nav>
  );
}
