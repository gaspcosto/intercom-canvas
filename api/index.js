export default async function handler(req, res) {
  const isSubmit = req.body?.component_id === "generate_button";

  if (isSubmit) {
    // L'agent a cliqué → on envoie à Make
    await fetch("https://hook.eu1.make.com/asxq5xg31x1q4bqzunwetcmj78i1ouui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    return res.status(200).json({
      canvas: {
        content: {
          components: [
            { type: "text", text: "✅ Mail en cours de génération...", style: "paragraph" }
          ]
        }
      }
    });
  }

  // Chargement initial → juste le bouton
  return res.status(200).json({
    canvas: {
      content: {
        components: [
          {
            type: "button",
            id: "generate_button",
            label: "Générer le mail de suivi",
            style: "primary",
            action: { type: "submit" }
          }
        ]
      }
    }
  });
}
