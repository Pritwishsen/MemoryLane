import { GUEST_STATUS_CLASS, GUEST_STATUS_LABEL, type GuestStatus } from "./styles";

export default function StatusChip({ status, className = "" }: { status: GuestStatus; className?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${GUEST_STATUS_CLASS[status]} ${className}`}
    >
      {GUEST_STATUS_LABEL[status]}
    </span>
  );
}
