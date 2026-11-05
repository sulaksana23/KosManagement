"use client";

type Props = { label: string; message: string; className?: string; name?: string; value?: string };

export function ConfirmSubmitButton({ label, message, className, name, value }: Props) {
  return <button className={className} type="submit" name={name} value={value} onClick={(event) => {
    if (!window.confirm(message)) event.preventDefault();
  }}>{label}</button>;
}