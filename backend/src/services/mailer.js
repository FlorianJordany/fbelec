import nodemailer from 'nodemailer';

// Échappement HTML des valeurs saisies par les utilisateurs (corps HTML uniquement, pas l'objet).
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWelcomeClient({ nom, email, code }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP non configuré — email non envoyé à', email);
    return;
  }
  await transporter.sendMail({
    from: `"FB ELEC" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Votre accès au suivi de chantier FB ELEC',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a1a1a;padding:28px 32px">
          <h1 style="margin:0;color:#F5C518;font-size:22px;letter-spacing:.05em">FB ELEC</h1>
        </div>
        <div style="padding:32px;border:1px solid #e9ebee;border-top:none">
          <h2 style="margin:0 0 16px;font-size:20px;color:#20242a">Bonjour ${nom},</h2>
          <p style="color:#5c656f;line-height:1.6;margin:0 0 24px">
            FB ELEC a créé votre espace de suivi de chantier.<br>
            Voici vos identifiants de connexion :
          </p>
          <div style="background:#f5f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <div style="margin-bottom:12px">
              <div style="font-size:12px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px">E-mail</div>
              <div style="font-size:16px;color:#20242a;font-weight:600">${email}</div>
            </div>
            <div>
              <div style="font-size:12px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px">Mot de passe provisoire</div>
              <div style="font-size:22px;color:#20242a;font-weight:700;font-family:monospace;letter-spacing:.1em">${code}</div>
            </div>
          </div>
          <p style="color:#5c656f;font-size:14px;line-height:1.6;margin:0 0 24px">
            Lors de votre première connexion, vous devrez définir votre propre mot de passe personnel.
          </p>
          <a href="${process.env.PUBLIC_URL || ''}"
            style="display:inline-block;background:#F5C518;color:#1a1a1a;padding:13px 26px;
            border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Accéder à mon suivi →
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#98a0a9">
            Une question ? Contactez-nous : <a href="mailto:contact@fbelec.fr" style="color:#A8780A">contact@fbelec.fr</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendEtapeEnCours({ nom, email, chantierNom, etapeLabel, chantierId }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP non configuré — email non envoyé à', email);
    return;
  }
  const base = process.env.PUBLIC_URL || '';
  const url = chantierId ? `${base}?chantier=${chantierId}` : base;
  await transporter.sendMail({
    from: `"FB ELEC" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: `Avancement chantier : ${chantierNom}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a1a1a;padding:28px 32px">
          <h1 style="margin:0;color:#F5C518;font-size:22px;letter-spacing:.05em">FB ELEC</h1>
        </div>
        <div style="padding:32px;border:1px solid #e9ebee;border-top:none">
          <h2 style="margin:0 0 16px;font-size:20px;color:#20242a">Bonjour ${nom},</h2>
          <p style="color:#5c656f;line-height:1.6;margin:0 0 20px">
            Votre chantier <strong style="color:#20242a">${chantierNom}</strong> avance !<br>
            Une nouvelle étape vient de démarrer :
          </p>
          <div style="background:#f5f6f8;border-left:4px solid #F5C518;border-radius:0 10px 10px 0;
            padding:18px 22px;margin-bottom:28px">
            <div style="font-size:12px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;
              font-weight:700;margin-bottom:6px">Étape en cours</div>
            <div style="font-size:19px;color:#20242a;font-weight:700">${etapeLabel}</div>
          </div>
          <a href="${url}"
            style="display:inline-block;background:#F5C518;color:#1a1a1a;padding:13px 26px;
            border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Voir le chantier →
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#98a0a9">
            Une question ? <a href="mailto:contact@fbelec.fr" style="color:#A8780A">contact@fbelec.fr</a>
          </p>
        </div>
      </div>
    `,
  });
}

