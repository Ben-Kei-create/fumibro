type VCardInput = {
  address: string | null;
  displayName: string;
  email: string | null;
  jobTitle: string | null;
  links: Array<{ label: string; url: string }>;
  note: string | null;
  organization: string | null;
  phone: string | null;
  website: string | null;
};

function escapeVCard(value: string) {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

export function createVCard(input: VCardInput) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `FN:${escapeVCard(input.displayName)}`,
  ];
  if (input.organization) lines.push(`ORG:${escapeVCard(input.organization)}`);
  if (input.jobTitle) lines.push(`TITLE:${escapeVCard(input.jobTitle)}`);
  if (input.email) lines.push(`EMAIL:${escapeVCard(input.email)}`);
  if (input.phone) lines.push(`TEL:${escapeVCard(input.phone)}`);
  if (input.website) lines.push(`URL:${escapeVCard(input.website)}`);
  if (input.address) lines.push(`ADR:;;${escapeVCard(input.address)};;;;`);
  if (input.note) lines.push(`NOTE:${escapeVCard(input.note)}`);
  for (const link of input.links) {
    lines.push(`URL;TYPE=${escapeVCard(link.label)}:${escapeVCard(link.url)}`);
  }
  lines.push("END:VCARD", "");
  return lines.join("\r\n");
}
