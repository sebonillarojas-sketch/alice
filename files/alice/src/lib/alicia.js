// Puerta única a la IA para los módulos del ERP — el browser JAMÁS llama a
// Anthropic directo ni guarda keys (así se filtró la key el 13 jul 2026).
// pdf_base64: adjunta un PDF (reportes de obra) que el backend pasa como documento.
export async function aliciaAnalyze({ system, prompt, messages, max_tokens, pdf_base64 }) {
  const res = await fetch("https://aliceai.bam.pe/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, prompt, messages, max_tokens, pdf_base64 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `analyze ${res.status}`);
  return data.text || "";
}