// pourAbonne : collègue abonné aux notifications de ce chantier → formulation adaptée.
export async function sendEtapeAvancement({ nom, email, chantierNom, referenceClient, etapeLabel, etatLabel, chantierId, pourAbonne = false }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP non configuré — email non envoyé à', email);
    return;
  }
  const base = process.env.PUBLIC_URL || '';
  const url = chantierId ? `${base}?chantier=${chantierId}` : base;
  await transporter.sendMail({
    from: `"FB ELEC" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: `Avancement chantier : ${referenceClient ? `${referenceClient} — ` : ''}${chantierNom}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a1a1a;padding:28px 32px">
          <h1 style="margin:0;color:#F5C518;font-size:22px;letter-spacing:.05em">FB ELEC</h1>
        </div>
        <div style="padding:32px;border:1px solid #e9ebee;border-top:none">
          <h2 style="margin:0 0 16px;font-size:20px;color:#20242a">Bonjour ${esc(nom)},</h2>
          <p style="color:#5c656f;line-height:1.6;margin:0 0 20px">
            L'avancement ${pourAbonne ? 'du' : 'de votre'} chantier <strong style="color:#20242a">${esc(chantierNom)}</strong>${referenceClient ? ` (réf. <strong style="color:#20242a">${esc(referenceClient)}</strong>)` : ''}${pourAbonne ? ' de votre société' : ''} a été mis à jour :
          </p>
          <div style="background:#f5f6f8;border-left:4px solid #F5C518;border-radius:0 10px 10px 0;
            padding:18px 22px;margin-bottom:28px">
            <div style="font-size:19px;color:#20242a;font-weight:700;margin-bottom:6px">${esc(etapeLabel)}</div>
            <div style="font-size:14px;color:#5c656f">Statut de l'étape : <strong style="color:#20242a">${esc(etatLabel)}</strong></div>
          </div>
          <a href="${url}"
            style="display:inline-block;background:#F5C518;color:#1a1a1a;padding:13px 26px;
            border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Voir le chantier →
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#98a0a9">
            Une question ? <a href="mailto:contact@fbelec.fr" style="color:#A8780A">contact@fbelec.fr</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendNouvelleNote({ nom, email, chantierNom, referenceClient, texte, chantierId, pourAbonne = false }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP non configuré — email non envoyé à', email);
    return;
  }
  const base = process.env.PUBLIC_URL || '';
  const url = chantierId ? `${base}?chantier=${chantierId}` : base;
  await transporter.sendMail({
    from: `"FB ELEC" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: `Nouveau message FB ELEC — ${referenceClient ? `${referenceClient} — ` : ''}${chantierNom}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a1a1a;padding:28px 32px">
          <h1 style="margin:0;color:#F5C518;font-size:22px;letter-spacing:.05em">FB ELEC</h1>
        </div>
        <div style="padding:32px;border:1px solid #e9ebee;border-top:none">
          <h2 style="margin:0 0 16px;font-size:20px;color:#20242a">Bonjour ${esc(nom)},</h2>
          <p style="color:#5c656f;line-height:1.6;margin:0 0 20px">
            ${pourAbonne ? 'FB ELEC a publié un message sur le chantier' : 'FB ELEC vous a envoyé un message concernant votre chantier'}
            <strong style="color:#20242a">${esc(chantierNom)}</strong>${referenceClient ? ` (réf. <strong style="color:#20242a">${esc(referenceClient)}</strong>)` : ''}${pourAbonne ? ' de votre société' : ''} :
          </p>
          <div style="background:#f5f6f8;border-radius:10px;padding:20px 24px;margin-bottom:28px;
            font-size:15px;color:#20242a;line-height:1.7;white-space:pre-wrap">${esc(texte)}</div>
          <a href="${url}"
            style="display:inline-block;background:#F5C518;color:#1a1a1a;padding:13px 26px;
            border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Voir le chantier →
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#98a0a9">
            Une question ? <a href="mailto:contact@fbelec.fr" style="color:#A8780A">contact@fbelec.fr</a>
          </p>
        </div>
      </div>
    `,
  });
}

// Collègue abonné à un chantier : copie d'un message envoyé à FB ELEC depuis ce chantier.
// pourProprietaire : le destinataire est le créateur du chantier (message écrit par un collègue).
export async function sendMessageCollegue({ nom, email, auteurNom, chantierNom, referenceClient, message, chantierId, pourProprietaire = false }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP non configuré — email non envoyé à', email);
    return;
  }
  const base = process.env.PUBLIC_URL || '';
  const url = chantierId ? `${base}?chantier=${chantierId}` : base;
  await transporter.sendMail({
    from: `"FB ELEC" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: `Message de ${auteurNom} à FB ELEC — ${referenceClient ? `${referenceClient} — ` : ''}${chantierNom}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a1a1a;padding:28px 32px">
          <h1 style="margin:0;color:#F5C518;font-size:22px;letter-spacing:.05em">FB ELEC</h1>
        </div>
        <div style="padding:32px;border:1px solid #e9ebee;border-top:none">
          <h2 style="margin:0 0 16px;font-size:20px;color:#20242a">Bonjour ${esc(nom)},</h2>
          <p style="color:#5c656f;line-height:1.6;margin:0 0 20px">
            <strong style="color:#20242a">${esc(auteurNom)}</strong> a envoyé un message à FB ELEC concernant le chantier
            <strong style="color:#20242a">${esc(chantierNom)}</strong>${referenceClient ? ` (réf. <strong style="color:#20242a">${esc(referenceClient)}</strong>)` : ''} :
          </p>
          <div style="background:#f5f6f8;border-radius:10px;padding:20px 24px;margin-bottom:28px;
            font-size:15px;color:#20242a;line-height:1.7;white-space:pre-wrap">${esc(message)}</div>
          <a href="${url}"
            style="display:inline-block;background:#F5C518;color:#1a1a1a;padding:13px 26px;
            border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Voir le chantier →
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#98a0a9">
            ${pourProprietaire
              ? 'Vous recevez cet e-mail car vous êtes le créateur de ce chantier.'
              : 'Vous recevez cet e-mail car vous avez été ajouté aux notifications de ce chantier.'}
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendContactClient({ clientNom, clientEmail, clientTelephone, societeNom, message, chantier }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP non configuré — email non envoyé');
    return;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = process.env.CONTACT_EMAIL || from;
  const base = process.env.PUBLIC_URL || '';
  const url = chantier?.id ? `${base}?chantier=${chantier.id}` : '';
  const rowsChantier = chantier ? [
    ['Chantier', chantier.nom],
    ['Adresse', chantier.adresse],
    ['Référence client', chantier.referenceClient],
    ['Référence dossier', chantier.reference],
  ].filter(([, v]) => v) : [];
  await transporter.sendMail({
    from: `"FB ELEC Suivi" <${from}>`,
    to,
    replyTo: clientEmail,
    subject: chantier
      ? `Message client — ${clientNom} — ${chantier.nom}`
      : `Message client — ${clientNom}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a1a1a;padding:28px 32px">
          <h1 style="margin:0;color:#F5C518;font-size:22px;letter-spacing:.05em">FB ELEC — Message client</h1>
        </div>
        <div style="padding:32px;border:1px solid #e9ebee;border-top:none">
          <div style="background:#f5f6f8;border-radius:10px;padding:18px 22px;margin-bottom:20px">
            <div style="font-size:12px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px">De</div>
            <div style="font-size:16px;color:#20242a;font-weight:600">${esc(clientNom)}${societeNom ? ` <span style="font-weight:400;color:#5c656f">· ${esc(societeNom)}</span>` : ''}</div>
            <div style="font-size:14px;color:#5c656f">${esc(clientEmail)}${clientTelephone ? ` · ${esc(clientTelephone)}` : ''}</div>
          </div>
          ${rowsChantier.length ? `
          <div style="background:#f5f6f8;border-left:4px solid #F5C518;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px">
            ${rowsChantier.map(([k, v]) => `
            <div style="margin-bottom:8px">
              <div style="font-size:11px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:2px">${k}</div>
              <div style="font-size:14.5px;color:#20242a;font-weight:600">${esc(v)}</div>
            </div>`).join('')}
          </div>` : ''}
          <div style="font-size:15px;color:#20242a;line-height:1.7;white-space:pre-wrap;background:#fff;border:1px solid #e9ebee;border-radius:10px;padding:16px 20px">${esc(message)}</div>
          ${url ? `
          <a href="${url}"
            style="display:inline-block;background:#F5C518;color:#1a1a1a;padding:13px 26px;
            border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-top:24px">
            Voir et répondre sur le site →
          </a>` : ''}
          <p style="margin:24px 0 0;font-size:13px;color:#98a0a9">
            ${url ? 'Le message est aussi visible dans le fil du chantier. Vous pouvez également répondre' : 'Répondez'} directement à cet e-mail pour contacter le client.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendNouveauChantierAdmin({ clientNom, clientEmail, chantierNom, chantierAdresse, reference, chantierId }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP non configuré — email non envoyé');
    return;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = process.env.CONTACT_EMAIL || from;
  const base = process.env.PUBLIC_URL || '';
  const url = chantierId ? `${base}?chantier=${chantierId}` : base;
  await transporter.sendMail({
    from: `"FB ELEC Suivi" <${from}>`,
    to,
    replyTo: clientEmail,
    subject: `Nouveau chantier déposé — ${clientNom}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a1a1a;padding:28px 32px">
          <h1 style="margin:0;color:#F5C518;font-size:22px;letter-spacing:.05em">FB ELEC — Nouveau chantier</h1>
        </div>
        <div style="padding:32px;border:1px solid #e9ebee;border-top:none">
          <p style="color:#5c656f;line-height:1.6;margin:0 0 20px">
            Un client vient de déposer une demande de chantier sur l'espace de suivi.
          </p>
          <div style="background:#f5f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <div style="margin-bottom:14px">
              <div style="font-size:11px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:3px">Client</div>
              <div style="font-size:16px;color:#20242a;font-weight:600">${esc(clientNom)}</div>
              <div style="font-size:14px;color:#5c656f">${esc(clientEmail)}</div>
            </div>
            <div style="margin-bottom:14px">
              <div style="font-size:11px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:3px">Chantier</div>
              <div style="font-size:16px;color:#20242a;font-weight:600">${esc(chantierNom)}</div>
              <div style="font-size:14px;color:#5c656f">${esc(chantierAdresse)}</div>
            </div>
            <div>
              <div style="font-size:11px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:3px">Référence</div>
              <div style="font-size:15px;color:#20242a;font-weight:700;font-family:monospace">${esc(reference)}</div>
            </div>
          </div>
          <a href="${url}"
            style="display:inline-block;background:#F5C518;color:#1a1a1a;padding:13px 26px;
            border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Voir le chantier →
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#98a0a9">
            Répondez directement à cet e-mail pour contacter le client.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendCodeReset({ nom, email, code }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP non configuré — email non envoyé à', email);
    return;
  }
  await transporter.sendMail({
    from: `"FB ELEC" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Votre nouveau mot de passe FB ELEC',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a1a1a;padding:28px 32px">
          <h1 style="margin:0;color:#F5C518;font-size:22px;letter-spacing:.05em">FB ELEC</h1>
        </div>
        <div style="padding:32px;border:1px solid #e9ebee;border-top:none">
          <h2 style="margin:0 0 16px;font-size:20px;color:#20242a">Bonjour ${nom},</h2>
          <p style="color:#5c656f;line-height:1.6;margin:0 0 24px">
            Un nouveau mot de passe provisoire a été généré pour votre compte.
          </p>
          <div style="background:#f5f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <div style="font-size:12px;color:#98a0a9;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px">Nouveau mot de passe provisoire</div>
            <div style="font-size:22px;color:#20242a;font-weight:700;font-family:monospace;letter-spacing:.1em">${code}</div>
          </div>
          <p style="color:#5c656f;font-size:14px;margin:0 0 24px">
            Vous devrez définir un nouveau mot de passe à la connexion.
          </p>
          <a href="${process.env.PUBLIC_URL || ''}"
            style="display:inline-block;background:#F5C518;color:#1a1a1a;padding:13px 26px;
            border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Se connecter →
          </a>
        </div>
      </div>
    `,
  });
}
