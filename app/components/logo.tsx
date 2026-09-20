/** Bowl-and-sprig brand mark. The bowl inherits the current text colour. */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path d="M7 25h34a17 17 0 0 1-34 0z" className="fill-current" />
      <g className="fill-caramel-500 dark:fill-caramel-400">
        <path d="M24 21c0-8 5-13 13-13 0 8-5 13-13 13z" />
        <path d="M22 21c0-5-3-8-8-8 0 5 3 8 8 8z" />
      </g>
    </svg>
  );
}
