import type { ReactNode } from 'react';

/**
 * Uniform page header used at the top of every page/role view.
 * Guarantees identical title sizing and right-aligned primary actions.
 */
export interface PageHeaderProps {
  /** Page title — rendered at the shared `title` typographic scale. */
  title: string;
  /** Optional supporting copy under the title. */
  description?: ReactNode;
  /** Small label rendered above the title (e.g. a breadcrumb or role). */
  eyebrow?: ReactNode;
  /** Right-aligned primary controls (buttons, toolbars, status, etc.). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={['ui-page-header', className ?? ''].filter(Boolean).join(' ')}>
      <div className="ui-page-header__text">
        {eyebrow ? <span className="ui-page-header__eyebrow">{eyebrow}</span> : null}
        <h1 className="ui-page-header__title">{title}</h1>
        {description ? <p className="ui-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </header>
  );
}
