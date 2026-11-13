import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { NavItem } from './NavLinks';

type NavAnchorProps = {
  item: NavItem;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
  onNavigate?: () => void;
  children?: ReactNode;
};

/**
 * A navigation link. Out-of-scope pages ("Tournaments", "Community") render as plain anchors that
 * navigate to the home page, so they are never reported as the current page.
 */
export function NavAnchor({
  item,
  className,
  activeClassName,
  inactiveClassName,
  onNavigate,
  children,
}: NavAnchorProps) {
  const navigate = useNavigate();

  if (item.redirectsHome) {
    return (
      <a
        className={`${className} ${inactiveClassName}`}
        href="/"
        onClick={(event) => {
          event.preventDefault();
          onNavigate?.();
          void navigate({ to: '/' });
        }}
      >
        {children ?? item.label}
      </a>
    );
  }

  return (
    <Link
      activeOptions={{ exact: true }}
      activeProps={{ className: activeClassName }}
      className={className}
      inactiveProps={{ className: inactiveClassName }}
      onClick={onNavigate}
      to={item.to}
    >
      {children ?? item.label}
    </Link>
  );
}
