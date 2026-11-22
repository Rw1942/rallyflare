# Postmark and Access setup

How inbound email reaches `rallyflare`, and what to configure if the webhook or an address is set up again.

## Inbound webhook

Postmark receives mail for the Email2ChatGPT addresses (through MX records on the domain or a forwarding address) and posts each message as JSON to the inbound stream's webhook URL:

```
https://<WEBHOOK_USERNAME>:<WEBHOOK_PASSWORD>@rallyflare.rick-wills.workers.dev/postmark/inbound
```

Postmark turns the credentials in the URL into an HTTP Basic `Authorization` header, and `handlePostmarkInbound` rejects any request whose credentials do not match the Worker secrets `WEBHOOK_USERNAME` and `WEBHOOK_PASSWORD` with a 401. To change them, set new values on the Worker first and then update the URL in Postmark (Servers, the server, Settings, Inbound):

```bash
cd services/ingest
npx wrangler secret put WEBHOOK_USERNAME
npx wrangler secret put WEBHOOK_PASSWORD
```

Mail sent between the two steps is rejected with a 401, and Postmark retries it later.

## Cloudflare Access

The whole `rallyflare.rick-wills.workers.dev` hostname sits behind a Cloudflare Access application, so the dashboard needs a login. Postmark cannot log in, so `/postmark/inbound` has a separate Access application whose policy lets Postmark through. Without it Postmark gets a redirect to the Access login page and no mail is processed. Other callers of that path currently get a 403 from Access.

Both applications are in the Zero Trust dashboard under Access, Applications. If the webhook starts failing with redirects or 403s in Postmark's activity log, check the path application first.

## Outbound mail

`rally-mailer` sends replies through the Postmark API (`POSTMARK_URL`) on the `outbound` message stream, authenticated with the `POSTMARK_TOKEN` secret. The sender address is the Rally address that received the original mail, so each such address or its domain must be a verified sender in Postmark.

## Payload

Postmark's inbound JSON is typed as `PostmarkInboundMessage` in `shared/types/common.ts`. The fields the code relies on are `FromFull`, `ToFull`, `CcFull`, `OriginalRecipient`, `Subject`, `MessageID`, `Headers` (for `In-Reply-To` and `References`), `TextBody`, `HtmlBody` and `Attachments` (base64 content).
