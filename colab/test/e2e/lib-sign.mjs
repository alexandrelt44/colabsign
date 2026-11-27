import { outbox, linksIn } from "./lib.mjs";

/** O link de assinatura mais recente mandado para este e-mail. */
export function signingLinkFor(email) {
  const mail = outbox()
    .filter((m) => m.template === "signing_invitation" && m.to.includes(email))
    .at(-1);
  if (!mail) throw new Error(`sem convite para ${email}`);
  return linksIn(mail.text).find((u) => u.includes("/sign/"));
}
