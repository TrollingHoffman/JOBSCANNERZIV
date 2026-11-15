export async function fileToText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  let text = '';

  if (name.endsWith('.pdf')) {
    const pdf = (await import('pdf-parse')).default;
    text = (await pdf(buf)).text;
  } else if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (name.endsWith('.txt') || name.endsWith('.md')) {
    text = buf.toString('utf-8');
  } else {
    throw new Error('פורמט לא נתמך. אפשר PDF, DOCX או TXT.');
  }

  text = text.replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 100) throw new Error('לא הצלחנו לחלץ טקסט מהקובץ. אם זה PDF סרוק, נסו DOCX.');
  return text;
}
