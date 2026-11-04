"use client";

type Props = { label: string; message: string; className?: string };

export function ConfirmSubmitButton({ label, message, className }: Props) {
  return <button className={className} type="submit" onClick={(event) => {
    if (!window.confirm(message)) event.preventDefault();
  }}>{label}</button>;
}
