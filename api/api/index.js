export default async function handler(req, res) {
  const conv_id = req.body?.conversation_id;
  const workspace_id = req.body?.workspace_id;

  // Forward à Make
  await fetch("https://hook.eu1.make.com/asxq5xg31x1q4bqzunwetcmj78i1ouui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conv_id, workspace_id })
  });

  // Retourne le canvas à Intercom
  res.status(200).json({
    canvas: {
      content: {
        components: [
          {
            type: "text",
            text: "✅ Mail en cours de génération...",
            style: "paragraph"
          }
        ]
      }
    }
  });
}
