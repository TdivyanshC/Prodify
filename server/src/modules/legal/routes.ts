import { Router } from 'express';
import { env } from '../../config/env';

// Public, no-login pages the Play Console needs links to: privacy policy, terms, and how to delete
// an account. Plain HTML served by the API itself so there is nothing else to host.
export const legalRoutes = Router();

const UPDATED = '26 November 2026';

function contact(): string {
  return env.SUPPORT_EMAIL
    ? `<a href="mailto:${env.SUPPORT_EMAIL}">${env.SUPPORT_EMAIL}</a>`
    : 'the developer contact shown on the Prodify page on Google Play';
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Prodify</title>
<style>
:root{color-scheme:dark light}
body{margin:0;background:#071716;color:#F0FBFA;font:16px/1.65 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:30px;margin:0 0 4px}h2{font-size:19px;margin:32px 0 8px;color:#5EEAD4}
p,li{color:#C9DEDB}a{color:#5EEAD4}.meta{color:#93B4AF;font-size:14px;margin-bottom:24px}
nav{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:28px;font-size:14px}
ul,ol{padding-left:22px}li{margin:4px 0}
@media (prefers-color-scheme:light){body{background:#F4FBFA;color:#0F211F}p,li{color:#2B4743}h2{color:#0F766E}a{color:#0F766E}.meta{color:#547873}}
</style></head><body><main>
<nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/delete-account">Delete account</a></nav>
<h1>${title}</h1><div class="meta">Prodify · Last updated ${UPDATED}</div>
${body}
</main></body></html>`;
}

const PRIVACY = `
<p>Prodify is a focus app: you run solo sessions or join shared "spaces" with friends, and earn streaks, XP and badges. This policy explains what we collect, why, and the choices you have.</p>

<h2>What we collect</h2>
<ul>
<li><b>Account details from Google Sign-In:</b> your name, email address and profile photo link. We use Google only to sign you in; we never see your Google password.</li>
<li><b>What you add:</b> a display name, an optional tagline, a daily focus goal, and your Prodify handle (generated for you, shown to people who search for it).</li>
<li><b>Your activity in the app:</b> the sessions you run (theme, start and end time, minutes), your points, level, streaks and badges, which spaces you host or join, and the reactions you send or receive.</li>
<li><b>Your social connections:</b> friend requests and friendships, and blocks and reports you make.</li>
<li><b>Technical information:</b> your time zone, a device identifier we generate, and your platform (Android), used to keep you signed in and time your streaks correctly.</li>
</ul>
<p>We do <b>not</b> collect your location, contacts, photos, microphone or camera, and we do not use advertising or third-party analytics tools.</p>

<h2>How we use it</h2>
<ul>
<li>To run the app: sign you in, record your sessions, work out streaks, XP and badges, and show friends the things you choose to share with them.</li>
<li>To keep the service safe: handle reports and blocks, prevent abuse, and keep the service running.</li>
</ul>
<p>We do not sell your personal data and we do not share it for advertising.</p>

<h2>What other people can see</h2>
<p>Your friends can see your display name, handle, tagline, streak, level and whether you are currently in a session. Anyone can find you by searching your handle and see your display name, tagline and streak. People in a space you join can see that you are there. Reactions are limited to a fixed set (clap, fire, fist bump); there is no chat.</p>

<h2>Who processes your data</h2>
<ul>
<li><b>Google</b> (sign-in).</li>
<li><b>Render</b> (hosts the Prodify servers).</li>
<li><b>MongoDB Atlas</b> (stores the database).</li>
</ul>
<p>These providers act on our behalf to run the service. Your data may be processed in the countries where they operate. Connections between the app and our servers are encrypted.</p>

<h2>How long we keep it</h2>
<p>We keep your data while your account exists. When you delete your account, your profile, sessions, progress, friendships, reactions, notifications and sign-in records are permanently deleted. Reports other people filed about an account are kept without personal details so that safety history is not lost.</p>

<h2>Your choices and rights</h2>
<ul>
<li><b>Delete your account and data</b> any time in the app: Profile, then Delete account. You can also follow the steps at <a href="/delete-account">/delete-account</a>.</li>
<li>You can edit your display name, tagline and daily goal in the app, and block or report people.</li>
<li>For access, correction or any other privacy request, contact {{CONTACT}}.</li>
</ul>

<h2>Children</h2>
<p>Prodify is not directed to children under 13 and we do not knowingly collect their data. If you believe a child has given us personal information, contact us and we will delete it.</p>

<h2>Changes</h2>
<p>If we change this policy in a meaningful way we will update the date above and, where appropriate, tell you in the app.</p>

<h2>Contact</h2>
<p>Questions about this policy: {{CONTACT}}.</p>`;

const TERMS = `
<p>By using Prodify you agree to these terms. If you do not agree, please do not use the app.</p>

<h2>Using Prodify</h2>
<ul>
<li>You must be at least 13 years old, and old enough to agree to these terms where you live.</li>
<li>You sign in with a Google account and are responsible for what happens under your account.</li>
<li>Keep it friendly. Do not harass others, impersonate people, use offensive names or taglines, or try to disrupt or break the service.</li>
</ul>

<h2>Your content</h2>
<p>Your display name, tagline and activity belong to you. You allow us to store and show them as described in the <a href="/privacy">Privacy Policy</a> so the app can work.</p>

<h2>Safety</h2>
<p>You can block and report other users. We may remove content or suspend accounts that break these terms or put others at risk.</p>

<h2>The service</h2>
<p>Prodify is provided "as is". We work to keep it available but cannot promise it will always be uninterrupted or error-free, and streaks, XP and badges have no cash value. We may change or stop features, and to the extent the law allows we are not liable for indirect or incidental losses from using the app.</p>

<h2>Ending your account</h2>
<p>You can delete your account at any time in the app (Profile, then Delete account); see <a href="/delete-account">how deletion works</a>.</p>

<h2>Contact</h2>
<p>Questions about these terms: {{CONTACT}}.</p>`;

const DELETE = `
<p>You can permanently delete your Prodify account and its data whenever you like.</p>

<h2>Delete it in the app</h2>
<ol>
<li>Open Prodify and go to the <b>Profile</b> tab.</li>
<li>Scroll to the bottom and tap <b>Delete account</b>.</li>
<li>Read the notice and confirm.</li>
</ol>
<p>Deletion is immediate and cannot be undone.</p>

<h2>What is deleted</h2>
<ul>
<li>Your profile (name, email, photo link, handle, tagline, settings).</li>
<li>Your sessions, daily totals, points, level, streaks and badges.</li>
<li>Your friendships, blocks, reactions, together-streaks, reminders and notifications.</li>
<li>Your sign-in records on every device.</li>
</ul>

<h2>What is kept</h2>
<ul>
<li>Spaces you created stay for the people in them, but no longer name you as host.</li>
<li>Safety reports other people filed about your account are kept without personal details.</li>
</ul>

<h2>Can't open the app?</h2>
<p>Contact {{CONTACT}} from the email address on your Prodify account and ask us to delete it. We will confirm once it is done.</p>`;

const fill = (html: string) => html.replaceAll('{{CONTACT}}', contact());

legalRoutes.get('/privacy', (_req, res) => void res.type('html').send(page('Privacy Policy', fill(PRIVACY))));
legalRoutes.get('/terms', (_req, res) => void res.type('html').send(page('Terms of Service', fill(TERMS))));
legalRoutes.get('/delete-account', (_req, res) => void res.type('html').send(page('Delete your account', fill(DELETE))));
