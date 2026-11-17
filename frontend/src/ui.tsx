/*
 * Presentation primitives shared by every screen. They add no behaviour beyond
 * markup, classes and accessibility wiring. Styles live in styles/components.css.
 * See frontend/DESIGN.md before adding props.
 */
import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';

export type { LucideIcon } from 'lucide-react';

function classes(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ');
}

/* Icon: always decorative, so accessible names stay exactly the catalog strings. */

export interface IconProps {
  /** A lucide-react icon component, imported by name where it is used. */
  icon: LucideIcon;
  /** Pixel size; defaults to 18. */
  size?: number;
  className?: string;
}

export function Icon({ icon: Glyph, size = 18, className }: IconProps) {
  return (
    <Glyph
      className={classes('icon', className)}
      size={size}
      strokeWidth={1.75}
      aria-hidden="true"
      focusable="false"
    />
  );
}

/* Button */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the one main action. quiet (default): everything else. danger: destructive. */
  variant?: 'primary' | 'quiet' | 'danger';
  /** sm keeps the 44px touch target but tightens padding and type. */
  size?: 'md' | 'sm';
  /** Leading decorative icon. */
  icon?: LucideIcon;
  /** Stretch to the container's inline size. */
  block?: boolean;
}

/** A real button element. `type` defaults to "button"; pass "submit" inside forms. */
export function Button({
  variant = 'quiet',
  size = 'md',
  icon,
  block = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(
        'btn',
        `btn--${variant}`,
        size === 'sm' && 'btn--sm',
        block && 'btn--block',
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} />}
      {children}
    </button>
  );
}

/* Field: label + one control + hint + error */

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export interface FieldProps {
  /** Visible label. Its text is the control's exact accessible name. */
  label: string;
  /** Keep the label for assistive technology only. */
  hideLabel?: boolean;
  /** Supporting text, linked with aria-describedby (never part of the name). */
  hint?: ReactNode;
  /** Error text. When set the control gets aria-invalid. */
  error?: ReactNode;
  className?: string;
  /** Exactly one input, select or textarea element. */
  children: ReactElement<ControlProps>;
}

export function Field({ label, hideLabel = false, hint, error, className, children }: FieldProps) {
  const generated = useId();
  const id = children.props.id ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={classes('field', className)}>
      <label className={classes('field__label', hideLabel && 'sr-only')} htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })}
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

/* Check: a checkbox row */

export interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label content. Its text is the checkbox's exact accessible name. */
  label: ReactNode;
  /** Supporting text outside the label, linked with aria-describedby. */
  hint?: ReactNode;
}

export function Check({ label, hint, className, id, ...rest }: CheckProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className={classes('check', className)}>
      <label className="check__row" htmlFor={inputId}>
        <input type="checkbox" id={inputId} aria-describedby={hintId} {...rest} />
        <span className="check__label">{label}</span>
      </label>
      {hint && (
        <p className="check__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

/* Section: a titled block, optionally a named region */

export interface SectionProps {
  /** Heading text. */
  title: ReactNode;
  /** Heading level; defaults to 2. */
  level?: 2 | 3;
  /** Sets aria-label, which makes the section a region with exactly this name. */
  ariaLabel?: string;
  /** Short supporting text under the heading. */
  description?: ReactNode;
  /** Controls aligned with the heading (a refresh button, a chip). */
  actions?: ReactNode;
  /** Draw the section as the one raised surface on a screen. Use sparingly. */
  raised?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Section({
  title,
  level = 2,
  ariaLabel,
  description,
  actions,
  raised = false,
  className,
  children,
}: SectionProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section
      className={classes('section', raised && 'section--raised', className)}
      aria-label={ariaLabel}
    >
      <div className="section__head">
        <Heading className="section__title">{title}</Heading>
        {actions && <div className="section__actions">{actions}</div>}
      </div>
      {description && <p className="section__description">{description}</p>}
      {children}
    </section>
  );
}

/* Chip: a status, never a button */

export interface ChipProps {
  /** neutral: plain fact. action: positive or done. lamp: now, pending, attention. danger: failed or blocked. */
  tone?: 'neutral' | 'action' | 'lamp' | 'danger';
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}

export function Chip({ tone = 'neutral', icon, className, children }: ChipProps) {
  return (
    <span className={classes('chip', `chip--${tone}`, className)}>
      {icon && <Icon icon={icon} size={14} />}
      {children}
    </span>
  );
}

/* Notice: inline message. The caller decides whether it is announced. */

export interface NoticeProps {
  tone?: 'info' | 'warning' | 'error';
  /** Pass "status" for polite updates or "alert" for errors; omit for static text. */
  role?: 'status' | 'alert';
  icon?: LucideIcon;
  /** Buttons that resolve the notice (retry, dismiss). */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Notice({ tone = 'info', role, icon, actions, className, children }: NoticeProps) {
  return (
    <div className={classes('notice', `notice--${tone}`, className)} role={role}>
      {icon && <Icon icon={icon} className="notice__icon" />}
      <div className="notice__body">{children}</div>
      {actions && <div className="notice__actions">{actions}</div>}
    </div>
  );
}

/* EmptyState: says what is missing and invites the next action */

export interface EmptyStateProps {
  icon?: LucideIcon;
  /** Optional button or link that starts the invited action. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function EmptyState({ icon, action, className, children }: EmptyStateProps) {
  return (
    <div className={classes('empty', className)}>
      {icon && <Icon icon={icon} size={22} className="empty__icon" />}
      <p className="empty__text">{children}</p>
      {action}
    </div>
  );
}

/* ConfirmDialog: native modal dialog for anything that needs a second look */

export interface ConfirmDialogProps {
  /** Opens with showModal() when true; closes when false. */
  open: boolean;
  /** Dialog heading and exact accessible name. */
  title: string;
  /** Label of the confirming button. */
  confirmLabel: string;
  /** Label of the cancelling button. */
  cancelLabel: string;
  /** Style of the confirming button. */
  tone?: 'primary' | 'danger';
  /** Disables both buttons and makes Escape a no-op while work is in flight. */
  busy?: boolean;
  /** Disables only the confirming button. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  /** Called by the cancel button and by Escape (unless busy). */
  onCancel: () => void;
  className?: string;
  /** The explanation and any review content. */
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  className,
  children,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      // Return focus to whatever opened the dialog, if it still exists.
      if (opener.current?.isConnected) opener.current.focus();
      opener.current = null;
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={classes('dialog', className)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Keep React state the single authority over whether the dialog is open.
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      {open && (
        <>
          <h2 className="dialog__title" id={titleId}>
            {title}
          </h2>
          <div className="dialog__body">{children}</div>
          <div className="dialog__actions">
            <Button variant={tone} disabled={busy || confirmDisabled} onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <Button disabled={busy} onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
