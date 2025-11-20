import { handlePostmarkInbound } from "./handlers/inbound";
import { renderHome } from "./dashboard/views/home";
import { renderMessages } from "./dashboard/views/messages";
import { renderUsers } from "./dashboard/views/users";
import { renderUserDetail } from "./dashboard/views/userDetail";
import { renderSettings } from "./dashboard/views/settings";
import { renderPersonas, renderPersonaEdit, renderPersonaDetail } from "./dashboard/views/personas";
import type { Env } from "./types";

// Helper to create HTML response
const html = (content: string) => new Response(content, { headers: { "content-type": "text/html" } });

// Helper to get safe array results from D1
const safeResults = (results: any) => Array.isArray(results) ? results : [];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // ============ Webhook ============
      if (path === "/postmark/inbound" && method === "POST") {
        return handlePostmarkInbound(request, env);
      }

      // ============ Dashboard Pages ============
      
      // Home - Activity stats
      if (path === "/" && method === "GET") {
        const batch = await env.DB.batch([
          env.DB.prepare("SELECT COUNT(*) as count FROM messages WHERE received_at > datetime('now', '-1 day')"),
          env.DB.prepare("SELECT COUNT(*) as count FROM messages WHERE direction != 'outbound' AND received_at > datetime('now', '-1 day')"),
          env.DB.prepare("SELECT COUNT(*) as count FROM messages WHERE direction = 'outbound' AND received_at > datetime('now', '-1 day')"),
          env.DB.prepare("SELECT COUNT(*) as count FROM messages WHERE llm_summary IS NOT NULL AND received_at > datetime('now', '-1 day')")
        ]);

        const stats = {
          total24h: (batch[0].results?.[0] as any)?.count || 0,
          inbound24h: (batch[1].results?.[0] as any)?.count || 0,
          outbound24h: (batch[2].results?.[0] as any)?.count || 0,
          aiProcessed24h: (batch[3].results?.[0] as any)?.count || 0
        };

        return html(renderHome(stats));
      }

      // Messages list
      if (path === "/messages" && method === "GET") {
        const page = parseInt(url.searchParams.get('page') || '1') || 1;
        const limit = 50;
        const offset = (page - 1) * limit;

        const { count } = await env.DB.prepare("SELECT COUNT(*) as count FROM messages").first() as any || { count: 0 };
        const totalPages = Math.ceil(count / limit);

        const { results } = await env.DB.prepare("SELECT * FROM messages ORDER BY received_at DESC LIMIT ? OFFSET ?")
          .bind(limit, offset)
          .all();
        return html(renderMessages(safeResults(results), { page, totalPages, baseUrl: '/messages' }));
      }

      // Users list
      if (path === "/users" && method === "GET") {
        const { results } = await env.DB.prepare(`
          SELECT u.*, (SELECT COUNT(*) FROM messages m WHERE m.from_email = u.email) as message_count 
          FROM users u ORDER BY u.last_seen_at DESC
        `).all();
        return html(renderUsers(safeResults(results)));
      }

      // User detail
      if (path.startsWith("/users/") && method === "GET") {
        const email = decodeURIComponent(path.split("/")[2]).toLowerCase();
        const user = await env.DB.prepare("SELECT * FROM users WHERE lower(email) = ?").bind(email).first();
        if (!user) return new Response("User not found", { status: 404 });

        const page = parseInt(url.searchParams.get('page') || '1') || 1;
        const limit = 50;
        const offset = (page - 1) * limit;

        // Count user messages - Unified query using recipient_email
        // recipient_email tracks the user involved regardless of direction
        const { count } = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM messages WHERE lower(recipient_email) = ?"
        ).bind(email).first() as any || { count: 0 };
        const totalPages = Math.ceil(count / limit);

        const { results: history } = await env.DB.prepare(
          "SELECT * FROM messages WHERE lower(recipient_email) = ? ORDER BY received_at DESC LIMIT ? OFFSET ?"
        ).bind(email, limit, offset).all();

        const settings = await env.DB.prepare("SELECT * FROM email_settings WHERE email_address = ?").bind(email).first();
        
        return html(renderUserDetail(user, safeResults(history), settings, { page, totalPages, baseUrl: `/users/${encodeURIComponent(email)}` }));
      }

      // Settings - view
      if (path === "/settings" && method === "GET") {
        const settings = await env.DB.prepare("SELECT * FROM project_settings WHERE project_slug = 'default'").first();
        return html(renderSettings(settings));
      }

      // Settings - update
      if (path === "/settings" && method === "POST") {
        const formData = await request.formData();
        await env.DB.prepare(`
          UPDATE project_settings SET system_prompt = ?, model = ?, reasoning_effort = ?, max_output_tokens = ?
          WHERE project_slug = 'default'
        `).bind(
          formData.get('system_prompt'),
          formData.get('model'),
          formData.get('reasoning_effort'),
          formData.get('max_output_tokens')
        ).run();
        return Response.redirect(url.origin + "/settings", 303);
      }

      // Personas - list
      if (path === "/personas" && method === "GET") {
        const { results } = await env.DB.prepare(`
          SELECT 
            es.*, 
            (SELECT COUNT(*) FROM messages WHERE lower(email_address) = es.email_address) as message_count
          FROM email_settings es 
          ORDER BY es.email_address ASC
        `).all();
        return html(renderPersonas(safeResults(results)));
      }

      // Personas - new form
      if (path === "/personas/new" && method === "GET") {
        return html(renderPersonaEdit(null, true));
      }

      // Personas - detail (with message history)
      if (path.startsWith("/personas/") && !path.endsWith("/new") && !path.endsWith("/edit") && method === "GET") {
        const email = decodeURIComponent(path.split("/")[2]).toLowerCase();
        const persona = await env.DB.prepare("SELECT * FROM email_settings WHERE email_address = ?").bind(email).first();
        if (!persona) return new Response("Persona not found", { status: 404 });

        const page = parseInt(url.searchParams.get('page') || '1') || 1;
        const limit = 50;
        const offset = (page - 1) * limit;

        const { count } = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM messages WHERE lower(email_address) = ?"
        ).bind(email).first() as any || { count: 0 };
        const totalPages = Math.ceil(count / limit);

        const { results: history } = await env.DB.prepare(
          "SELECT * FROM messages WHERE lower(email_address) = ? ORDER BY received_at DESC LIMIT ? OFFSET ?"
        ).bind(email, limit, offset).all();

        return html(renderPersonaDetail(persona, safeResults(history), { page, totalPages, baseUrl: `/personas/${encodeURIComponent(email)}` }));
      }

      // Personas - edit form
      if (path.startsWith("/personas/") && path.endsWith("/edit") && method === "GET") {
        const email = decodeURIComponent(path.split("/")[2]).toLowerCase();
        const persona = await env.DB.prepare("SELECT * FROM email_settings WHERE email_address = ?").bind(email).first();
        if (!persona) return new Response("Persona not found", { status: 404 });
        return html(renderPersonaEdit(persona, false));
      }

      // Personas - create
      if (path === "/personas" && method === "POST") {
        const formData = await request.formData();
        await env.DB.prepare(`
          INSERT INTO email_settings (email_address, system_prompt, model, reasoning_effort, text_verbosity, max_output_tokens)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          formData.get('email_address'),
          formData.get('system_prompt') || null,
          formData.get('model') || null,
          formData.get('reasoning_effort') || null,
          formData.get('text_verbosity') || null,
          formData.get('max_output_tokens') || null
        ).run();
        return Response.redirect(url.origin + "/personas", 303);
      }

      // Personas - update
      if (path.startsWith("/personas/") && path.endsWith("/edit") && method === "POST") {
        const email = decodeURIComponent(path.split("/")[2]).toLowerCase();
        const formData = await request.formData();
        await env.DB.prepare(`
          UPDATE email_settings SET system_prompt = ?, model = ?, reasoning_effort = ?, text_verbosity = ?, max_output_tokens = ?
          WHERE email_address = ?
        `).bind(
          formData.get('system_prompt') || null,
          formData.get('model') || null,
          formData.get('reasoning_effort') || null,
          formData.get('text_verbosity') || null,
          formData.get('max_output_tokens') || null,
          email
        ).run();
        return Response.redirect(url.origin + "/personas/" + encodeURIComponent(email), 303);
      }

      // Personas - delete
      if (path.startsWith("/personas/") && method === "DELETE") {
        const email = decodeURIComponent(path.split("/")[2]).toLowerCase();
        await env.DB.prepare("DELETE FROM email_settings WHERE email_address = ?").bind(email).run();
        return new Response("Deleted", { status: 200 });
      }

      // ============ API Routes ============
      
      // User export (GDPR)
      if (path.startsWith("/api/users/") && path.endsWith("/export") && method === "GET") {
        const email = decodeURIComponent(path.split("/")[3]).toLowerCase();
        const { results } = await env.DB.prepare("SELECT * FROM messages WHERE lower(recipient_email) = ?").bind(email).all();
        return new Response(JSON.stringify(results, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="export-${email}.json"`
          }
        });
      }

      // User delete (GDPR)
      if (path.startsWith("/api/users/") && method === "DELETE") {
        const email = decodeURIComponent(path.split("/")[3]).toLowerCase();
        await env.DB.batch([
          env.DB.prepare("DELETE FROM users WHERE email = ?").bind(email),
          env.DB.prepare("DELETE FROM email_settings WHERE email_address = ?").bind(email),
          env.DB.prepare(`
            UPDATE messages SET 
              from_name = 'Deleted User', from_email = 'deleted@anon.com', 
              raw_text = '[DELETED]', raw_html = '[DELETED]', 
              llm_summary = '[DELETED]', llm_reply = '[DELETED]',
              recipient_email = 'deleted@anon.com'
            WHERE lower(recipient_email) = ?
          `).bind(email)
        ]);
        return new Response("Deleted", { status: 200 });
      }

      return new Response("Not Found", { status: 404 });

    } catch (error) {
      return new Response(`Internal Error: ${error instanceof Error ? error.stack : String(error)}`, { status: 500 });
    }
  }
} satisfies ExportedHandler<Env>;
