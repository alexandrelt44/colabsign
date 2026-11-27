// ColabSign: trocas exatas de trechos de código, aplicadas antes do glossário.
// Use só para o que o glossário não alcança: formato de data e fuso horário,
// rótulos montados a partir de códigos internos, a versão do aviso de
// documentos eletrônicos (o texto mudou, então a versão muda).
//
// Formato: { "arquivo": [[trecho original, trecho novo, vezes?], ...] }.
// "vezes" (padrão 1) é quantas vezes o trecho precisa aparecer; se o
// upstream mudar o trecho, o build para.

// Datas: pt-BR no fuso de São Paulo. O Brasil não tem horário de verão desde
// 2019, então "horário de Brasília" identifica a hora sem ambiguidade.
const FUSO = '"America/Sao_Paulo"';
const SP_DATA_HORA = `new Intl.DateTimeFormat("pt-BR", { timeZone: ${FUSO}, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })`;

// Rótulos dos eventos do histórico no certificado (códigos em
// src/lib/types/domain.ts, auditEventTypes).
const EVENTOS = `({
      created: "Criado",
      sent: "Enviado",
      viewed: "Visualizado",
      consented: "Concordou com o uso de documentos eletrônicos",
      verified: "Identidade confirmada",
      verification_failed: "Falha na confirmação de identidade",
      signed: "Assinado",
      declined: "Recusado",
      reminded_manual: "Lembrete enviado",
      email_sent: "E-mail enviado",
      completed: "Concluído",
      voided: "Cancelado",
      deadline_changed: "Prazo alterado",
      expired: "Expirado",
      reminded_auto: "Lembrete automático",
      reauthentication_failed: "Falha ao confirmar a senha",
      copied: "Cópia enviada",
      signer_corrected: "Signatário corrigido",
      approved: "Aprovado",
      rejected: "Rejeitado",
    } as Record<string, string>)`;

// Tipos de e-mail (emailTemplateKinds em src/lib/types/domain.ts).
const EMAILS = `({
          account_closure_request: "pedido de encerramento de conta",
          contact_form: "formulário de contato",
          email_verification: "confirmação de e-mail",
          signing_invitation: "convite para assinar",
          signing_code: "código de acesso",
          change_email_confirmation: "confirmação de troca de e-mail",
          manual_nudge: "lembrete",
          automatic_reminder: "lembrete automático",
          completion_notification: "aviso de conclusão",
          download_links: "links de download",
          decline_notification: "aviso de recusa",
          void_notification: "aviso de cancelamento",
          password_reset: "troca de senha",
          retention_notice: "aviso de retenção",
          deletion_notice: "aviso de exclusão",
          expiry_notice: "aviso de prazo vencido",
          test_email: "e-mail de teste",
          signing_lock_alert: "alerta de bloqueio",
        } as Record<string, string>)`;

