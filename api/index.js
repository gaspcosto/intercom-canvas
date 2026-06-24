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
    // === DIAGNOSTIC 1: Vérifier que le contact existe ===
    const contactRes = await fetch(`https://api.intercom.io/contacts/${contactId}`, {
      headers: intercomHeaders
    });
    const contactData = await contactRes.json();
    console.log("DIAG 1 - Contact lookup:", {
      status: contactRes.status,
      id_returned: contactData.id,
      name: contactData.name,
      email: contactData.email,
      role: contactData.role,
      type: contactData.type,
      errors: contactData.errors || null
    });

    // === DIAGNOSTIC 2: Search par contact_ids avec ~ ===
    const search1 = await fetch("https://api.intercom.io/conversations/search", {
      method: "POST",
      headers: intercomHeaders,
      body: JSON.stringify({
        query: { field: "contact_ids", operator: "~", value: contactId },
        pagination: { per_page: 10 }
      })
    });
    const search1Data = await search1.json();
    console.log("DIAG 2 - contact_ids ~ :", {
      status: search1.status,
      total_count: search1Data.total_count
    });

    // === DIAGNOSTIC 3: Search par contact_ids avec IN (array) ===
    const search2 = await fetch("https://api.intercom.io/conversations/search", {
      method: "POST",
      headers: intercomHeaders,
      body: JSON.stringify({
        query: { field: "contact_ids", operator: "IN", value: [contactId] },
        pagination: { per_page: 10 }
      })
    });
    const search2Data = await search2.json();
    console.log("DIAG 3 - contact_ids IN [array]:", {
      status: search2.status,
      total_count: search2Data.total_count
    });

    // === DIAGNOSTIC 4: Search par source.author.id ===
    const search3 = await fetch("https://api.intercom.io/conversations/search", {
      method: "POST",
      headers: intercomHeaders,
      body: JSON.stringify({
        query: { field: "source.author.id", operator: "=", value: contactId },
        pagination: { per_page: 10 }
      })
    });
    const search3Data = await search3.json();
    console.log("DIAG 4 - source.author.id =:", {
      status: search3.status,
      total_count: search3Data.total_count
    });

    // Pour ne pas casser le flow, on continue avec la meilleure source
    const conversations = search2Data.conversations || search1Data.conversations || search3Data.conversations || [];

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
      : "⏭️ Analyse + génération en cours...durée ≈ 45 secondes";

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
