export default async function handler(req, res) {
  const isSubmit = req.body?.component_id === "generate_button";

  // Chargement initial → bouton
  if (!isSubmit) {
    return res.status(200).json({
      canvas: {
        content: {
          components: [{
            type: "button",
            id: "generate_button",
            label: "Générer le mail de suivi",
            style: "primary",
            action: { type: "submit" }
          }]
        }
      }
    });
  }

  // Submit cliqué → on enrichit puis on forward à Make
  const contactId = req.body?.customer?.id;
  const token = process.env.INTERCOM_TOKEN;

  const intercomHeaders = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Intercom-Version": "2.11"
  };

  try {
    // 1. Cherche les 10 dernières conversations du contact
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

    // 2. Récupère les détails complets en parallèle
    const fullConvs = await Promise.all(
      conversations.map(c =>
        fetch(`https://api.intercom.io/conversations/${c.id}`, {
          headers: intercomHeaders
        }).then(r => r.json())
      )
    );

    // 3. Construit un JSON propre
    const cleanData = fullConvs.map(c => ({
      id: c.id,
      created_at: c.created_at,
      source: {
        type: c.source?.type,
        subject: c.source?.subject,
        body: c.source?.body,
        author: c.source?.author?.name
      },
      parts: (c.conversation_parts?.conversation_parts || []).map(p => ({
        type: p.part_type,
        author: p.author?.name,
        body: p.body,
        created_at: p.created_at
      }))
    }));

    // 4. Envoie à Make
    await fetch("https://hook.eu1.make.com/asxq5xg31x1q4bqzunwetcmj78i1ouui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact: req.body.customer,
        current_conversation_id: req.body.conversation?.id,
        last_conversations: cleanData
      })
    });

    return res.status(200).json({
      canvas: {
        content: {
          components: [{
            type: "text",
            text: "✅ Mail en cours de génération...",
            style: "paragraph"
          }]
        }
      }
    });

  } catch (err) {
    return res.status(200).json({
      canvas: {
        content: {
          components: [{
            type: "text",
            text: "❌ Erreur : " + err.message,
            style: "paragraph"
          }]
        }
      }
    });
  }
}
