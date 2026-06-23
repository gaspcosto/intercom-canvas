export default async function handler(req, res) {
  const componentId = req.body?.component_id;
  const token = process.env.INTERCOM_TOKEN;
  const intercomHeaders = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Intercom-Version": "2.11"
  };

  // === Chargement initial : deux boutons ===
  if (!componentId) {
    return res.status(200).json({
      canvas: {
        content: {
          components: [
            {
              type: "button",
              id: "recap_only",
              label: "📋 Recap historique",
              style: "secondary",
              action: { type: "submit" }
            },
            { type: "spacer", size: "s" },
            {
              type: "button",
              id: "full_action",
              label: "⏭️ Recap + Prochaine action",
              style: "primary",
              action: { type: "submit" }
            }
          ]
        }
      }
    });
  }

  // === Submit : on enrichit puis on forward ===
  const contactId = req.body?.customer?.id;

  try {
    const searchRes = await fetch("https://api.intercom.io/conversations/search", {
      method: "POST",
      headers: intercomHeaders,
      body: JSON.stringify({
        query: { field: "contact_ids", operator: "=", value: contactId },
        pagination: { per_page: 10 },
        sort: { field: "created_at", order: "desc" }
      })
    });
    const searchData = await searchRes.json();
    const conversations = searchData.conversations || [];

    const fullConvs = await Promise.all(
      conversations.map(c =>
        fetch(`https://api.intercom.io/conversations/${c.id}`, {
          headers: intercomHeaders
        }).then(r => r.json())
      )
    );

    const stripHtml = (s) => (s || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    const cleanData = fullConvs.map(c => ({
      id: c.id,
      created_at: c.created_at,
      tags: (c.tags?.tags || []).map(t => t.name),
      source: {
        type: c.source?.type,
        subject: stripHtml(c.source?.subject),
        body: stripHtml(c.source?.body),
        author: c.source?.author?.name
      },
      parts: (c.conversation_parts?.conversation_parts || [])
        .filter(p => {
          if (!p.body || p.body.trim() === "") return false;
          if (p.redacted === true) return false;
          const clean = stripHtml(p.body).toLowerCase();
          if (clean.includes("ce message a été supprimé")) return false;
          if (clean.includes("this note was deleted")) return false;
          if (clean.includes("this message was deleted")) return false;
          return true;
        })
        .map(p => ({
          type: p.part_type,
          author: p.author?.name,
          body: stripHtml(p.body),
          created_at: p.created_at
        }))
    }));

    // Route vers Make avec le type d'action
    await fetch("https://hook.eu1.make.com/asxq5xg31x1q4bqzunwetcmj78i1ouui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: componentId, // "recap_only" ou "full_action"
        contact: req.body.customer,
        current_conversation_id: req.body.conversation?.id,
        last_conversations: cleanData
      })
    });

    const message = componentId === "recap_only"
      ? "📋 Recap en cours...durée ≈ 30 secondes"
      : "🎯 Analyse + génération en cours...durée ≈ 45 secondes";

    return res.status(200).json({
      canvas: {
        content: {
          components: [{ type: "text", text: message, style: "paragraph" }]
        }
      }
    });

  } catch (err) {
    return res.status(200).json({
      canvas: {
        content: {
          components: [{ type: "text", text: "❌ Erreur : " + err.message, style: "paragraph" }]
        }
      }
    });
  }
}
