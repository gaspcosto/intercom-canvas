export default async function handler(req, res) {

  // Forward à Make 
  await fetch("https://hook.eu1.make.com/asxq5xg31x1q4bqzunwetcmj78i1ouui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body)
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