export default {

  "src/components/envelopes/review-shell.tsx": [
    [
      'const signers = `${signerCount} ${signerCount === 1 ? "signer" : "signers"}`;',
      'const signers = `${signerCount} ${signerCount === 1 ? "signatário" : "signatários"}`;',
    ],
    [
      '? `${signers} and ${approverCount} ${approverCount === 1 ? "approver" : "approvers"}`',
      '? `${signers} e ${approverCount} ${approverCount === 1 ? "aprovador" : "aprovadores"}`',
    ],
  ],

  // Datas do painel: pt-BR, fuso de São Paulo.
  "src/lib/envelopes.ts": [
    ['new Intl.DateTimeFormat("en-US", {', 'new Intl.DateTimeFormat("pt-BR", {', 3],
    ['timeZone: "UTC",', `timeZone: ${FUSO},`, 3],
    [
      `return \`\${String(signedCount)} of \${String(signers.length)} \${
      signers.some((signer) => signer.role === "approver") ? "done" : "signed"
    }\`;`,
      `return \`\${String(signedCount)} de \${String(signers.length)} \${
      signers.some((signer) => signer.role === "approver") ? "concluídos" : "assinados"
    }\`;`,
    ],
    [
      'return `${pluralize(assignedFieldCount, "field")} completed`;',
      'return `${pluralize(assignedFieldCount, "campo")} preenchido${assignedFieldCount === 1 ? "" : "s"}`;',
    ],
    [
      'return `${pluralize(assignedFieldCount, "field")} assigned`;',
      'return `${pluralize(assignedFieldCount, "campo")}`;',
    ],
    [
      '`${pluralize(signers.length, "signer")} · ${pluralize(fields.length, "field")} placed`',
      '`${pluralize(signers.length, "signatário")} · ${pluralize(fields.length, "campo")}`',
    ],
  ],
  "src/lib/templates.ts": [
    ['new Intl.DateTimeFormat("en-US", {', 'new Intl.DateTimeFormat("pt-BR", {'],
    ['timeZone: "UTC",', `timeZone: ${FUSO},`],
  ],
  "src/app/(app)/envelopes/[id]/page.tsx": [
    ['new Intl.DateTimeFormat("en-US", {', 'new Intl.DateTimeFormat("pt-BR", {'],
    ['timeZone: "UTC",', `timeZone: ${FUSO},`],
  ],
  "src/lib/envelope-deletion.ts": [
    [
      'return new Date(timestamp * 1000).toISOString().slice(0, 10);',
      `return new Intl.DateTimeFormat("pt-BR", { timeZone: ${FUSO}, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp * 1000));`,
    ],
  ],
  "src/lib/retention.ts": [
    [
      'return new Date(timestamp * 1000).toISOString().slice(0, 10);',
      `return new Intl.DateTimeFormat("pt-BR", { timeZone: ${FUSO}, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp * 1000));`,
    ],
  ],

  // O filtro do painel usa "All", "Draft"... como valores (tipo
  // DashboardFilter); só o que aparece na tela é traduzido.
  "src/components/dashboard/dashboard-documents-surface.tsx": [
    [
      `const statusLabelMap: Record<EnvelopeStatus, string> = {
  completed: "Completed",
  declined: "Declined",
  draft: "Draft",
  sent: "Sent",
  voided: "Voided",
};`,
      `const statusLabelMap: Record<EnvelopeStatus, string> = {
  completed: "Concluído",
  declined: "Recusado",
  draft: "Rascunho",
  sent: "Enviado",
  voided: "Cancelado",
};
const COLAB_FILTRO_PT: Record<string, string> = {
  All: "Todos",
  Completed: "Concluídos",
  Declined: "Recusados",
  Draft: "Rascunhos",
  Sent: "Enviados",
  Voided: "Cancelados",
};`,
    ],
    ["{filter}\n                </span>", "{COLAB_FILTRO_PT[filter] ?? filter}</span>"],
    ["{filter}\n              </button>", "{COLAB_FILTRO_PT[filter] ?? filter}</button>"],
  ],

  // Palavras soltas em minúsculas: no glossário elas poderiam pegar valores
  // de código (status, tipos), então vão aqui, com o trecho inteiro.
  "src/lib/services/signing-invitation-email.ts": [
    [
      `accountLine: "approve",
        linkText: "Review and approve or reject the document",
        noun: "approval",
        verb: "approve",`,
      `accountLine: "aprovar",
        linkText: "Review and approve or reject the document",
        noun: "aprovação",
        verb: "aprovar",`,
    ],
    [
      `accountLine: "sign",
        linkText: "Review and sign the document",
        noun: "signature",
        verb: "sign",`,
      `accountLine: "assinar",
        linkText: "Review and sign the document",
        noun: "assinatura",
        verb: "assinar",`,
    ],
  ],
  "src/components/signing/signing-done-shell.tsx": [
    ['{approved ? "approval" : "signature"}', '{approved ? "aprovação" : "assinatura"}'],
  ],
  "src/app/layout.tsx": [['<html lang="en"', '<html lang="pt-BR"']],

  "src/lib/services/pdf-finalize.ts": [
    [
      `if (event.actorType !== "signer") {
    return event.actorEmail ?? event.actorType;`,
      `if (event.actorType !== "signer") {
    return event.actorEmail ?? (({ sender: "remetente", system: "sistema" } as Record<string, string>)[event.actorType] ?? event.actorType);`,
    ],
    [
      'details.push(`Signature adopted by: ${methods.join(", ")}`);',
      'details.push(`Signature adopted by: ${methods.map((m) => (({ typed: "digitada", drawn: "desenhada", auto: "automática" } as Record<string, string>)[m] ?? m)).join(", ")}`);',
    ],
    [
      'return value.toISOString().replace(".000Z", " UTC");',
      `return \`\${${SP_DATA_HORA}.format(value).replace(", ", " ")} (horário de Brasília)\`;`,
    ],
    [
      'event.event === "signer_corrected" ? "Signer corrected" : event.event;',
      `${EVENTOS}[event.event] ?? event.event;`,
    ],
    [
      'kind ? `email ${kind.replaceAll("_", " ")}` : "email",',
      'kind ? `e-mail: ${' + EMAILS + '[kind] ?? kind.replaceAll("_", " ")}` : "e-mail",',
    ],
  ],

  "src/lib/signature-meanings.ts": [
    [
      `const signedAt = new Date(signer.signedAt * 1000)
    .toISOString()
    .replace(/\\.\\d{3}Z$/, " UTC")
    .replace("T", " ");`,
      `const signedAt = \`\${${SP_DATA_HORA}.format(new Date(signer.signedAt * 1000)).replace(", ", " ")} (horário de Brasília)\`;`,
    ],
  ],

  "src/lib/envelope-deadline.ts": [
    ['new Intl.DateTimeFormat("en-US", {', 'new Intl.DateTimeFormat("pt-BR", {'],
    ['timeZone: "UTC",', `timeZone: ${FUSO},`],
    ['.replace(/[  ]/g, " ")} UTC`;', '.replace(/[  ]/g, " ")} (horário de Brasília)`;'],
  ],

  "src/lib/verify-result.ts": [
    ['completed: "completed",', 'completed: "concluído",'],
    ['declined: "declined",', 'declined: "recusado",'],
    ['voided: "voided",', 'voided: "cancelado",'],
    ['new Intl.DateTimeFormat("en-US", {', 'new Intl.DateTimeFormat("pt-BR", {'],
    ['timeZone: "UTC",', `timeZone: ${FUSO},`],
    ['return `${dateFormatter.format(new Date(timestamp * 1000))} UTC`;', 'return `${dateFormatter.format(new Date(timestamp * 1000))} (horário de Brasília)`;'],
  ],

  // A data que vai nos campos "Data" do PDF já é calculada no relógio do
  // signatário (por isso o timeZone UTC fica); só muda o idioma.
  "src/lib/signing.ts": [
    ['new Intl.DateTimeFormat("en-US", {', 'new Intl.DateTimeFormat("pt-BR", {'],
    ['const verb = input.rejected ? "rejected" : "declined";', 'const verb = input.rejected ? "rejeitou" : "recusou";'],
    ['${result.attemptsLeft === 1 ? "try is" : "tries are"} left before', '${result.attemptsLeft === 1 ? "tentativa" : "tentativas"} left before'],
    ['?.name ?? "the signing provider",', '?.name ?? "o serviço de assinatura",'],
  ],

  "src/lib/services/reminders.ts": [
    [
      'new Intl.DateTimeFormat("en-US", {',
      `new Intl.DateTimeFormat("pt-BR", {\n  timeZone: ${FUSO},`,
    ],
  ],

  "src/components/signing/signing-live-shell.tsx": [
    ['new Intl.DateTimeFormat("en-US", {', 'new Intl.DateTimeFormat("pt-BR", {'],
    ['${isApprover ? "review and approve" : "sign"}', '${isApprover ? "revisar e aprovar" : "assinar"}'],
    ['${isApprover ? "rejected it" : "declined"}', '${isApprover ? "rejeitou" : "recusou"}'],
  ],

  // O texto padrão do aviso mudou (tradução), então a versão registrada com
  // a concordância de cada signatário também muda.
  "src/lib/electronic-records-disclosure.ts": [
    [
      'ELECTRONIC_RECORDS_DISCLOSURE_VERSION = "2026-11-13";',
      'ELECTRONIC_RECORDS_DISCLOSURE_VERSION = "2026-11-13-pt-BR";',
    ],
  ],
};
