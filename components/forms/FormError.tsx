/** Announced banner at the top of a form when a save was refused. */
export function FormError({ show, message }: { show: boolean; message: string }) {
  return (
    <div role="alert" aria-live="assertive">
      {show ? (
        <p className="rounded-field bg-due-soft px-4 py-3 text-[15px] font-semibold text-due">
          {message}
        </p>
      ) : null}
    </div>
  );
}
